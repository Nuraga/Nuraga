import { api } from "./client";
import type { Branch } from "./types";

export interface CreateBranchInput {
  name: string;
  address?: string;
  locale?: string;
  timezone?: string;
}

export type UpdateBranchInput = Partial<CreateBranchInput> & { isActive?: boolean };

export const branchesApi = {
  list: () => api.get<Branch[]>("/branches"),
  get: (id: string) => api.get<Branch>(`/branches/${id}`),
  create: (dto: CreateBranchInput) => api.post<Branch>("/branches", dto),
  update: (id: string, dto: UpdateBranchInput) => api.patch<Branch>(`/branches/${id}`, dto),
  archive: (id: string) => api.post<Branch>(`/branches/${id}/archive`),
};
