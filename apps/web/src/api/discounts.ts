import { api } from "./client";
import type { Discount, DiscountBasis, DiscountKind } from "./types";

export interface CreateDiscountInput {
  familyId?: string;
  childId?: string;
  basis: DiscountBasis;
  kind: DiscountKind;
  value: number;
  reason?: string;
  validFrom: string;
  validTo?: string;
}

export interface UpdateDiscountInput {
  value?: number;
  reason?: string;
  validTo?: string;
  isActive?: boolean;
}

export const discountsApi = {
  listForFamily: (branchId: string, familyId: string) =>
    api.get<Discount[]>(`/branches/${branchId}/families/${familyId}/discounts`),
  create: (branchId: string, dto: CreateDiscountInput) =>
    api.post<Discount>(`/branches/${branchId}/discounts`, dto),
  update: (branchId: string, id: string, dto: UpdateDiscountInput) =>
    api.patch<Discount>(`/branches/${branchId}/discounts/${id}`, dto),
  archive: (branchId: string, id: string) =>
    api.post<Discount>(`/branches/${branchId}/discounts/${id}/archive`),
};
