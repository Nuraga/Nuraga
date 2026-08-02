import { api } from "./client";
import type {
  AllergenTag,
  Child,
  ChildDocument,
  ChildHistoryEntry,
  ChildMedicalView,
  UpsertChildMedicalInput,
} from "./types";

export interface CreateChildInput {
  fullName: string;
  birthDate: string;
  sex?: string;
}

export type UpdateChildInput = Partial<CreateChildInput> & { photoKey?: string };

export interface ChildListFilters {
  familyId?: string;
  groupId?: string;
  status?: string;
}

export const childrenApi = {
  list: (branchId: string, filters: ChildListFilters = {}) =>
    api.get<Child[]>(`/branches/${branchId}/children`, { ...filters }),
  get: (branchId: string, id: string) => api.get<Child>(`/branches/${branchId}/children/${id}`),
  create: (branchId: string, familyId: string, dto: CreateChildInput) =>
    api.post<Child>(`/branches/${branchId}/families/${familyId}/children`, dto),
  update: (branchId: string, id: string, dto: UpdateChildInput) =>
    api.patch<Child>(`/branches/${branchId}/children/${id}`, dto),
  history: (branchId: string, id: string) =>
    api.get<ChildHistoryEntry[]>(`/branches/${branchId}/children/${id}/history`),

  getMedical: (branchId: string, id: string) =>
    api.get<ChildMedicalView>(`/branches/${branchId}/children/${id}/medical`),
  upsertMedical: (branchId: string, id: string, dto: UpsertChildMedicalInput) =>
    api.put<ChildMedicalView>(`/branches/${branchId}/children/${id}/medical`, dto),
  setAllergens: (branchId: string, id: string, allergenIds: string[]) =>
    api.put<AllergenTag[]>(`/branches/${branchId}/children/${id}/allergens`, { allergenIds }),

  listDocuments: (branchId: string, id: string) =>
    api.get<ChildDocument[]>(`/branches/${branchId}/children/${id}/documents`),
  uploadDocument: (branchId: string, id: string, file: File, documentTypeId: string, expiresAt?: string) =>
    api.upload<ChildDocument>(`/branches/${branchId}/children/${id}/documents`, file, {
      fields: { documentTypeId, expiresAt },
    }),
  removeDocument: (branchId: string, id: string, documentId: string) =>
    api.delete<void>(`/branches/${branchId}/children/${id}/documents/${documentId}`),
  listExpiringDocuments: (branchId: string, days?: number) =>
    api.get<ChildDocument[]>(`/branches/${branchId}/documents/expiring`, { days }),
};
