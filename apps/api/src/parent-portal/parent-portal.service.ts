import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { ParentAccessService } from "../common/access/parent-access.service";
import { AuditService } from "../common/audit/audit.service";
import { FileUrlService } from "../common/storage/file-url.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import type { FamilyBalance } from "../billing/payments/payments.service";
import { CreateAbsenceRequestDto } from "./dto/create-absence-request.dto";

export interface ParentPhotoView {
  id: string;
  groupId: string;
  caption: string | null;
  takenAt: string;
  downloadUrl: string;
}

export interface ChildPhotoConsentView {
  childId: string;
  fullName: string;
  consent: boolean;
}

const OPEN_OR_SETTLED_INVOICE_STATUSES = ["APPROVED", "PARTIALLY_PAID", "PAID"] as const;
const MAX_ABSENCE_REQUEST_DAYS = 60;

function toDateOnly(value: string): Date {
  return new Date(value.slice(0, 10));
}

// Read-only self-service for a parent-authenticated session (see
// ParentAccessService) — every method scopes off `user.parentProfile`
// instead of a branch role, so this deliberately does NOT reuse
// PaymentsService/InvoicingService/AttendanceService (their auth model is
// branch-role-based and doesn't fit). Mirrors their query shapes though.
@Injectable()
export class ParentPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parentAccess: ParentAccessService,
    private readonly audit: AuditService,
    private readonly fileUrls: FileUrlService,
  ) {}

  async getMe(user: AuthenticatedUser) {
    const familyId = this.parentAccess.assertFamilyId(user);
    return this.prisma.family.findUniqueOrThrow({
      where: { id: familyId },
      include: { parents: true, children: true },
    });
  }

  /** ТЗ §6.4: "до утверждения родитель счёт не видит" — DRAFT invoices are excluded. */
  async listInvoices(user: AuthenticatedUser) {
    const familyId = this.parentAccess.assertFamilyId(user);
    return this.prisma.invoice.findMany({
      where: { familyId, status: { not: "DRAFT" } },
      include: { lines: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  async listPayments(user: AuthenticatedUser) {
    const familyId = this.parentAccess.assertFamilyId(user);
    return this.prisma.payment.findMany({ where: { familyId }, orderBy: { paidAt: "desc" } });
  }

  /** Same shape/formula as PaymentsService.getFamilyBalance (ТЗ §11.3 invariant #2). */
  async getBalance(user: AuthenticatedUser): Promise<FamilyBalance> {
    const familyId = this.parentAccess.assertFamilyId(user);

    const [paid, invoiced] = await Promise.all([
      this.prisma.payment.aggregate({ where: { familyId }, _sum: { amountMinor: true } }),
      this.prisma.invoice.aggregate({
        where: { familyId, status: { in: [...OPEN_OR_SETTLED_INVOICE_STATUSES] } },
        _sum: { totalMinor: true },
      }),
    ]);

    const totalPaidMinor = paid._sum.amountMinor ?? 0;
    const totalInvoicedMinor = invoiced._sum.totalMinor ?? 0;
    return { totalPaidMinor, totalInvoicedMinor, balanceMinor: totalPaidMinor - totalInvoicedMinor };
  }

  async getChildAttendance(user: AuthenticatedUser, childId: string, from?: string, to?: string) {
    const familyId = this.parentAccess.assertFamilyId(user);
    await this.assertChildInFamily(familyId, childId);

    return this.prisma.attendance.findMany({
      where: {
        childId,
        date: { gte: from ? toDateOnly(from) : undefined, lte: to ? toDateOnly(to) : undefined },
      },
      orderBy: { date: "asc" },
    });
  }

  async createAbsenceRequest(user: AuthenticatedUser, childId: string, dto: CreateAbsenceRequestDto) {
    const familyId = this.parentAccess.assertFamilyId(user);
    await this.assertChildInFamily(familyId, childId);

    const dateFrom = toDateOnly(dto.dateFrom);
    const dateTo = toDateOnly(dto.dateTo);
    if (dateTo < dateFrom) {
      throw new BadRequestException("dateTo must not be before dateFrom");
    }
    const spanDays = (dateTo.getTime() - dateFrom.getTime()) / (24 * 60 * 60 * 1000) + 1;
    if (spanDays > MAX_ABSENCE_REQUEST_DAYS) {
      throw new BadRequestException(`Absence request can span at most ${MAX_ABSENCE_REQUEST_DAYS} days`);
    }

    // assertFamilyId already validated user.parentProfile is set.
    const request = await this.prisma.absenceRequest.create({
      data: {
        childId,
        dateFrom,
        dateTo,
        reason: dto.reason,
        submittedByParentId: user.parentProfile!.id,
      },
    });

    await this.audit.record({
      entity: "absence_request",
      entityId: request.id,
      action: "create",
      newValue: request,
      actorId: user.id,
    });
    return request;
  }

  async listAbsenceRequests(user: AuthenticatedUser) {
    const familyId = this.parentAccess.assertFamilyId(user);
    return this.prisma.absenceRequest.findMany({
      where: { child: { familyId } },
      orderBy: { createdAt: "desc" },
    });
  }

  /** ТЗ §7.1 "Главная: ...что в меню" — today's menu for the family's branch. No conflict data — that's for staff, not parents. */
  async todayMenu(user: AuthenticatedUser) {
    const familyId = this.parentAccess.assertFamilyId(user);
    const family = await this.prisma.family.findUniqueOrThrow({
      where: { id: familyId },
      select: { branchId: true },
    });

    const today = toDateOnly(new Date().toISOString());
    const items = await this.prisma.menuItem.findMany({
      where: { branchId: family.branchId, date: today },
      include: { dish: { select: { name: true } } },
      orderBy: { mealType: "asc" },
    });

    return items.map((item) => ({ mealType: item.mealType, dishName: item.dish.name }));
  }

  /** ТЗ §7.4 photo feed — every photo posted to any of the family's children's groups, newest first. Consent never filters this: it only gates what a *staff uploader* is warned about (PhotosService.consentGaps), not what a parent can see of their own child's group. */
  async photos(user: AuthenticatedUser): Promise<ParentPhotoView[]> {
    const familyId = this.parentAccess.assertFamilyId(user);

    const children = await this.prisma.child.findMany({
      where: { familyId, groupId: { not: null } },
      select: { groupId: true },
    });
    const groupIds = [...new Set(children.map((c) => c.groupId!).filter(Boolean))];
    if (groupIds.length === 0) return [];

    const photos = await this.prisma.photo.findMany({
      where: { groupId: { in: groupIds } },
      orderBy: { takenAt: "desc" },
      take: 100,
    });

    return Promise.all(
      photos.map(async (photo) => ({
        id: photo.id,
        groupId: photo.groupId,
        caption: photo.caption,
        takenAt: photo.takenAt.toISOString(),
        downloadUrl: await this.signPhotoUrl(photo),
      })),
    );
  }

  async getPhotoConsents(user: AuthenticatedUser): Promise<ChildPhotoConsentView[]> {
    const familyId = this.parentAccess.assertFamilyId(user);

    const children = await this.prisma.child.findMany({
      where: { familyId },
      select: { id: true, fullName: true, photoConsent: { select: { consent: true } } },
    });

    return children.map((c) => ({
      childId: c.id,
      fullName: c.fullName,
      consent: c.photoConsent?.consent ?? false,
    }));
  }

  async setPhotoConsent(user: AuthenticatedUser, childId: string, consent: boolean) {
    const familyId = this.parentAccess.assertFamilyId(user);
    await this.assertChildInFamily(familyId, childId);

    const updated = await this.prisma.childPhotoConsent.upsert({
      where: { childId },
      create: { childId, consent, updatedByParentId: user.parentProfile!.id },
      update: { consent, updatedByParentId: user.parentProfile!.id },
    });

    await this.audit.record({
      entity: "child_photo_consent",
      entityId: childId,
      action: "update",
      newValue: { consent },
      actorId: user.id,
    });

    return updated;
  }

  private async signPhotoUrl(photo: { fileKey: string; mimeType: string; fileName: string }): Promise<string> {
    const token = await this.fileUrls.sign({
      key: photo.fileKey,
      contentType: photo.mimeType,
      fileName: photo.fileName,
    });
    return `/api/files/${token}`;
  }

  private async assertChildInFamily(familyId: string, childId: string): Promise<void> {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child || child.familyId !== familyId) {
      throw new NotFoundException("Child not found in your family");
    }
  }
}
