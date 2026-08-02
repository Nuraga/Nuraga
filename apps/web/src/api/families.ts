import { api } from "./client";
import type { Family, Parent, TrustedPerson } from "./types";

export interface CreateParentInput {
  fullName: string;
  relationship: string;
  contactPriority?: number;
  phone?: string;
  email?: string;
}

export interface CreateTrustedPersonInput {
  fullName: string;
  documentInfo?: string;
  expiresAt?: string;
}

export interface CreateParentAccountInput {
  password: string;
  email?: string;
  phone?: string;
}

export const familiesApi = {
  list: (branchId: string, search?: string) =>
    api.get<Family[]>(`/branches/${branchId}/families`, { search }),
  get: (branchId: string, id: string) => api.get<Family>(`/branches/${branchId}/families/${id}`),
  create: (branchId: string, dto: { name: string }) =>
    api.post<Family>(`/branches/${branchId}/families`, dto),
  update: (branchId: string, id: string, dto: { name: string }) =>
    api.patch<Family>(`/branches/${branchId}/families/${id}`, dto),

  addParent: (branchId: string, familyId: string, dto: CreateParentInput) =>
    api.post<Parent>(`/branches/${branchId}/families/${familyId}/parents`, dto),
  updateParent: (branchId: string, familyId: string, parentId: string, dto: Partial<CreateParentInput>) =>
    api.patch<Parent>(`/branches/${branchId}/families/${familyId}/parents/${parentId}`, dto),
  removeParent: (branchId: string, familyId: string, parentId: string) =>
    api.delete<void>(`/branches/${branchId}/families/${familyId}/parents/${parentId}`),
  provisionParentAccount: (
    branchId: string,
    familyId: string,
    parentId: string,
    dto: CreateParentAccountInput,
  ) => api.post<Parent>(`/branches/${branchId}/families/${familyId}/parents/${parentId}/account`, dto),

  addTrustedPerson: (branchId: string, familyId: string, dto: CreateTrustedPersonInput) =>
    api.post<TrustedPerson>(`/branches/${branchId}/families/${familyId}/trusted-persons`, dto),
  updateTrustedPerson: (
    branchId: string,
    familyId: string,
    personId: string,
    dto: Partial<CreateTrustedPersonInput>,
  ) =>
    api.patch<TrustedPerson>(
      `/branches/${branchId}/families/${familyId}/trusted-persons/${personId}`,
      dto,
    ),
  removeTrustedPerson: (branchId: string, familyId: string, personId: string) =>
    api.delete<void>(`/branches/${branchId}/families/${familyId}/trusted-persons/${personId}`),
};
