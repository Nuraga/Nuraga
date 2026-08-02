import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { TeacherScopeService } from "../common/access/teacher-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { ChildAccessService, CHILD_READ_ROLES } from "./child-access.service";
import { CreateChildDto } from "./dto/create-child.dto";
import { UpdateChildDto } from "./dto/update-child.dto";

export interface ChildListFilters {
  familyId?: string;
  groupId?: string;
  status?: string;
}

@Injectable()
export class ChildrenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly teacherScope: TeacherScopeService,
    private readonly childAccess: ChildAccessService,
    private readonly audit: AuditService,
  ) {}

  async create(user: AuthenticatedUser, branchId: string, familyId: string, dto: CreateChildDto) {
    this.childAccess.assertWriteAccess(user, branchId);

    const family = await this.prisma.family.findUnique({ where: { id: familyId } });
    if (!family || family.branchId !== branchId) {
      throw new NotFoundException("Family not found");
    }

    const child = await this.prisma.child.create({
      data: {
        familyId,
        fullName: dto.fullName,
        birthDate: new Date(dto.birthDate),
        sex: dto.sex,
        status: "WAITLIST",
      },
    });

    await this.audit.record({
      entity: "child",
      entityId: child.id,
      action: "create",
      newValue: child,
      actorId: user.id,
    });
    return child;
  }

  async findAllForBranch(user: AuthenticatedUser, branchId: string, filters: ChildListFilters) {
    this.branchScope.assertBranchAccess(user, branchId);

    const isFullReader = this.branchScope.hasAnyRoleInBranch(user, CHILD_READ_ROLES, branchId);
    const isTeacher = this.branchScope.hasRoleInBranch(user, "TEACHER", branchId);

    const groupIdFilter = filters.groupId;

    if (!isFullReader) {
      if (!isTeacher) throw new ForbiddenException("No access to children in this branch");

      const assignedGroupIds = await this.teacherScope.getAssignedGroupIds(user.id, branchId);
      if (filters.groupId) {
        if (!assignedGroupIds.includes(filters.groupId)) {
          throw new ForbiddenException("Not assigned to this group");
        }
      } else if (assignedGroupIds.length === 0) {
        return [];
      } else {
        // Prisma "in" filter — a teacher with no explicit groupId sees the union of their groups.
        return this.prisma.child.findMany({
          where: {
            family: { branchId },
            groupId: { in: assignedGroupIds },
            ...(filters.familyId ? { familyId: filters.familyId } : {}),
            ...(filters.status ? { status: filters.status as never } : {}),
          },
          orderBy: { fullName: "asc" },
        });
      }
    }

    return this.prisma.child.findMany({
      where: {
        family: { branchId },
        ...(filters.familyId ? { familyId: filters.familyId } : {}),
        ...(groupIdFilter ? { groupId: groupIdFilter } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
      },
      orderBy: { fullName: "asc" },
    });
  }

  async findOne(user: AuthenticatedUser, branchId: string, id: string) {
    return this.childAccess.getReadableOrThrow(user, branchId, id);
  }

  async update(user: AuthenticatedUser, branchId: string, id: string, dto: UpdateChildDto) {
    this.childAccess.assertWriteAccess(user, branchId);
    const existing = await this.childAccess.getReadableOrThrow(user, branchId, id);

    const child = await this.prisma.child.update({
      where: { id },
      data: { ...dto, birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined },
    });

    await this.audit.record({
      entity: "child",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: child,
      actorId: user.id,
    });
    return child;
  }

  async history(user: AuthenticatedUser, branchId: string, id: string) {
    await this.childAccess.getReadableOrThrow(user, branchId, id);
    return this.prisma.childHistoryEntry.findMany({
      where: { childId: id },
      orderBy: { effectiveAt: "desc" },
    });
  }
}
