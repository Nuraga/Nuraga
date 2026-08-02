import { api } from "./client";
import type { FamilyBalance, Payment, PaymentMethod } from "./types";

export interface RecordPaymentInput {
  amountMinor: number;
  method: PaymentMethod;
  paidAt: string;
  externalRef?: string;
}

export const paymentsApi = {
  record: (branchId: string, familyId: string, dto: RecordPaymentInput) =>
    api.post<Payment>(`/branches/${branchId}/families/${familyId}/payments`, dto),
  listForFamily: (branchId: string, familyId: string) =>
    api.get<Payment[]>(`/branches/${branchId}/families/${familyId}/payments`),
  getBalance: (branchId: string, familyId: string) =>
    api.get<FamilyBalance>(`/branches/${branchId}/families/${familyId}/balance`),
};
