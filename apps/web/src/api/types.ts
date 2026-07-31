import type { Role } from "@detsad/shared";

export type { Role };

export interface BranchGrant {
  branchId: string;
  role: Role;
}

export interface CurrentUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  grants: BranchGrant[];
  hasNetworkAccess: boolean;
}

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  locale: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupType {
  id: string;
  name: string;
  minAgeMonths: number;
  maxAgeMonths: number;
  isActive: boolean;
}

export interface Group {
  id: string;
  branchId: string;
  groupTypeId: string;
  name: string;
  plannedCapacity: number;
  maxCapacity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  groupType?: GroupType;
}

export interface GroupOccupancy {
  groupId: string;
  enrolled: number;
  plannedCapacity: number;
  maxCapacity: number;
  isOverPlanned: boolean;
  isOverMax: boolean;
}

export interface Staff {
  id: string;
  userId: string;
  branchId: string;
  position: string;
  hiredAt: string | null;
  createdAt: string;
  groups?: { staffId: string; groupId: string }[];
  user?: { id: string; fullName: string; email: string | null };
}

export interface Family {
  id: string;
  branchId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  parents?: Parent[];
  children?: Child[];
  trustedPersons?: TrustedPerson[];
}

export interface Parent {
  id: string;
  familyId: string;
  userId: string | null;
  fullName: string;
  relationship: string;
  contactPriority: number;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrustedPerson {
  id: string;
  familyId: string;
  fullName: string;
  documentInfo: string | null;
  photoKey: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export type ChildStatus = "WAITLIST" | "ENROLLED" | "SUSPENDED" | "DISCHARGED";

export interface Child {
  id: string;
  familyId: string;
  groupId: string | null;
  fullName: string;
  birthDate: string;
  sex: string | null;
  photoKey: string | null;
  status: ChildStatus;
  enrolledAt: string | null;
  suspendedAt: string | null;
  discharedAt: string | null;
  dischargeReasonId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ChildMedicalView =
  | {
      level: "full";
      allergies: string | null;
      chronic: string | null;
      activityLimits: string | null;
      doctorContact: string | null;
      criticalInfo: string | null;
    }
  | { level: "critical_only"; criticalInfo: string | null };

export interface UpsertChildMedicalInput {
  allergies?: string;
  chronic?: string;
  activityLimits?: string;
  doctorContact?: string;
  criticalInfo?: string;
}

export interface ChildHistoryEntry {
  id: string;
  childId: string;
  type: string;
  fromGroupId: string | null;
  toGroupId: string | null;
  effectiveAt: string;
  reason: string | null;
  actorUserId: string;
  createdAt: string;
}

export interface DocumentType {
  id: string;
  name: string;
  hasExpiry: boolean;
  isActive: boolean;
}

export interface ChildDocument {
  id: string;
  ownerType: "CHILD" | "STAFF";
  ownerId: string;
  documentTypeId: string;
  fileName: string;
  mimeType: string;
  expiresAt: string | null;
  uploadedById: string;
  createdAt: string;
  documentType?: DocumentType;
  downloadUrl?: string;
}

export interface DischargeReason {
  id: string;
  name: string;
  isActive: boolean;
}

export interface WaitlistEntry {
  id: string;
  branchId: string;
  groupId: string;
  childId: string | null;
  leadName: string | null;
  priority: number;
  queuedAt: string;
  child?: Child;
}

export type AttendanceStatus =
  | "PRESENT"
  | "ABSENT_SICK"
  | "ABSENT_EXCUSED"
  | "VACATION"
  | "LATE"
  | "UNMARKED";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "PRESENT",
  "ABSENT_SICK",
  "ABSENT_EXCUSED",
  "VACATION",
  "LATE",
  "UNMARKED",
];

export interface Attendance {
  id: string;
  childId: string;
  groupId: string;
  date: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  pickedUpById: string | null;
  pickedUpByType: string | null;
  markedById: string;
  createdAt: string;
  updatedAt: string;
}

export type TimesheetPeriodStatus = "OPEN" | "CLOSED";

export interface TimesheetPeriod {
  id: string;
  branchId: string;
  year: number;
  month: number;
  status: TimesheetPeriodStatus;
  closedById: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface ImportRowResult {
  row: number;
  status: "created" | "error";
  familyId?: string;
  childId?: string;
  errors?: string[];
}

export interface ImportReport {
  totalRows: number;
  created: number;
  failed: number;
  dryRun: boolean;
  results: ImportRowResult[];
}

export interface OccupancyReportRow extends GroupOccupancy {
  groupName: string;
  isActive: boolean;
}

export interface OccupancyReport {
  branchId: string;
  groups: OccupancyReportRow[];
  totals: { enrolled: number; plannedCapacity: number; maxCapacity: number };
}

export interface AttendanceSummaryRow extends Record<AttendanceStatus, number> {
  childId: string;
  fullName: string;
}

export interface AttendanceSummaryReport {
  branchId: string;
  groupId: string | null;
  year: number;
  month: number;
  children: AttendanceSummaryRow[];
}

export interface WaitlistReportRow {
  groupId: string;
  groupName: string;
  waitlisted: number;
}

export interface WaitlistReport {
  branchId: string;
  groups: WaitlistReportRow[];
  total: number;
}
