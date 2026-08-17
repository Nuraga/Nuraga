import type { Role } from "@detsad/shared";

export type { Role };

export interface BranchGrant {
  branchId: string;
  role: Role;
}

export interface ParentProfile {
  id: string;
  familyId: string;
}

export interface CurrentUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  grants: BranchGrant[];
  hasNetworkAccess: boolean;
  parentProfile: ParentProfile | null;
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

export interface StaffVacation {
  id: string;
  staffId: string;
  branchId: string;
  startDate: string;
  endDate: string;
  note: string | null;
  createdById: string;
  createdAt: string;
}

export interface Staff {
  id: string;
  userId: string;
  branchId: string;
  position: string;
  hiredAt: string | null;
  terminatedAt: string | null;
  expectedCheckInTime: string | null;
  expectedCheckOutTime: string | null;
  createdAt: string;
  groups?: { staffId: string; groupId: string }[];
  user?: { id: string; fullName: string; email: string | null };
  vacations?: StaffVacation[];
}

export type NotificationType =
  | "STAFF_LATE_CHECK_IN"
  | "TASK_ASSIGNED"
  | "TASK_COMPLETED"
  | "TASK_REPORT_SUBMITTED";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  readAt: string | null;
  createdAt: string;
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

export interface AllergenTag {
  id: string;
  name: string;
}

export type ChildMedicalView =
  | {
      level: "full";
      allergies: string | null;
      chronic: string | null;
      activityLimits: string | null;
      doctorContact: string | null;
      criticalInfo: string | null;
      allergens: AllergenTag[];
    }
  | { level: "critical_only"; criticalInfo: string | null; allergens: AllergenTag[] };

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

export interface Allergen {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Dish {
  id: string;
  name: string;
  isActive: boolean;
  allergens: { allergen: Allergen }[];
}

export type MealType = "BREAKFAST" | "LUNCH" | "AFTERNOON_SNACK";

export const MEAL_TYPES: MealType[] = ["BREAKFAST", "LUNCH", "AFTERNOON_SNACK"];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: "Завтрак",
  LUNCH: "Обед",
  AFTERNOON_SNACK: "Полдник",
};

export interface MenuConflict {
  childId: string;
  fullName: string;
  allergenNames: string[];
}

export interface MenuItem {
  id: string;
  date: string;
  mealType: MealType;
  dishId: string;
  dishName: string;
  allergenNames: string[];
  conflicts: MenuConflict[];
}

// ---------------------------------------------------------------------------
// Photo feed (Этап 4 leftover — ТЗ §7.4)
// ---------------------------------------------------------------------------

export interface Photo {
  id: string;
  groupId: string;
  caption: string | null;
  takenAt: string;
  uploadedById: string;
  createdAt: string;
  downloadUrl: string;
}

export interface PhotoConsentGap {
  childId: string;
  fullName: string;
}

export interface ChildPhotoConsent {
  childId: string;
  fullName: string;
  consent: boolean;
}

/** Parent-facing photo view — no uploadedById/createdAt, that's staff-only. */
export interface ParentPhoto {
  id: string;
  groupId: string;
  caption: string | null;
  takenAt: string;
  downloadUrl: string;
}

// ---------------------------------------------------------------------------
// Staff shift schedule (ТЗ §8 M6 — Этап 5)
// ---------------------------------------------------------------------------

export interface Shift {
  id: string;
  staffId: string;
  staffFullName: string;
  position: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string | null;
}

export interface WaitlistEntry {
  id: string;
  branchId: string;
  groupId: string;
  childId: string | null;
  leadId: string | null;
  leadName: string | null;
  priority: number;
  queuedAt: string;
  child?: Child;
  lead?: Lead;
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
  leadId?: string;
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

export const DISCOUNT_BASIS_LABELS: Record<DiscountBasis, string> = {
  SECOND_CHILD: "Второй ребёнок",
  PREPAYMENT: "Предоплата",
  CORPORATE: "Корпоративная",
  STAFF: "Сотруднику",
  SOCIAL: "Льготная",
  DIRECTOR_DECISION: "Решением директора",
};

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

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Наличные",
  CARD_ONSITE: "Картой на месте",
  BANK_TRANSFER: "Банковский перевод",
  ONLINE_GATEWAY: "Онлайн-оплата",
};

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

export type AbsenceRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export const ABSENCE_REQUEST_STATUS_LABELS: Record<AbsenceRequestStatus, string> = {
  PENDING: "На рассмотрении",
  APPROVED: "Одобрена",
  REJECTED: "Отклонена",
};

export interface AbsenceRequest {
  id: string;
  childId: string;
  dateFrom: string;
  dateTo: string;
  reason: string | null;
  status: AbsenceRequestStatus;
  submittedByParentId: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  createdAt: string;
  child?: { id: string; fullName: string };
  submittedByParent?: { id: string; fullName: string };
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

export interface InvoicesReportRow {
  invoiceId: string;
  familyId: string;
  familyName: string;
  status: InvoiceStatus;
  totalMinor: number;
}

export interface InvoicesReport {
  branchId: string;
  year: number;
  month: number;
  invoices: InvoicesReportRow[];
  totalMinor: number;
}

export interface PaymentsReportRow {
  paymentId: string;
  familyId: string;
  familyName: string;
  amountMinor: number;
  method: PaymentMethod;
  paidAt: string;
}

export interface PaymentsReport {
  branchId: string;
  year: number;
  month: number;
  payments: PaymentsReportRow[];
  totalMinor: number;
  byMethod: Record<string, number>;
}

export interface DiscountsReportRow {
  id: string;
  basis: DiscountBasis;
  kind: DiscountKind;
  value: number;
  reason: string | null;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
  familyName: string;
  childName: string | null;
}

export interface DiscountsReport {
  branchId: string;
  discounts: DiscountsReportRow[];
  total: number;
}

export interface PortionsReportRow {
  groupId: string;
  groupName: string;
  portionsNeeded: number;
}

export interface PortionsReport {
  branchId: string;
  date: string;
  groups: PortionsReportRow[];
  total: number;
}

export interface FunnelStageRow {
  stage: LeadStage;
  count: number;
}

export interface FunnelRejectionRow {
  reasonName: string;
  count: number;
}

export interface FunnelReport {
  branchId: string;
  year: number;
  month: number;
  totalLeads: number;
  stages: FunnelStageRow[];
  enrolledCount: number;
  conversionRate: number;
  rejectedCount: number;
  rejectionRate: number;
  rejectionBreakdown: FunnelRejectionRow[];
  avgDaysToEnroll: number | null;
}

// ---------------------------------------------------------------------------
// Network-wide owner analytics (ТЗ §9.1 — Этап 5)
// ---------------------------------------------------------------------------

export interface BranchOccupancyRow {
  branchId: string;
  branchName: string;
  enrolled: number;
  plannedCapacity: number;
  maxCapacity: number;
}

export interface NetworkMonthRow {
  year: number;
  month: number;
  enrolledCount: number;
  dischargedCount: number;
  invoicedMinor: number;
  paidMinor: number;
  newLeads: number;
  enrolledLeads: number;
  conversionRate: number;
  avgAttendanceRate: number | null;
}

export interface NetworkDashboard {
  occupancy: BranchOccupancyRow[];
  occupancyTotals: { enrolled: number; plannedCapacity: number; maxCapacity: number };
  monthly: NetworkMonthRow[];
}

export interface GenerateInvoicesResult {
  totalFamilies: number;
  results: { familyId: string; status: string; totalMinor?: number }[];
}

// ---------------------------------------------------------------------------
// Sales / leads (Этап 3, MVP slice — ТЗ §3)
// ---------------------------------------------------------------------------

export type LeadStage =
  | "NEW"
  | "CONTACTED"
  | "TOUR_SCHEDULED"
  | "TOUR_DONE"
  | "TRIAL_DAY"
  | "CONTRACT_SIGNING"
  | "ENROLLED"
  | "REJECTED"
  | "WAITLISTED";

export const LEAD_STAGES: LeadStage[] = [
  "NEW",
  "CONTACTED",
  "TOUR_SCHEDULED",
  "TOUR_DONE",
  "TRIAL_DAY",
  "CONTRACT_SIGNING",
  "ENROLLED",
  "REJECTED",
  "WAITLISTED",
];

// Columns shown on the kanban board — ENROLLED/REJECTED/WAITLISTED are only
// reachable via their dedicated flows (conversion wizard / reject action /
// waitlist screen), never by dragging a card, so they don't get a column.
export const LEAD_BOARD_STAGES: AssignableLeadStage[] = [
  "NEW",
  "CONTACTED",
  "TOUR_SCHEDULED",
  "TOUR_DONE",
  "TRIAL_DAY",
  "CONTRACT_SIGNING",
];

// Stages assignable via PATCH /leads/:id/stage — ENROLLED/WAITLISTED are
// reachable only via their dedicated flows (mirrors the backend DTO).
export type AssignableLeadStage = Exclude<LeadStage, "ENROLLED" | "WAITLISTED">;

export const ASSIGNABLE_LEAD_STAGES: AssignableLeadStage[] = [
  "NEW",
  "CONTACTED",
  "TOUR_SCHEDULED",
  "TOUR_DONE",
  "TRIAL_DAY",
  "CONTRACT_SIGNING",
  "REJECTED",
];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  NEW: "Новый",
  CONTACTED: "Связались",
  TOUR_SCHEDULED: "Экскурсия назначена",
  TOUR_DONE: "Экскурсия прошла",
  TRIAL_DAY: "Пробный день",
  CONTRACT_SIGNING: "Оформление договора",
  ENROLLED: "Зачислен",
  REJECTED: "Отказ",
  WAITLISTED: "В очереди",
};

export interface LeadSource {
  id: string;
  name: string;
  isActive: boolean;
}

export interface LeadRejectionReason {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Lead {
  id: string;
  branchId: string;
  parentFullName: string;
  parentPhone: string;
  parentEmail: string | null;
  childFullName: string | null;
  childBirthDate: string | null;
  targetDate: string | null;
  sourceId: string | null;
  stage: LeadStage;
  stageEnteredAt: string;
  rejectionReasonId: string | null;
  rejectionComment: string | null;
  responsibleUserId: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  convertedFamilyId: string | null;
  convertedChildId: string | null;
  createdAt: string;
  updatedAt: string;
  source?: LeadSource | null;
  rejectionReason?: LeadRejectionReason | null;
  activities?: LeadActivity[];
  tasks?: Task[];
}

export interface LeadDuplicate {
  id: string;
  branchId: string;
  branchName: string;
  stage: LeadStage;
  responsibleUserId: string;
  childFullName: string | null;
  createdAt: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface Task {
  id: string;
  branchId: string;
  leadId: string | null;
  familyId: string | null;
  description: string;
  dueAt: string;
  assignedToId: string;
  status: TaskBoardStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Proof-of-work photo/document the assignee submits — auto-deleted 30 days after upload. */
  reportFileName: string | null;
  reportUploadedAt: string | null;
  reportDownloadUrl: string | null;
}

/** Persisted kanban column — drives the staff tasks board. */
export type TaskBoardStatus = "TODO" | "IN_PROGRESS" | "DONE";

export const TASK_BOARD_STATUSES: TaskBoardStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

export const TASK_BOARD_STATUS_LABELS: Record<TaskBoardStatus, string> = {
  TODO: "Не начато",
  IN_PROGRESS: "В работе",
  DONE: "Выполнено",
};

export type DerivedTaskStatus = "OPEN" | "DONE" | "OVERDUE";

/** OPEN/DONE/OVERDUE is derived from completedAt/dueAt for the lead/family task widget. */
export function getDerivedTaskStatus(task: Task): DerivedTaskStatus {
  if (task.completedAt) return "DONE";
  return new Date(task.dueAt).getTime() < Date.now() ? "OVERDUE" : "OPEN";
}

/** Minor units -> a display string in the given currency (e.g. 30000 -> "300.00 KZT"). */
export function formatMinor(amountMinor: number, currency = "KZT"): string {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}
