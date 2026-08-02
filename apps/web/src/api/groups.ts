import { api } from "./client";
import type { Group, GroupOccupancy } from "./types";

export interface CreateGroupInput {
  groupTypeId: string;
  name: string;
  plannedCapacity: number;
  maxCapacity: number;
}

export type UpdateGroupInput = Partial<CreateGroupInput> & { isActive?: boolean };

export const groupsApi = {
  list: (branchId: string) => api.get<Group[]>(`/branches/${branchId}/groups`),
  get: (branchId: string, id: string) => api.get<Group>(`/branches/${branchId}/groups/${id}`),
  occupancy: (branchId: string, id: string) =>
    api.get<GroupOccupancy>(`/branches/${branchId}/groups/${id}/occupancy`),
  create: (branchId: string, dto: CreateGroupInput) =>
    api.post<Group>(`/branches/${branchId}/groups`, dto),
  update: (branchId: string, id: string, dto: UpdateGroupInput) =>
    api.patch<Group>(`/branches/${branchId}/groups/${id}`, dto),
  archive: (branchId: string, id: string) =>
    api.post<Group>(`/branches/${branchId}/groups/${id}/archive`),
};
