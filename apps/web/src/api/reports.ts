import { api } from "./client";
import type { AttendanceSummaryReport, OccupancyReport, WaitlistReport } from "./types";

export const reportsApi = {
  occupancy: (branchId: string) => api.get<OccupancyReport>(`/branches/${branchId}/reports/occupancy`),
  attendanceSummary: (branchId: string, year: number, month: number, groupId?: string) =>
    api.get<AttendanceSummaryReport>(`/branches/${branchId}/reports/attendance-summary`, {
      year,
      month,
      groupId,
    }),
  waitlist: (branchId: string) => api.get<WaitlistReport>(`/branches/${branchId}/reports/waitlist`),
};
