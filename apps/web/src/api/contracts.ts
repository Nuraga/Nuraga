import { api } from "./client";
import type { Contract } from "./types";

export interface CreateContractInput {
  familyId: string;
  childId: string;
  tariffId: string;
  number: string;
  startDate: string;
  endDate?: string;
}

export const contractsApi = {
  listForFamily: (branchId: string, familyId: string) =>
    api.get<Contract[]>(`/branches/${branchId}/families/${familyId}/contracts`),
  create: (branchId: string, dto: CreateContractInput) =>
    api.post<Contract>(`/branches/${branchId}/contracts`, dto),
  changeTariff: (branchId: string, id: string, tariffId: string) =>
    api.post<Contract>(`/branches/${branchId}/contracts/${id}/change-tariff`, { tariffId }),
  terminate: (branchId: string, id: string) =>
    api.post<Contract>(`/branches/${branchId}/contracts/${id}/terminate`),
};
