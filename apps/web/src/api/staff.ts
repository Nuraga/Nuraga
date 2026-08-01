import { api } from "./client";
import type { Role, Staff } from "./types";

export const STAFF_GRANTABLE_ROLES: Role[] = ["BRANCH_MANAGER", "MANAGER", "ACCOUNTANT", "TEACHER"];

export interface CreateStaffInput {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  role: Role;
  position: string;
  hiredAt?: string;
}

export const staffApi = {
  list: (branchId: string) => api.get<Staff[]>(`/branches/${branchId}/staff`),
  create: (branchId: string, dto: CreateStaffInput) =>
    api.post<Staff>(`/branches/${branchId}/staff`, dto),
  assignGroup: (branchId: string, staffId: string, groupId: string) =>
    api.post<void>(`/branches/${branchId}/staff/${staffId}/groups/${groupId}`),
  unassignGroup: (branchId: string, staffId: string, groupId: string) =>
    api.delete<void>(`/branches/${branchId}/staff/${staffId}/groups/${groupId}`),
};
