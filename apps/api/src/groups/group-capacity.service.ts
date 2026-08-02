import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

const CAPACITY_OVERRIDE_ROLES = ["OWNER", "BRANCH_MANAGER"] as const;

export interface GroupOccupancy {
  groupId: string;
  enrolled: number;
  plannedCapacity: number;
  maxCapacity: number;
  isOverPlanned: boolean;
  isOverMax: boolean;
}

// TRD 4.3: "показывает фактическую заполняемость и не даёт зачислить сверх
// максимума без подтверждения управляющего (с записью в аудит-лог)". Used by
// the Milestone 5 enrollment flow once the Child module exists; the capacity
// math and the confirmation/audit rule live here so enrollment doesn't
// reimplement it.
@Injectable()
export class GroupCapacityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async getOccupancy(groupId: string): Promise<GroupOccupancy> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException("Group not found");

    const enrolled = await this.prisma.child.count({
      where: { groupId, status: "ENROLLED" },
    });

    return {
      groupId,
      enrolled,
      plannedCapacity: group.plannedCapacity,
      maxCapacity: group.maxCapacity,
      isOverPlanned: enrolled >= group.plannedCapacity,
      isOverMax: enrolled >= group.maxCapacity,
    };
  }

  /**
   * Checks whether one more child can be enrolled into the group. Enrolling
   * within maxCapacity is always allowed. Enrolling beyond maxCapacity
   * requires `confirmedOverride: true` from a Branch Manager/Owner, and is
   * recorded in the audit log either way (the check itself, and the
   * override decision).
   */
  async assertCanEnroll(
    user: AuthenticatedUser,
    branchId: string,
    groupId: string,
    confirmedOverride: boolean,
  ): Promise<GroupOccupancy> {
    const occupancy = await this.getOccupancy(groupId);
    const wouldExceedMax = occupancy.enrolled + 1 > occupancy.maxCapacity;

    if (!wouldExceedMax) return occupancy;

    if (!confirmedOverride) {
      throw new ConflictException({
        message: "Group is at maximum capacity; manager confirmation required to proceed",
        occupancy,
      });
    }

    this.branchScope.assertRoleInBranch(user, [...CAPACITY_OVERRIDE_ROLES], branchId);

    await this.audit.record({
      entity: "group",
      entityId: groupId,
      action: "update",
      newValue: { event: "capacity_override", occupancy },
      actorId: user.id,
    });

    return occupancy;
  }
}
