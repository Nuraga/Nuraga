import { api } from "./client";
import type {
  AbsenceRequest,
  Attendance,
  ChildPhotoConsent,
  Family,
  FamilyBalance,
  Invoice,
  MealType,
  ParentPhoto,
  Payment,
} from "./types";

export interface CreateAbsenceRequestInput {
  dateFrom: string;
  dateTo: string;
  reason?: string;
}

export interface TodayMenuItem {
  mealType: MealType;
  dishName: string;
}

// No branchId anywhere here — a parent session is scoped to exactly one
// family via the JWT (server-side), not a branch role.
export const parentPortalApi = {
  me: () => api.get<Family>("/parent/me"),
  invoices: () => api.get<Invoice[]>("/parent/invoices"),
  payments: () => api.get<Payment[]>("/parent/payments"),
  balance: () => api.get<FamilyBalance>("/parent/balance"),
  childAttendance: (childId: string, from?: string, to?: string) =>
    api.get<Attendance[]>(`/parent/children/${childId}/attendance`, { from, to }),
  createAbsenceRequest: (childId: string, dto: CreateAbsenceRequestInput) =>
    api.post<AbsenceRequest>(`/parent/children/${childId}/absence-requests`, dto),
  listAbsenceRequests: () => api.get<AbsenceRequest[]>("/parent/absence-requests"),
  todayMenu: () => api.get<TodayMenuItem[]>("/parent/menu/today"),
  photos: () => api.get<ParentPhoto[]>("/parent/photos"),
  photoConsents: () => api.get<ChildPhotoConsent[]>("/parent/photo-consents"),
  setPhotoConsent: (childId: string, consent: boolean) =>
    api.post<ChildPhotoConsent>(`/parent/children/${childId}/photo-consent`, { consent }),
};
