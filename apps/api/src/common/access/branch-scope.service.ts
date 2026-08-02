import { ForbiddenException, Injectable } from "@nestjs/common";
import type { Role } from "@prisma/client";
import type { AuthenticatedUser } from "./branch-access.types";

// Central place for the branch-scoping rule required by TRD 11.1: no query
// may read a row whose branch_id the caller wasn't granted, and that check
// must never be left to be reimplemented ad hoc in each handler.
@Injectable()
export class BranchScopeService {
  /** Branch ids the user may access, or "all" for network-wide roles. */
  accessibleBranchIds(user: AuthenticatedUser): string[] | "all" {
    if (user.hasNetworkAccess) return "all";
    return [...new Set(user.grants.map((g) => g.branchId))];
  }

  canAccessBranch(user: AuthenticatedUser, branchId: string): boolean {
    if (user.hasNetworkAccess) return true;
    return user.grants.some((g) => g.branchId === branchId);
  }

  assertBranchAccess(user: AuthenticatedUser, branchId: string): void {
    if (!this.canAccessBranch(user, branchId)) {
      throw new ForbiddenException("No access to this branch");
    }
  }

  /** Prisma `where` fragment restricting rows to the user's accessible branches. */
  branchFilter(user: AuthenticatedUser): { branchId?: { in: string[] } } {
    const ids = this.accessibleBranchIds(user);
    return ids === "all" ? {} : { branchId: { in: ids } };
  }

  hasRoleInBranch(user: AuthenticatedUser, role: Role, branchId: string): boolean {
    if (user.hasNetworkAccess) return true;
    return user.grants.some((g) => g.branchId === branchId && g.role === role);
  }

  hasAnyRole(user: AuthenticatedUser, roles: Role[]): boolean {
    if (user.hasNetworkAccess) return true;
    return user.grants.some((g) => roles.includes(g.role));
  }

  hasAnyRoleInBranch(user: AuthenticatedUser, roles: Role[], branchId: string): boolean {
    if (user.hasNetworkAccess) return true;
    return user.grants.some((g) => g.branchId === branchId && roles.includes(g.role));
  }

  /** Throws unless the user holds one of `roles` specifically within `branchId`. */
  assertRoleInBranch(user: AuthenticatedUser, roles: Role[], branchId: string): void {
    if (!this.hasAnyRoleInBranch(user, roles, branchId)) {
      throw new ForbiddenException("Insufficient role for this branch");
    }
  }
}
