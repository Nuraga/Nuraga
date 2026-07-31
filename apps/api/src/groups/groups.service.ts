import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateGroupDto } from "./dto/create-group.dto";
import { UpdateGroupDto } from "./dto/update-group.dto";

const GROUP_MANAGER_ROLES = ["OWNER", "BRANCH_MANAGER"] as const;

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async create(user: AuthenticatedUser, branchId: string, dto: CreateGroupDto) {
    this.branchScope.assertRoleInBranch(user, [...GROUP_MANAGER_ROLES], branchId);
    this.assertCapacityOrdering(dto.plannedCapacity, dto.maxCapacity);

    const groupType = await this.prisma.groupType.findUnique({ where: { id: dto.groupTypeId } });
    if (!groupType) throw new BadRequestException("Unknown group type");
    if (!groupType.isActive) throw new BadRequestException("This group type is archived");

    const group = await this.prisma.group.create({
      data: { ...dto, branchId },
    });

    await this.audit.record({
      entity: "group",
      entityId: group.id,
      action: "create",
      newValue: group,
      actorId: user.id,
    });
    return group;
  }

  async findAllForBranch(user: AuthenticatedUser, branchId: string) {
    this.branchScope.assertBranchAccess(user, branchId);
    return this.prisma.group.findMany({
      where: { branchId },
      include: { groupType: true },
      orderBy: { name: "asc" },
    });
  }

  async findOne(user: AuthenticatedUser, branchId: string, id: string) {
    this.branchScope.assertBranchAccess(user, branchId);
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: { groupType: true },
    });
    // Also guards against IDOR: a group id that exists but belongs to a
    // different branch than the one in the URL must 404, not leak data.
    if (!group || group.branchId !== branchId) {
      throw new NotFoundException("Group not found");
    }
    return group;
  }

  async update(user: AuthenticatedUser, branchId: string, id: string, dto: UpdateGroupDto) {
    this.branchScope.assertRoleInBranch(user, [...GROUP_MANAGER_ROLES], branchId);
    const existing = await this.findOne(user, branchId, id);

    this.assertCapacityOrdering(
      dto.plannedCapacity ?? existing.plannedCapacity,
      dto.maxCapacity ?? existing.maxCapacity,
    );

    const group = await this.prisma.group.update({ where: { id }, data: dto });
    await this.audit.record({
      entity: "group",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: group,
      actorId: user.id,
    });
    return group;
  }

  async archive(user: AuthenticatedUser, branchId: string, id: string) {
    return this.update(user, branchId, id, { isActive: false });
  }

  private assertCapacityOrdering(plannedCapacity: number, maxCapacity: number): void {
    if (maxCapacity < plannedCapacity) {
      throw new BadRequestException("maxCapacity cannot be less than plannedCapacity");
    }
  }
}
