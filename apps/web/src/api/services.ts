import { api } from "./client";
import type { Service, ServiceEnrollment } from "./types";

export interface CreateServiceInput {
  name: string;
  priceMinor: number;
  scheduleInfo?: string;
  capacity?: number;
}

export type UpdateServiceInput = Partial<CreateServiceInput> & { isActive?: boolean };

export const servicesApi = {
  listForBranch: (branchId: string) => api.get<Service[]>(`/branches/${branchId}/services`),
  create: (branchId: string, dto: CreateServiceInput) =>
    api.post<Service>(`/branches/${branchId}/services`, dto),
  update: (branchId: string, id: string, dto: UpdateServiceInput) =>
    api.patch<Service>(`/branches/${branchId}/services/${id}`, dto),
  archive: (branchId: string, id: string) =>
    api.post<Service>(`/branches/${branchId}/services/${id}/archive`),
  enrollChild: (branchId: string, childId: string, serviceId: string, dto: { startDate: string; endDate?: string }) =>
    api.post<ServiceEnrollment>(`/branches/${branchId}/children/${childId}/services/${serviceId}`, dto),
  unenrollChild: (branchId: string, enrollmentId: string) =>
    api.delete<void>(`/branches/${branchId}/service-enrollments/${enrollmentId}`),
};
