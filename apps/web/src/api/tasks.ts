import { api } from "./client";
import type { Task, TaskBoardStatus } from "./types";

export interface CreateTaskInput {
  leadId?: string;
  familyId?: string;
  description: string;
  dueAt: string;
  assignedToId: string;
}

export interface TaskFilters {
  leadId?: string;
  familyId?: string;
  assignedToId?: string;
  onlyOpen?: boolean;
  /** "staff" restricts to general staff assignments (no lead/family link) — used by the kanban board. */
  scope?: "staff";
}

export const tasksApi = {
  list: (branchId: string, filters: TaskFilters = {}) =>
    api.get<Task[]>(`/branches/${branchId}/tasks`, { ...filters }),
  create: (branchId: string, dto: CreateTaskInput) => api.post<Task>(`/branches/${branchId}/tasks`, dto),
  complete: (branchId: string, id: string) => api.post<Task>(`/branches/${branchId}/tasks/${id}/complete`),
  updateStatus: (branchId: string, id: string, status: TaskBoardStatus) =>
    api.patch<Task>(`/branches/${branchId}/tasks/${id}/status`, { status }),
};
