import { api } from "./client";
import type { RecalcRule, RecurrencePeriod, Tariff, TariffType } from "./types";

export interface CreateTariffInput {
  branchId?: string;
  name: string;
  type: TariffType;
  baseAmountMinor: number;
  currency?: string;
  recurrence: RecurrencePeriod;
  recalcRule?: RecalcRule;
  recalcThresholdDays?: number;
  includesDescription?: string;
  validFrom: string;
  validTo?: string;
}

export interface UpdateTariffInput {
  name?: string;
  recalcRule?: RecalcRule;
  recalcThresholdDays?: number;
  includesDescription?: string;
  validTo?: string;
  isActive?: boolean;
}

export const tariffsApi = {
  listForBranch: (branchId: string) => api.get<Tariff[]>(`/branches/${branchId}/tariffs`),
  create: (dto: CreateTariffInput) => api.post<Tariff>("/tariffs", dto),
  update: (id: string, dto: UpdateTariffInput) => api.patch<Tariff>(`/tariffs/${id}`, dto),
  archive: (id: string) => api.post<Tariff>(`/tariffs/${id}/archive`),
};
