import { api } from "./client";
import type { Child, WaitlistEntry } from "./types";

export interface EnrollInput {
  groupId: string;
  effectiveAt?: string;
  confirmOverride?: boolean;
}
export interface TransferInput {
  toGroupId: string;
  effectiveAt?: string;
  confirmOverride?: boolean;
}
export interface SuspendInput {
  effectiveAt?: string;
  reason?: string;
}
export interface ResumeInput {
  effectiveAt?: string;
  confirmOverride?: boolean;
}
export interface DischargeInput {
  dischargeReasonId: string;
  effectiveAt?: string;
}
export interface PromoteGroupInput {
  toGroupId?: string;
  dischargeReasonId?: string;
}

export interface PromotionResult {
  total: number;
  succeeded: string[];
  failed: { childId: string; error: string }[];
}

export const enrollmentApi = {
  enroll: (branchId: string, childId: string, dto: EnrollInput) =>
    api.post<Child>(`/branches/${branchId}/children/${childId}/enroll`, dto),
  transfer: (branchId: string, childId: string, dto: TransferInput) =>
    api.post<Child>(`/branches/${branchId}/children/${childId}/transfer`, dto),
  suspend: (branchId: string, childId: string, dto: SuspendInput) =>
    api.post<Child>(`/branches/${branchId}/children/${childId}/suspend`, dto),
  resume: (branchId: string, childId: string, dto: ResumeInput) =>
    api.post<Child>(`/branches/${branchId}/children/${childId}/resume`, dto),
  discharge: (branchId: string, childId: string, dto: DischargeInput) =>
    api.post<Child>(`/branches/${branchId}/children/${childId}/discharge`, dto),
  promoteGroup: (branchId: string, groupId: string, dto: PromoteGroupInput) =>
    api.post<PromotionResult>(`/branches/${branchId}/groups/${groupId}/promote`, dto),
};

export const waitlistApi = {
  list: (branchId: string, groupId: string, limit?: number) =>
    api.get<WaitlistEntry[]>(`/branches/${branchId}/groups/${groupId}/waitlist`, { limit }),
  add: (
    branchId: string,
    groupId: string,
    dto: { childId?: string; leadId?: string; priority?: number },
  ) => api.post<WaitlistEntry>(`/branches/${branchId}/groups/${groupId}/waitlist`, dto),
  remove: (branchId: string, groupId: string, entryId: string) =>
    api.delete<void>(`/branches/${branchId}/groups/${groupId}/waitlist/${entryId}`),
};
