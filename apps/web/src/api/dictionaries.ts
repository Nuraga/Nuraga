import { api } from "./client";
import type { DischargeReason, DocumentType, GroupType, LeadRejectionReason, LeadSource } from "./types";

export const groupTypesApi = {
  list: () => api.get<GroupType[]>("/group-types"),
  create: (dto: { name: string; minAgeMonths: number; maxAgeMonths: number }) =>
    api.post<GroupType>("/group-types", dto),
  update: (
    id: string,
    dto: Partial<{ name: string; minAgeMonths: number; maxAgeMonths: number; isActive: boolean }>,
  ) => api.patch<GroupType>(`/group-types/${id}`, dto),
  archive: (id: string) => api.post<GroupType>(`/group-types/${id}/archive`),
};

export const dischargeReasonsApi = {
  list: () => api.get<DischargeReason[]>("/discharge-reasons"),
  create: (dto: { name: string }) => api.post<DischargeReason>("/discharge-reasons", dto),
  update: (id: string, dto: Partial<{ name: string; isActive: boolean }>) =>
    api.patch<DischargeReason>(`/discharge-reasons/${id}`, dto),
  archive: (id: string) => api.post<DischargeReason>(`/discharge-reasons/${id}/archive`),
};

export const documentTypesApi = {
  list: () => api.get<DocumentType[]>("/document-types"),
  create: (dto: { name: string; hasExpiry?: boolean }) =>
    api.post<DocumentType>("/document-types", dto),
  update: (id: string, dto: Partial<{ name: string; hasExpiry: boolean; isActive: boolean }>) =>
    api.patch<DocumentType>(`/document-types/${id}`, dto),
  archive: (id: string) => api.post<DocumentType>(`/document-types/${id}/archive`),
};

export const leadSourcesApi = {
  list: () => api.get<LeadSource[]>("/lead-sources"),
  create: (dto: { name: string }) => api.post<LeadSource>("/lead-sources", dto),
  update: (id: string, dto: Partial<{ name: string; isActive: boolean }>) =>
    api.patch<LeadSource>(`/lead-sources/${id}`, dto),
  archive: (id: string) => api.post<LeadSource>(`/lead-sources/${id}/archive`),
};

export const leadRejectionReasonsApi = {
  list: () => api.get<LeadRejectionReason[]>("/lead-rejection-reasons"),
  create: (dto: { name: string }) => api.post<LeadRejectionReason>("/lead-rejection-reasons", dto),
  update: (id: string, dto: Partial<{ name: string; isActive: boolean }>) =>
    api.patch<LeadRejectionReason>(`/lead-rejection-reasons/${id}`, dto),
  archive: (id: string) => api.post<LeadRejectionReason>(`/lead-rejection-reasons/${id}/archive`),
};
