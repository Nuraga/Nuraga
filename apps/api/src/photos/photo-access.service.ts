import { ForbiddenException, Injectable } from "@nestjs/common";
import type { Role } from "@prisma/client";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { TeacherScopeService } from "../common/access/teacher-scope.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

// Photos are grouped by class group and can show several children at once,
// so unlike Menu (branch-wide, open read) access is scoped per group:
// management roles see/manage every group in the branch, a TEACHER only
// their own assigned groups (TeacherScopeService) — same "own group" idiom
// as ChildAccessService.assertReadAccess.
export const PHOTO_STAFF_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER"];

@Injectable()
export class PhotoAccessService {
  constructor(
    private readonly branchScope: BranchScopeService,
    private readonly teacherScope: TeacherScopeService,
  ) {}

  async assertGroupAccess(user: AuthenticatedUser, branchId: string, groupId: string): Promise<void> {
    if (this.branchScope.hasAnyRoleInBranch(user, PHOTO_STAFF_ROLES, branchId)) return;

    if (this.branchScope.hasRoleInBranch(user, "TEACHER", branchId)) {
      const assigned = await this.teacherScope.isAssignedToGroup(user.id, branchId, groupId);
      if (assigned) return;
    }

    throw new ForbiddenException("No access to photos for this group");
  }

  canManage(user: AuthenticatedUser, branchId: string): boolean {
    return this.branchScope.hasAnyRoleInBranch(user, PHOTO_STAFF_ROLES, branchId);
  }
}
