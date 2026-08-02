import { api } from "./client";
import type { Attendance, AttendanceStatus, Child, TimesheetPeriod } from "./types";

export interface MarkAttendanceInput {
  date: string;
  status: AttendanceStatus;
  checkInAt?: string;
  checkOutAt?: string;
  pickedUpById?: string;
  pickedUpByType?: "parent" | "trusted_person";
}

export interface CorrectAttendanceInput extends Partial<MarkAttendanceInput> {
  reason: string;
}

export interface RosterEntry {
  child: Child;
  attendance: Attendance | null;
}

export const attendanceApi = {
  mark: (branchId: string, childId: string, dto: MarkAttendanceInput) =>
    api.post<Attendance>(`/branches/${branchId}/children/${childId}/attendance`, dto),
  roster: (branchId: string, groupId: string, date: string) =>
    api.get<RosterEntry[]>(`/branches/${branchId}/groups/${groupId}/attendance`, { date }),
  history: (branchId: string, childId: string, from?: string, to?: string) =>
    api.get<Attendance[]>(`/branches/${branchId}/children/${childId}/attendance`, { from, to }),
};

export const timesheetsApi = {
  listPeriods: (branchId: string) => api.get<TimesheetPeriod[]>(`/branches/${branchId}/timesheet-periods`),
  closePeriod: (branchId: string, year: number, month: number) =>
    api.post<TimesheetPeriod>(`/branches/${branchId}/timesheet-periods/${year}/${month}/close`),
  correctAttendance: (branchId: string, attendanceId: string, dto: CorrectAttendanceInput) =>
    api.post<Attendance>(`/branches/${branchId}/attendance/${attendanceId}/correct`, dto),
};
