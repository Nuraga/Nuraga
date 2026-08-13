import { api } from "./client";
import type { Role, Staff, StaffVacation } from "./types";

// Network-wide fallback when a Staff row has no individual override — kept
// in sync with DEFAULT_CHECK_IN_TIME/DEFAULT_CHECK_OUT_TIME in
// staff-attendance.service.ts (used only as UI placeholder text here).
export const DEFAULT_CHECK_IN_TIME = "08:00";
export const DEFAULT_CHECK_OUT_TIME = "18:00";

export const STAFF_GRANTABLE_ROLES: Role[] = [
  "BRANCH_MANAGER",
  "MANAGER",
  "ACCOUNTANT",
  "TEACHER",
  "NANNY",
  "METHODIST",
];

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
  list: (branchId: string, includeTerminated = false) =>
    api.get<Staff[]>(`/branches/${branchId}/staff${includeTerminated ? "?includeTerminated=true" : ""}`),
  create: (branchId: string, dto: CreateStaffInput) =>
    api.post<Staff>(`/branches/${branchId}/staff`, dto),
  terminate: (branchId: string, staffId: string, reason?: string) =>
    api.delete<Staff>(`/branches/${branchId}/staff/${staffId}`, reason ? { reason } : undefined),
  assignGroup: (branchId: string, staffId: string, groupId: string) =>
    api.post<void>(`/branches/${branchId}/staff/${staffId}/groups/${groupId}`),
  unassignGroup: (branchId: string, staffId: string, groupId: string) =>
    api.delete<void>(`/branches/${branchId}/staff/${staffId}/groups/${groupId}`),
  updateSchedule: (branchId: string, staffId: string, checkInTime: string | null, checkOutTime: string | null) =>
    api.patch<Staff>(`/branches/${branchId}/staff/${staffId}/schedule`, { checkInTime, checkOutTime }),
  addVacation: (branchId: string, staffId: string, startDate: string, endDate: string, note?: string) =>
    api.post<StaffVacation>(`/branches/${branchId}/staff/${staffId}/vacations`, { startDate, endDate, note }),
  removeVacation: (branchId: string, staffId: string, vacationId: string) =>
    api.delete<void>(`/branches/${branchId}/staff/${staffId}/vacations/${vacationId}`),
};
