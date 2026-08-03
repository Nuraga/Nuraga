import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { LeadStage, Role } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { AuditService } from "../../common/audit/audit.service";
import { GroupCapacityService } from "../../groups/group-capacity.service";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";
import { UpdateLeadStageDto } from "./dto/update-lead-stage.dto";
import { ConvertLeadDto } from "./dto/convert-lead.dto";
import { CreateLeadActivityDto } from "./dto/create-lead-activity.dto";
import { SiteLeadIntakeDto } from "./dto/site-lead-intake.dto";

// ТЗ §2.2 "Лиды" row: Owner ПСРУ, Управляющий(BRANCH_MANAGER) ПСРУ,
// Менеджер(MANAGER) ПСР — no archive/delete for Manager.
const LEAD_READ_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER"];
const LEAD_WRITE_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER"];
const LEAD_DELETE_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER"];

const TERMINAL_STAGES: readonly LeadStage[] = ["ENROLLED", "REJECTED", "WAITLISTED"];
const ATTENTION_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

// Auto-populated LeadSource for POST /public/leads (ТЗ §3.1 "приём заявок
// с сайта"). Created lazily on first use rather than seeded, so this
// module has no bootstrap-order dependency on the dictionaries module.
const SITE_SOURCE_NAME = "Сайт";

// Who a site-submitted lead is auto-assigned to, most-specific first —
// there's no "unassigned" queue concept in this schema (responsibleUserId
// is required), so a real staff member must be picked immediately.
const SITE_INTAKE_ASSIGNEE_ROLES: Role[] = ["MANAGER", "BRANCH_MANAGER", "OWNER"];

/**
 * Digits-only, with the RU/KZ domestic trunk prefix "8" folded to the "7"
 * country code, so "+7 701 123-45-67" and "8 (701) 123 45 67" dedupe as the
 * same number (both become "77011234567").
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("8") ? `7${digits.slice(1)}` : digits;
}

export interface LeadFilters {
  stage?: LeadStage;
  sourceId?: string;
  responsibleUserId?: string;
  q?: string;
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
    private readonly capacity: GroupCapacityService,
  ) {}

  async list(user: AuthenticatedUser, branchId: string, filters: LeadFilters) {
    this.branchScope.assertRoleInBranch(user, LEAD_READ_ROLES, branchId);

    return this.prisma.lead.findMany({
      where: {
        branchId,
        ...(filters.stage ? { stage: filters.stage } : {}),
        ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
        ...(filters.responsibleUserId ? { responsibleUserId: filters.responsibleUserId } : {}),
        ...(filters.q
          ? {
              OR: [
                { parentFullName: { contains: filters.q, mode: "insensitive" } },
                { childFullName: { contains: filters.q, mode: "insensitive" } },
                { parentPhone: { contains: filters.q } },
              ],
            }
          : {}),
      },
      include: { source: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** ТЗ §3.3: a non-terminal lead with no open task, untouched for >2 days. */
  async listNeedingAttention(user: AuthenticatedUser, branchId: string) {
    this.branchScope.assertRoleInBranch(user, LEAD_READ_ROLES, branchId);
    const cutoff = new Date(Date.now() - ATTENTION_WINDOW_MS);

    return this.prisma.lead.findMany({
      where: {
        branchId,
        stage: { notIn: [...TERMINAL_STAGES] },
        stageEnteredAt: { lt: cutoff },
        tasks: { none: { completedAt: null } },
      },
      orderBy: { stageEnteredAt: "asc" },
    });
  }

  /** Network-wide by design (ТЗ §3.1: dedup across the whole network, not just this branch). */
  async checkDuplicates(user: AuthenticatedUser, branchId: string, phone: string) {
    this.branchScope.assertRoleInBranch(user, LEAD_READ_ROLES, branchId);
    const normalized = normalizePhone(phone);
    if (!normalized) return { duplicates: [] };

    const leads = await this.prisma.lead.findMany({
      where: { parentPhoneNormalized: normalized },
      include: { branch: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      duplicates: leads.map((l) => ({
        id: l.id,
        branchId: l.branchId,
        branchName: l.branch.name,
        stage: l.stage,
        responsibleUserId: l.responsibleUserId,
        childFullName: l.childFullName,
        createdAt: l.createdAt,
      })),
    };
  }

  async get(user: AuthenticatedUser, branchId: string, id: string) {
    this.branchScope.assertRoleInBranch(user, LEAD_READ_ROLES, branchId);
    await this.getOwnedOrThrow(branchId, id);

    return this.prisma.lead.findUniqueOrThrow({
      where: { id },
      include: {
        source: true,
        rejectionReason: true,
        activities: { orderBy: { createdAt: "desc" } },
        tasks: { orderBy: { dueAt: "asc" } },
      },
    });
  }

  async create(user: AuthenticatedUser, branchId: string, dto: CreateLeadDto) {
    this.branchScope.assertRoleInBranch(user, LEAD_WRITE_ROLES, branchId);

    const normalized = normalizePhone(dto.parentPhone);
    if (normalized && !dto.confirmDuplicate) {
      const duplicate = await this.prisma.lead.findFirst({
        where: { parentPhoneNormalized: normalized },
      });
      if (duplicate) {
        throw new ConflictException({
          message:
            "A lead with this phone number already exists — resubmit with confirmDuplicate to create a new one anyway",
          duplicateLeadId: duplicate.id,
        });
      }
    }

    const lead = await this.prisma.lead.create({
      data: {
        branchId,
        parentFullName: dto.parentFullName,
        parentPhone: dto.parentPhone,
        parentPhoneNormalized: normalized,
        parentEmail: dto.parentEmail,
        childFullName: dto.childFullName,
        childBirthDate: dto.childBirthDate ? new Date(dto.childBirthDate) : undefined,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        sourceId: dto.sourceId,
        responsibleUserId: dto.responsibleUserId,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
      },
    });

    await this.audit.record({
      entity: "lead",
      entityId: lead.id,
      action: "create",
      newValue: lead,
      actorId: user.id,
    });
    return lead;
  }

  /**
   * ТЗ §3.1 "приём заявок с сайта" — the one intentionally unauthenticated
   * write path in this API (see PublicLeadIntakeController). No `user`,
   * no branch-role check: source/responsible are auto-resolved, and a
   * cross-network phone duplicate never blocks submission (an anonymous
   * visitor can't be shown another family's data to decide on) — it's
   * only flagged for staff via a LeadActivity note on the new lead.
   */
  async siteIntake(dto: SiteLeadIntakeDto, ip?: string): Promise<{ status: "ok" }> {
    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
    if (!branch) throw new NotFoundException("Unknown branch");

    const [sourceId, responsibleUserId] = await Promise.all([
      this.getOrCreateSiteSourceId(),
      this.pickSiteIntakeAssignee(dto.branchId),
    ]);

    const normalized = normalizePhone(dto.parentPhone);

    const lead = await this.prisma.lead.create({
      data: {
        branchId: dto.branchId,
        parentFullName: dto.parentFullName,
        parentPhone: dto.parentPhone,
        parentPhoneNormalized: normalized,
        parentEmail: dto.parentEmail,
        childFullName: dto.childFullName,
        childBirthDate: dto.childBirthDate ? new Date(dto.childBirthDate) : undefined,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        sourceId,
        responsibleUserId,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
      },
    });

    await this.audit.record({
      entity: "lead",
      entityId: lead.id,
      action: "create",
      newValue: { event: "site_intake", ...lead },
      actorId: null,
      ip,
    });

    if (normalized) {
      const duplicate = await this.prisma.lead.findFirst({
        where: { parentPhoneNormalized: normalized, id: { not: lead.id } },
        include: { branch: { select: { name: true } } },
      });
      if (duplicate) {
        await this.prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            authorId: responsibleUserId,
            content: `Автоматическая пометка: возможный дубль по телефону — уже есть заявка в филиале «${duplicate.branch.name}» (создана ${duplicate.createdAt.toISOString().slice(0, 10)}).`,
          },
        });
      }
    }

    return { status: "ok" };
  }

  async update(user: AuthenticatedUser, branchId: string, id: string, dto: UpdateLeadDto) {
    this.branchScope.assertRoleInBranch(user, LEAD_WRITE_ROLES, branchId);
    const existing = await this.getOwnedOrThrow(branchId, id);

    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        ...dto,
        parentPhoneNormalized: dto.parentPhone ? normalizePhone(dto.parentPhone) : undefined,
        childBirthDate: dto.childBirthDate ? new Date(dto.childBirthDate) : undefined,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      },
    });
    await this.audit.record({
      entity: "lead",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: lead,
      actorId: user.id,
    });
    return lead;
  }

  async updateStage(user: AuthenticatedUser, branchId: string, id: string, dto: UpdateLeadStageDto) {
    this.branchScope.assertRoleInBranch(user, LEAD_WRITE_ROLES, branchId);
    const existing = await this.getOwnedOrThrow(branchId, id);

    if (TERMINAL_STAGES.includes(existing.stage)) {
      throw new BadRequestException(
        `Lead is in terminal stage ${existing.stage} — it can no longer change stage this way`,
      );
    }
    if (dto.stage === "REJECTED" && !dto.rejectionReasonId) {
      throw new BadRequestException("rejectionReasonId is required when rejecting a lead");
    }

    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        stage: dto.stage,
        stageEnteredAt: new Date(),
        rejectionReasonId: dto.stage === "REJECTED" ? dto.rejectionReasonId : null,
        rejectionComment: dto.stage === "REJECTED" ? dto.rejectionComment : null,
      },
    });
    await this.audit.record({
      entity: "lead",
      entityId: id,
      action: "update",
      oldValue: { stage: existing.stage },
      newValue: { event: "stage_change", stage: lead.stage },
      actorId: user.id,
    });
    return lead;
  }

  /** Atomic lead → Family+Parent+Child(+Contract) conversion (ТЗ §3.2/§4.4). */
  async convert(user: AuthenticatedUser, branchId: string, id: string, dto: ConvertLeadDto) {
    this.branchScope.assertRoleInBranch(user, LEAD_WRITE_ROLES, branchId);
    const existing = await this.getOwnedOrThrow(branchId, id);

    if (existing.convertedFamilyId) {
      throw new BadRequestException("This lead has already been converted");
    }
    if (TERMINAL_STAGES.includes(existing.stage)) {
      throw new BadRequestException(`Cannot convert a lead in stage ${existing.stage}`);
    }

    await this.assertTariffUsableInBranch(branchId, dto.tariffId);
    if (dto.groupId) {
      await this.assertGroupInBranch(branchId, dto.groupId);
      await this.capacity.assertCanEnroll(user, branchId, dto.groupId, dto.confirmOverride ?? false);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const family = await tx.family.create({ data: { branchId, name: dto.parentFullName } });
      await tx.parent.create({
        data: {
          familyId: family.id,
          fullName: dto.parentFullName,
          relationship: dto.parentRelationship,
          phone: dto.parentPhone,
          email: dto.parentEmail,
        },
      });
      const child = await tx.child.create({
        data: {
          familyId: family.id,
          groupId: dto.groupId,
          fullName: dto.childFullName,
          birthDate: new Date(dto.childBirthDate),
          sex: dto.childSex,
          status: dto.groupId ? "ENROLLED" : "WAITLIST",
          enrolledAt: dto.groupId ? new Date() : undefined,
        },
      });
      const contract = await tx.contract.create({
        data: {
          familyId: family.id,
          childId: child.id,
          tariffId: dto.tariffId,
          number: dto.contractNumber,
          startDate: new Date(dto.contractStartDate),
          status: "ACTIVE",
        },
      });
      const lead = await tx.lead.update({
        where: { id },
        data: {
          stage: "ENROLLED",
          stageEnteredAt: new Date(),
          convertedFamilyId: family.id,
          convertedChildId: child.id,
        },
      });
      return { family, child, contract, lead };
    });

    await this.audit.record({
      entity: "family",
      entityId: result.family.id,
      action: "create",
      newValue: result.family,
      actorId: user.id,
    });
    await this.audit.record({
      entity: "child",
      entityId: result.child.id,
      action: "create",
      newValue: result.child,
      actorId: user.id,
    });
    await this.audit.record({
      entity: "contract",
      entityId: result.contract.id,
      action: "create",
      newValue: result.contract,
      actorId: user.id,
    });
    await this.audit.record({
      entity: "lead",
      entityId: id,
      action: "update",
      oldValue: { stage: existing.stage },
      newValue: { event: "convert", familyId: result.family.id },
      actorId: user.id,
    });

    return { familyId: result.family.id, childId: result.child.id, contractId: result.contract.id };
  }

  async remove(user: AuthenticatedUser, branchId: string, id: string) {
    this.branchScope.assertRoleInBranch(user, LEAD_DELETE_ROLES, branchId);
    const existing = await this.getOwnedOrThrow(branchId, id);

    await this.prisma.lead.delete({ where: { id } });
    await this.audit.record({
      entity: "lead",
      entityId: id,
      action: "delete",
      oldValue: existing,
      actorId: user.id,
    });
  }

  async addActivity(user: AuthenticatedUser, branchId: string, id: string, dto: CreateLeadActivityDto) {
    this.branchScope.assertRoleInBranch(user, LEAD_WRITE_ROLES, branchId);
    await this.getOwnedOrThrow(branchId, id);

    const activity = await this.prisma.leadActivity.create({
      data: { leadId: id, authorId: user.id, content: dto.content },
    });
    await this.audit.record({
      entity: "lead_activity",
      entityId: activity.id,
      action: "create",
      newValue: activity,
      actorId: user.id,
    });
    return activity;
  }

  /** Also serves as the IDOR guard: lead must belong to the branch in the URL. */
  private async getOwnedOrThrow(branchId: string, id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.branchId !== branchId) {
      throw new NotFoundException("Lead not found");
    }
    return lead;
  }

  private async assertTariffUsableInBranch(branchId: string, tariffId: string): Promise<void> {
    const tariff = await this.prisma.tariff.findUnique({ where: { id: tariffId } });
    if (!tariff || (tariff.branchId !== null && tariff.branchId !== branchId)) {
      throw new BadRequestException("Tariff is not available in this branch");
    }
    if (!tariff.isActive) throw new BadRequestException("This tariff is archived");
  }

  private async assertGroupInBranch(branchId: string, groupId: string): Promise<void> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.branchId !== branchId) {
      throw new NotFoundException("Group not found in this branch");
    }
  }

  private async getOrCreateSiteSourceId(): Promise<string> {
    const existing = await this.prisma.leadSource.findUnique({ where: { name: SITE_SOURCE_NAME } });
    if (existing) return existing.id;

    try {
      const created = await this.prisma.leadSource.create({ data: { name: SITE_SOURCE_NAME } });
      return created.id;
    } catch {
      // Lost a create race against a concurrent submission — the unique
      // constraint on LeadSource.name means it exists now either way.
      const raced = await this.prisma.leadSource.findUniqueOrThrow({ where: { name: SITE_SOURCE_NAME } });
      return raced.id;
    }
  }

  private async pickSiteIntakeAssignee(branchId: string): Promise<string> {
    for (const role of SITE_INTAKE_ASSIGNEE_ROLES) {
      const grant = await this.prisma.userBranchRole.findFirst({ where: { branchId, role } });
      if (grant) return grant.userId;
    }
    throw new BadRequestException("This branch has no staff configured to receive site leads yet");
  }
}
