import { api } from "./client";
import type { Staff } from "./types";

export interface CreateStaffInput {
  userId: string;
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
