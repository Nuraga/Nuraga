import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import { ChildAccessService, CHILD_READ_ROLES } from "../children/child-access.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateWaitlistEntryDto } from "./dto/create-waitlist-entry.dto";

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

    const child = await this.prisma.child.findUnique({ where: { id: dto.childId } });
    if (!child) throw new NotFoundException("Child not found");
    const family = await this.prisma.family.findUnique({ where: { id: child.familyId } });
    if (!family || family.branchId !== branchId) throw new NotFoundException("Child not found");
    if (child.status === "DISCHARGED") {
      throw new BadRequestException("Cannot waitlist a discharged child");
    }

    const entry = await this.prisma.waitlistEntry.create({
      data: {
        branchId,
        groupId,
        childId: dto.childId,
        priority: dto.priority ?? 0,
      },
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
      include: { child: true },
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

    await this.prisma.waitlistEntry.delete({ where: { id: entryId } });
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
