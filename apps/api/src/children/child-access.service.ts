import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Role, Child } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { TeacherScopeService } from "../common/access/teacher-scope.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

// Matrix (TRD 2.2, "Карточка ребёнка" row): Owner/Branch Manager get full
// ПСРУ, Manager gets ПСР (no delete/archive — that's the discharge flow),
// Accountant gets read-only, Teacher gets read-only limited to their own
// groups. Shared by ChildrenService, ChildMedicalService, DocumentsService
// so the "own group" rule is defined exactly once.
export const CHILD_READ_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT"];
export const CHILD_WRITE_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER"];

@Injectable()
export class ChildAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly teacherScope: TeacherScopeService,
  ) {}

  async assertReadAccess(user: AuthenticatedUser, branchId: string, child: Child): Promise<void> {
    if (this.branchScope.hasAnyRoleInBranch(user, CHILD_READ_ROLES, branchId)) return;

    if (this.branchScope.hasRoleInBranch(user, "TEACHER", branchId) && child.groupId) {
      const assigned = await this.teacherScope.isAssignedToGroup(user.id, branchId, child.groupId);
      if (assigned) return;
    }

    throw new ForbiddenException("No access to this child");
  }

  assertWriteAccess(user: AuthenticatedUser, branchId: string): void {
    this.branchScope.assertRoleInBranch(user, CHILD_WRITE_ROLES, branchId);
  }

  /** Fetches a child and enforces both branch ownership (IDOR) and read access. */
  async getReadableOrThrow(user: AuthenticatedUser, branchId: string, childId: string) {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child) throw new NotFoundException("Child not found");

    const family = await this.prisma.family.findUnique({ where: { id: child.familyId } });
    if (!family || family.branchId !== branchId) {
      throw new NotFoundException("Child not found");
    }

    await this.assertReadAccess(user, branchId, child);
    return child;
  }
}
