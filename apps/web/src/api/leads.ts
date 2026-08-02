import { api } from "./client";
import type { AssignableLeadStage, Lead, LeadDuplicate, LeadActivity, LeadStage } from "./types";

export interface CreateLeadInput {
  parentFullName: string;
  parentPhone: string;
  parentEmail?: string;
  childFullName?: string;
  childBirthDate?: string;
  targetDate?: string;
  sourceId?: string;
  responsibleUserId: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  confirmDuplicate?: boolean;
}

export type UpdateLeadInput = Partial<Omit<CreateLeadInput, "confirmDuplicate">>;

export interface UpdateLeadStageInput {
  stage: AssignableLeadStage;
  rejectionReasonId?: string;
  rejectionComment?: string;
}

export interface ConvertLeadInput {
  parentFullName: string;
  parentRelationship: string;
  parentPhone?: string;
  parentEmail?: string;
  childFullName: string;
  childBirthDate: string;
  childSex?: string;
  groupId?: string;
  tariffId: string;
  contractNumber: string;
  contractStartDate: string;
  confirmOverride?: boolean;
}

export interface ConvertLeadResult {
  familyId: string;
  childId: string;
  contractId: string;
}

export interface LeadFilters {
  stage?: LeadStage;
  sourceId?: string;
  responsibleUserId?: string;
  q?: string;
}

export const leadsApi = {
  list: (branchId: string, filters: LeadFilters = {}) =>
    api.get<Lead[]>(`/branches/${branchId}/leads`, { ...filters }),
  listNeedingAttention: (branchId: string) =>
    api.get<Lead[]>(`/branches/${branchId}/leads/needing-attention`),
  checkDuplicates: (branchId: string, phone: string) =>
    api.get<{ duplicates: LeadDuplicate[] }>(`/branches/${branchId}/leads/duplicates`, { phone }),
  get: (branchId: string, id: string) => api.get<Lead>(`/branches/${branchId}/leads/${id}`),
  create: (branchId: string, dto: CreateLeadInput) => api.post<Lead>(`/branches/${branchId}/leads`, dto),
  update: (branchId: string, id: string, dto: UpdateLeadInput) =>
    api.patch<Lead>(`/branches/${branchId}/leads/${id}`, dto),
  updateStage: (branchId: string, id: string, dto: UpdateLeadStageInput) =>
    api.patch<Lead>(`/branches/${branchId}/leads/${id}/stage`, dto),
  convert: (branchId: string, id: string, dto: ConvertLeadInput) =>
    api.post<ConvertLeadResult>(`/branches/${branchId}/leads/${id}/convert`, dto),
  remove: (branchId: string, id: string) => api.delete<void>(`/branches/${branchId}/leads/${id}`),
  addActivity: (branchId: string, id: string, content: string) =>
    api.post<LeadActivity>(`/branches/${branchId}/leads/${id}/activities`, { content }),
};
