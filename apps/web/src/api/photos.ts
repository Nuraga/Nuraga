import { api } from "./client";
import type { Photo, PhotoConsentGap } from "./types";

export const photosApi = {
  list: (branchId: string, groupId: string) =>
    api.get<Photo[]>(`/branches/${branchId}/photos`, { groupId }),
  consentGaps: (branchId: string, groupId: string) =>
    api.get<PhotoConsentGap[]>(`/branches/${branchId}/photos/consent-gaps`, { groupId }),
  upload: (branchId: string, file: File, groupId: string, caption?: string, takenAt?: string) =>
    api.upload<Photo>(`/branches/${branchId}/photos`, file, { fields: { groupId, caption, takenAt } }),
  remove: (branchId: string, id: string) => api.delete<void>(`/branches/${branchId}/photos/${id}`),
};
