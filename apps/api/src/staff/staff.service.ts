import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateStaffDto } from "./dto/create-staff.dto";

const STAFF_MANAGER_ROLES = ["OWNER", "BRANCH_MANAGER"] as const;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async create(user: AuthenticatedUser, branchId: string, dto: CreateStaffDto) {
    this.branchScope.assertRoleInBranch(user, [...STAFF_MANAGER_ROLES], branchId);

    const staff = await this.prisma.staff.create({
      data: {
        userId: dto.userId,
        branchId,
        position: dto.position,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined,
      },
    });

    await this.audit.record({
      entity: "staff",
      entityId: staff.id,
      action: "create",
      newValue: staff,
      actorId: user.id,
    });
    return staff;
  }

  async findAllForBranch(user: AuthenticatedUser, branchId: string) {
    this.branchScope.assertBranchAccess(user, branchId);
    return this.prisma.staff.findMany({
      where: { branchId },
      include: { groups: true, user: { select: { id: true, fullName: true, email: true } } },
    });
  }

  async assignGroup(user: AuthenticatedUser, branchId: string, staffId: string, groupId: string) {
    this.branchScope.assertRoleInBranch(user, [...STAFF_MANAGER_ROLES], branchId);
    await this.assertStaffInBranch(branchId, staffId);

    await this.prisma.staffGroup.upsert({
      where: { staffId_groupId: { staffId, groupId } },
      update: {},
      create: { staffId, groupId },
    });

    await this.audit.record({
      entity: "staff_group",
      entityId: `${staffId}:${groupId}`,
      action: "create",
      newValue: { staffId, groupId },
      actorId: user.id,
    });
  }

  async unassignGroup(
    user: AuthenticatedUser,
    branchId: string,
    staffId: string,
    groupId: string,
  ) {
    this.branchScope.assertRoleInBranch(user, [...STAFF_MANAGER_ROLES], branchId);
    await this.assertStaffInBranch(branchId, staffId);

    await this.prisma.staffGroup.deleteMany({ where: { staffId, groupId } });
    await this.audit.record({
      entity: "staff_group",
      entityId: `${staffId}:${groupId}`,
      action: "delete",
      actorId: user.id,
    });
  }

  private async assertStaffInBranch(branchId: string, staffId: string): Promise<void> {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.branchId !== branchId) {
      throw new NotFoundException("Staff member not found in this branch");
    }
  }
}
