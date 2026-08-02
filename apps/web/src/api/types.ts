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

// ---------------------------------------------------------------------------
// Billing (Этап 2)
// ---------------------------------------------------------------------------

export type TariffType = "MONTHLY_FULL" | "MONTHLY_HALF_DAY" | "HOURLY" | "PAY_AS_YOU_GO" | "DUTY_GROUP";
export type RecurrencePeriod = "MONTHLY" | "ONE_TIME" | "PER_VISIT";
export type RecalcRule = "NONE" | "MEALS_ONLY" | "FULL_DAY_WITH_THRESHOLD";

export const TARIFF_TYPES: TariffType[] = [
  "MONTHLY_FULL",
  "MONTHLY_HALF_DAY",
  "HOURLY",
  "PAY_AS_YOU_GO",
  "DUTY_GROUP",
];
export const RECURRENCE_PERIODS: RecurrencePeriod[] = ["MONTHLY", "ONE_TIME", "PER_VISIT"];
export const RECALC_RULES: RecalcRule[] = ["NONE", "MEALS_ONLY", "FULL_DAY_WITH_THRESHOLD"];

export interface Tariff {
  id: string;
  branchId: string | null;
  name: string;
  type: TariffType;
  baseAmountMinor: number;
  currency: string;
  recurrence: RecurrencePeriod;
  recalcRule: RecalcRule;
  recalcThresholdDays: number | null;
  includesDescription: string | null;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Service {
  id: string;
  branchId: string;
  name: string;
  priceMinor: number;
  scheduleInfo: string | null;
  capacity: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface ServiceEnrollment {
  id: string;
  childId: string;
  serviceId: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
}

export type DiscountBasis =
  | "SECOND_CHILD"
  | "PREPAYMENT"
  | "CORPORATE"
  | "STAFF"
  | "SOCIAL"
  | "DIRECTOR_DECISION";
export type DiscountKind = "PERCENT" | "FIXED_AMOUNT";

export const DISCOUNT_BASES: DiscountBasis[] = [
  "SECOND_CHILD",
  "PREPAYMENT",
  "CORPORATE",
  "STAFF",
  "SOCIAL",
  "DIRECTOR_DECISION",
];
export const DISCOUNT_KINDS: DiscountKind[] = ["PERCENT", "FIXED_AMOUNT"];

export interface Discount {
  id: string;
  familyId: string | null;
  childId: string | null;
  basis: DiscountBasis;
  kind: DiscountKind;
  value: number;
  reason: string | null;
  validFrom: string;
  validTo: string | null;
  approvedById: string;
  isActive: boolean;
  createdAt: string;
}

export type ContractStatus = "DRAFT" | "ACTIVE" | "TERMINATED" | "EXPIRED";

export interface Contract {
  id: string;
  familyId: string;
  childId: string;
  tariffId: string;
  number: string;
  startDate: string;
  endDate: string | null;
  status: ContractStatus;
  fileKey: string | null;
  createdAt: string;
  updatedAt: string;
  tariff?: Tariff;
}

export type InvoiceStatus = "DRAFT" | "APPROVED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

export interface Invoice {
  id: string;
  familyId: string;
  branchId: string;
  year: number;
  month: number;
  status: InvoiceStatus;
  totalMinor: number;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  family?: { id: string; name: string };
  lines?: InvoiceLine[];
}

export type InvoiceLineType =
  | "TARIFF"
  | "SERVICE"
  | "FINE"
  | "RECALC"
  | "DISCOUNT"
  | "MANUAL_ADJUSTMENT"
  | "PREVIOUS_BALANCE";

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  childId: string | null;
  serviceId: string | null;
  type: InvoiceLineType;
  description: string;
  amountMinor: number;
  ruleRef: string | null;
  createdAt: string;
}

export type PaymentMethod = "CASH" | "CARD_ONSITE" | "BANK_TRANSFER" | "ONLINE_GATEWAY";

export const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD_ONSITE", "BANK_TRANSFER", "ONLINE_GATEWAY"];

export interface Payment {
  id: string;
  familyId: string;
  branchId: string;
  amountMinor: number;
  method: PaymentMethod;
  paidAt: string;
  externalRef: string | null;
  recordedById: string;
  createdAt: string;
}

export interface FamilyBalance {
  totalPaidMinor: number;
  totalInvoicedMinor: number;
  balanceMinor: number;
}

export interface DebtReportRow {
  familyId: string;
  familyName: string;
  debtMinor: number;
  oldestUnpaidPeriod: { year: number; month: number } | null;
}

export interface DebtReport {
  branchId: string;
  families: DebtReportRow[];
  totalDebtMinor: number;
}

export interface GenerateInvoicesResult {
  totalFamilies: number;
  results: { familyId: string; status: string; totalMinor?: number }[];
}

/** Minor units -> a display string in the given currency (e.g. 30000 -> "300.00 KZT"). */
export function formatMinor(amountMinor: number, currency = "KZT"): string {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}
