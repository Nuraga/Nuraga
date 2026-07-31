import { useAuth } from "./AuthContext";
import type { Role } from "../api/types";

export interface BranchRoleContext {
  roles: Role[];
  hasNetworkAccess: boolean;
}

/** Roles the current user holds in a given branch, mirroring BranchScopeService semantics. */
export function useBranchRoles(branchId: string | null): BranchRoleContext {
  const { user } = useAuth();
  if (!user || !branchId) return { roles: [], hasNetworkAccess: user?.hasNetworkAccess ?? false };
  const roles = user.grants.filter((g) => g.branchId === branchId).map((g) => g.role);
  return { roles, hasNetworkAccess: user.hasNetworkAccess };
}

export function hasAnyRole(ctx: BranchRoleContext, allowed: Role[]): boolean {
  return ctx.hasNetworkAccess || ctx.roles.some((r) => allowed.includes(r));
}
