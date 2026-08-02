import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import { ChildAccessService, CHILD_READ_ROLES } from "../children/child-access.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateWaitlistEntryDto } from "./dto/create-waitlist-entry.dto";

// A lead removed from the waitlist reverts to this fixed stage rather than
// whatever stage preceded WAITLISTED (not stored anywhere) — a documented
// simplification for the Этап 3 MVP pass.
const LEAD_STAGE_AFTER_WAITLIST_REMOVAL = "CONTACTED";

@Injectable()
export class WaitlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly childAccess: ChildAccessService,
    private readonly audit: AuditService,
  ) {}

  async add(user: AuthenticatedUser, branchId: string, groupId: string, dto: CreateWaitlistEntryDto) {
    this.childAccess.assertWriteAccess(user, branchId);
    await this.getGroupInBranch(branchId, groupId);

    const hasChild = Boolean(dto.childId);
    const hasLead = Boolean(dto.leadId);
    if (hasChild === hasLead) {
      throw new BadRequestException("Provide exactly one of childId or leadId");
    }

    if (dto.childId) {
      const child = await this.prisma.child.findUnique({ where: { id: dto.childId } });
      if (!child) throw new NotFoundException("Child not found");
      const family = await this.prisma.family.findUnique({ where: { id: child.familyId } });
      if (!family || family.branchId !== branchId) throw new NotFoundException("Child not found");
      if (child.status === "DISCHARGED") {
        throw new BadRequestException("Cannot waitlist a discharged child");
      }

      const entry = await this.prisma.waitlistEntry.create({
        data: { branchId, groupId, childId: dto.childId, priority: dto.priority ?? 0 },
      });
      await this.audit.record({
        entity: "waitlist_entry",
        entityId: entry.id,
        action: "create",
        newValue: entry,
        actorId: user.id,
      });
      return entry;
    }

    const lead = await this.prisma.lead.findUnique({ where: { id: dto.leadId } });
    if (!lead || lead.branchId !== branchId) throw new NotFoundException("Lead not found");
    if (["ENROLLED", "REJECTED", "WAITLISTED"].includes(lead.stage)) {
      throw new BadRequestException(`Cannot waitlist a lead in stage ${lead.stage}`);
    }

    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.waitlistEntry.create({
        data: { branchId, groupId, leadId: dto.leadId, priority: dto.priority ?? 0 },
      });
      await tx.lead.update({
        where: { id: dto.leadId },
        data: { stage: "WAITLISTED", stageEnteredAt: new Date() },
      });
      return created;
    });
    await this.audit.record({
      entity: "waitlist_entry",
      entityId: entry.id,
      action: "create",
      newValue: entry,
      actorId: user.id,
    });
    return entry;
  }

  /** Ordered per TRD 3.4: priority first, then time queued — first candidates for a vacancy. */
  async list(user: AuthenticatedUser, branchId: string, groupId: string, limit?: number) {
    this.branchScope.assertRoleInBranch(user, CHILD_READ_ROLES, branchId);
    await this.getGroupInBranch(branchId, groupId);

    return this.prisma.waitlistEntry.findMany({
      where: { branchId, groupId },
      include: { child: true, lead: true },
      orderBy: [{ priority: "desc" }, { queuedAt: "asc" }],
      take: limit,
    });
  }

  async remove(user: AuthenticatedUser, branchId: string, groupId: string, entryId: string) {
    this.childAccess.assertWriteAccess(user, branchId);
    const entry = await this.prisma.waitlistEntry.findUnique({ where: { id: entryId } });
    if (!entry || entry.branchId !== branchId || entry.groupId !== groupId) {
      throw new NotFoundException("Waitlist entry not found");
    }

    if (entry.leadId) {
      await this.prisma.$transaction(async (tx) => {
        await tx.waitlistEntry.delete({ where: { id: entryId } });
        await tx.lead.update({
          where: { id: entry.leadId! },
          data: { stage: LEAD_STAGE_AFTER_WAITLIST_REMOVAL, stageEnteredAt: new Date() },
        });
      });
    } else {
      await this.prisma.waitlistEntry.delete({ where: { id: entryId } });
    }

    await this.audit.record({
      entity: "waitlist_entry",
      entityId: entryId,
      action: "delete",
      oldValue: entry,
      actorId: user.id,
    });
  }

  private async getGroupInBranch(branchId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.branchId !== branchId) {
      throw new NotFoundException("Group not found in this branch");
    }
    return group;
  }
}
