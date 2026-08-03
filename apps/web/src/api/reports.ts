import { api } from "./client";
import type {
  AttendanceSummaryReport,
  DebtReport,
  DiscountsReport,
  FunnelReport,
  InvoicesReport,
  OccupancyReport,
  PaymentsReport,
  PortionsReport,
  WaitlistReport,
} from "./types";

export const reportsApi = {
  occupancy: (branchId: string) => api.get<OccupancyReport>(`/branches/${branchId}/reports/occupancy`),
  attendanceSummary: (branchId: string, year: number, month: number, groupId?: string) =>
    api.get<AttendanceSummaryReport>(`/branches/${branchId}/reports/attendance-summary`, {
      year,
      month,
      groupId,
    }),
  waitlist: (branchId: string) => api.get<WaitlistReport>(`/branches/${branchId}/reports/waitlist`),
  debt: (branchId: string) => api.get<DebtReport>(`/branches/${branchId}/reports/debt`),
  invoices: (branchId: string, year: number, month: number) =>
    api.get<InvoicesReport>(`/branches/${branchId}/reports/invoices`, { year, month }),
  payments: (branchId: string, year: number, month: number) =>
    api.get<PaymentsReport>(`/branches/${branchId}/reports/payments`, { year, month }),
  discounts: (branchId: string, activeOnly = true) =>
    api.get<DiscountsReport>(`/branches/${branchId}/reports/discounts`, { activeOnly }),
  portions: (branchId: string, date: string) =>
    api.get<PortionsReport>(`/branches/${branchId}/reports/portions`, { date }),
  funnel: (branchId: string, year: number, month: number) =>
    api.get<FunnelReport>(`/branches/${branchId}/reports/funnel`, { year, month }),
};
