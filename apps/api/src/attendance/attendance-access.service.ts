import { ForbiddenException, Injectable } from "@nestjs/common";
import type { Role } from "@prisma/client";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { TeacherScopeService } from "../common/access/teacher-scope.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

// Mirrors the matrix in children/child-access.service.ts: Owner/Branch
// Manager/Manager can mark and read attendance for any group in the branch;
// Accountant is read-only (needs it for the табель/payroll); Teacher is
// limited to groups they're assigned to via Staff/StaffGroup.
export const ATTENDANCE_MARK_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER"];
export const ATTENDANCE_READ_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT"];

@Injectable()
export class AttendanceAccessService {
  constructor(
    private readonly branchScope: BranchScopeService,
    private readonly teacherScope: TeacherScopeService,
  ) {}

  async assertMarkAccess(user: AuthenticatedUser, branchId: string, groupId: string): Promise<void> {
    if (this.branchScope.hasAnyRoleInBranch(user, ATTENDANCE_MARK_ROLES, branchId)) return;

    if (this.branchScope.hasRoleInBranch(user, "TEACHER", branchId)) {
      const assigned = await this.teacherScope.isAssignedToGroup(user.id, branchId, groupId);
      if (assigned) return;
    }

    throw new ForbiddenException("No access to mark attendance for this group");
  }

  async assertReadAccess(user: AuthenticatedUser, branchId: string, groupId: string): Promise<void> {
    if (this.branchScope.hasAnyRoleInBranch(user, ATTENDANCE_READ_ROLES, branchId)) return;

    if (this.branchScope.hasRoleInBranch(user, "TEACHER", branchId)) {
      const assigned = await this.teacherScope.isAssignedToGroup(user.id, branchId, groupId);
      if (assigned) return;
    }

    throw new ForbiddenException("No access to attendance for this group");
  }
}
