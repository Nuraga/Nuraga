import type { Role } from "@prisma/client";

export interface BranchGrant {
  branchId: string;
  role: Role;
}

// Roles that conceptually operate network-wide rather than per-branch
// (TRD 2.1: "Вся сеть + системные настройки" / "Все филиалы, все данные").
// A single grant in either role, in any branch, gives access to all branches.
export const NETWORK_WIDE_ROLES: Role[] = ["SUPERADMIN", "OWNER"];

export interface ParentProfile {
  id: string;
  familyId: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  grants: BranchGrant[];
  hasNetworkAccess: boolean;
  /** Set when this user is a parent's login (Parent.userId), never alongside branch grants in practice. */
  parentProfile?: ParentProfile | null;
}
