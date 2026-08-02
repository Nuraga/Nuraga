import { api } from "./client";
import type { GenerateInvoicesResult, Invoice } from "./types";

export const invoicingApi = {
  generate: (branchId: string, year: number, month: number) =>
    api.post<GenerateInvoicesResult>(`/branches/${branchId}/invoices/generate`, { year, month }),
  listForBranch: (branchId: string, year?: number, month?: number) =>
    api.get<Invoice[]>(`/branches/${branchId}/invoices`, { year, month }),
  listForFamily: (branchId: string, familyId: string) =>
    api.get<Invoice[]>(`/branches/${branchId}/families/${familyId}/invoices`),
  getOne: (branchId: string, id: string) => api.get<Invoice>(`/branches/${branchId}/invoices/${id}`),
  addAdjustment: (
    branchId: string,
    id: string,
    dto: { description: string; amountMinor: number; comment: string; childId?: string },
  ) => api.post<Invoice>(`/branches/${branchId}/invoices/${id}/adjustments`, dto),
  approve: (branchId: string, id: string) => api.post<Invoice>(`/branches/${branchId}/invoices/${id}/approve`),
};
