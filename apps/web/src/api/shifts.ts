import { api } from "./client";
import type { Shift } from "./types";

export interface CreateShiftInput {
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
  note?: string;
}

export const shiftsApi = {
  list: (branchId: string, from: string, to: string) =>
    api.get<Shift[]>(`/branches/${branchId}/shifts`, { from, to }),
  create: (branchId: string, dto: CreateShiftInput) =>
    api.post<Shift>(`/branches/${branchId}/shifts`, dto),
  remove: (branchId: string, id: string) => api.delete<void>(`/branches/${branchId}/shifts/${id}`),
};
