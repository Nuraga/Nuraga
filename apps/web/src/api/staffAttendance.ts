import { api } from "./client";

export interface CheckinToken {
  qrCodeDataUrl: string;
  expiresAt: string;
}

export type StaffAttendanceEventType = "CHECK_IN" | "CHECK_OUT";
export type StaffAttendanceEventSource = "QR" | "MANUAL_CORRECTION" | "AUTO_CLOSE";

export interface StaffAttendanceEvent {
  id: string;
  staffId: string;
  branchId: string;
  type: StaffAttendanceEventType;
  source: StaffAttendanceEventSource;
  occurredAt: string;
  deviceId: string | null;
  correctionReason: string | null;
  correctionById: string | null;
  createdAt: string;
  /** CHECK_IN after the staff member's expected time (individual or the 08:00 network default). Always false for CHECK_OUT. */
  isLate: boolean;
}

export interface StaffAttendanceDaySummary {
  date: string;
  workedMinutes: number;
}

export interface PresentStaff {
  staffId: string;
  fullName: string;
  checkedInAt: string;
  isLate: boolean;
}

export interface CorrectStaffAttendanceInput {
  staffId: string;
  type: StaffAttendanceEventType;
  occurredAt: string;
  reason: string;
}

export const staffAttendanceApi = {
  myCheckinToken: (branchId: string) => api.get<CheckinToken>(`/branches/${branchId}/staff/me/checkin-token`),
  present: (branchId: string) => api.get<PresentStaff[]>(`/branches/${branchId}/staff-attendance/present`),
  listForStaff: (branchId: string, staffId: string, filters: { from?: string; to?: string } = {}) =>
    api.get<{ events: StaffAttendanceEvent[]; dailySummaries: StaffAttendanceDaySummary[] }>(
      `/branches/${branchId}/staff/${staffId}/attendance-events`,
      { ...filters },
    ),
  correct: (branchId: string, dto: CorrectStaffAttendanceInput) =>
    api.post<StaffAttendanceEvent>(`/branches/${branchId}/staff-attendance/correct`, dto),
};
