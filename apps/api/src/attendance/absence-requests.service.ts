import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AbsenceRequestStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import { ATTENDANCE_MARK_ROLES, ATTENDANCE_READ_ROLES } from "./attendance-access.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { RejectAbsenceRequestDto } from "./dto/reject-absence-request.dto";

// Staff-side review of parent-submitted AbsenceRequests (ТЗ §5.2/§7.1).
// Approval is the only write path that turns a parent's request into actual
// Attendance rows — mirrors AttendanceService.mark's per-day upsert, just
// looped across the requested date range. Uses the same role split as
// marking/reading attendance directly (no separate "review" role in the ТЗ
// matrix) — deliberately branch-role-only here, not the per-group Teacher
// scoping AttendanceAccessService adds for marking, since a request review
// is a branch-office decision, not a classroom one.
@Injectable()
export class AbsenceRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async listForBranch(user: AuthenticatedUser, branchId: string, status?: AbsenceRequestStatus) {
    this.branchScope.assertRoleInBranch(user, [...ATTENDANCE_READ_ROLES], branchId);

    return this.prisma.absenceRequest.findMany({
      where: { child: { family: { branchId } }, status },
      include: {
        child: { select: { id: true, fullName: true } },
        submittedByParent: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async approve(user: AuthenticatedUser, branchId: string, id: string) {
    this.branchScope.assertRoleInBranch(user, [...ATTENDANCE_MARK_ROLES], branchId);
    const request = await this.getInBranch(branchId, id);
    if (request.status !== "PENDING") {
      throw new BadRequestException("Only a pending absence request can be approved");
    }

    const child = await this.prisma.child.findUniqueOrThrow({ where: { id: request.childId } });
    if (!child.groupId) {
      throw new BadRequestException("Child has no group — cannot mark attendance");
    }

    const dates = this.datesInRange(request.dateFrom, request.dateTo);
    for (const date of dates) {
      await this.assertPeriodOpen(branchId, date);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const date of dates) {
        await tx.attendance.upsert({
          where: { childId_date: { childId: request.childId, date } },
          create: {
            childId: request.childId,
            groupId: child.groupId!,
            date,
            status: "ABSENT_EXCUSED",
            markedById: user.id,
          },
          update: { status: "ABSENT_EXCUSED", markedById: user.id },
        });
      }
      return tx.absenceRequest.update({
        where: { id },
        data: { status: "APPROVED", reviewedById: user.id, reviewedAt: new Date() },
      });
    });

    await this.audit.record({
      entity: "absence_request",
      entityId: id,
      action: "update",
      oldValue: { status: "PENDING" },
      newValue: { event: "approve", status: "APPROVED", datesMarked: dates.length },
      actorId: user.id,
    });
    return updated;
  }

  async reject(user: AuthenticatedUser, branchId: string, id: string, dto: RejectAbsenceRequestDto) {
    this.branchScope.assertRoleInBranch(user, [...ATTENDANCE_MARK_ROLES], branchId);
    const request = await this.getInBranch(branchId, id);
    if (request.status !== "PENDING") {
      throw new BadRequestException("Only a pending absence request can be rejected");
    }

    const updated = await this.prisma.absenceRequest.update({
      where: { id },
      data: { status: "REJECTED", reviewedById: user.id, reviewedAt: new Date(), reviewComment: dto.comment },
    });
    await this.audit.record({
      entity: "absence_request",
      entityId: id,
      action: "update",
      oldValue: { status: "PENDING" },
      newValue: { event: "reject", status: "REJECTED", comment: dto.comment },
      actorId: user.id,
    });
    return updated;
  }

  private async getInBranch(branchId: string, id: string) {
    const request = await this.prisma.absenceRequest.findUnique({
      where: { id },
      include: { child: true },
    });
    if (!request) throw new NotFoundException("Absence request not found");

    const family = await this.prisma.family.findUnique({ where: { id: request.child.familyId } });
    if (!family || family.branchId !== branchId) {
      throw new NotFoundException("Absence request not found");
    }
    return request;
  }

  private datesInRange(from: Date, to: Date): Date[] {
    const dates: Date[] = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      dates.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }

  private async assertPeriodOpen(branchId: string, date: Date): Promise<void> {
    const period = await this.prisma.timesheetPeriod.findUnique({
      where: {
        branchId_year_month: { branchId, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 },
      },
    });
    if (period?.status === "CLOSED") {
      throw new ConflictException(
        `Timesheet period for ${date.toISOString().slice(0, 7)} is closed — this absence request can't be auto-approved for that date`,
      );
    }
  }
}
