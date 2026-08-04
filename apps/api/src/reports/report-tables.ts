import type { TabularData } from "../common/export/export.types";
import type { OccupancyReport, AttendanceSummaryReport, WaitlistReport } from "./reports.service";
import type { DebtRegistry, InvoicesRegistry, PaymentsRegistry, DiscountsRegistry, PortionsReport, FunnelReport } from "./reports.service";

// Maps this module's already-computed report shapes into the flat
// {columns, rows} TabularData shape ExcelExportService/PdfExportService
// consume — kept separate from ReportsService so the export-specific
// column choices/Russian labels don't clutter the business logic, and so
// this is easy to unit-test in isolation (pure functions, no I/O).

function formatMinor(amountMinor: number): string {
  return `${(amountMinor / 100).toFixed(2)} KZT`;
}

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: "Присутствовал",
  ABSENT_SICK: "Болен",
  ABSENT_EXCUSED: "Уважит. причина",
  VACATION: "Отпуск",
  LATE: "Опоздание",
  UNMARKED: "Не отмечено",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Проект",
  APPROVED: "Утверждён",
  PARTIALLY_PAID: "Частично оплачен",
  PAID: "Оплачен",
  CANCELLED: "Отменён",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD_ONSITE: "Картой на месте",
  BANK_TRANSFER: "Банковский перевод",
  ONLINE_GATEWAY: "Онлайн-оплата",
};

const DISCOUNT_BASIS_LABELS: Record<string, string> = {
  SECOND_CHILD: "Второй ребёнок",
  PREPAYMENT: "Предоплата",
  CORPORATE: "Корпоративная",
  STAFF: "Сотруднику",
  SOCIAL: "Льготная",
  DIRECTOR_DECISION: "Решением директора",
};

const LEAD_STAGE_LABELS: Record<string, string> = {
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

export function occupancyTable(data: OccupancyReport): TabularData {
  return {
    title: "Заполняемость",
    columns: [
      { header: "Группа", width: 3 },
      { header: "Зачислено", width: 2 },
      { header: "План", width: 2 },
      { header: "Максимум", width: 2 },
      { header: "Превышен план", width: 2 },
    ],
    rows: data.groups.map((g) => [g.groupName, g.enrolled, g.plannedCapacity, g.maxCapacity, g.isOverPlanned ? "Да" : "Нет"]),
  };
}

export function attendanceSummaryTable(data: AttendanceSummaryReport): TabularData {
  const statuses = ["PRESENT", "ABSENT_SICK", "ABSENT_EXCUSED", "VACATION", "LATE", "UNMARKED"];
  return {
    title: `Посещаемость ${data.month}/${data.year}`,
    columns: [
      { header: "Ребёнок", width: 3 },
      ...statuses.map((s) => ({ header: ATTENDANCE_STATUS_LABELS[s], width: 2 })),
    ],
    rows: data.children.map((c) => [
      c.fullName,
      ...statuses.map((s) => (c as unknown as Record<string, number>)[s] ?? 0),
    ]),
  };
}

export function waitlistTable(data: WaitlistReport): TabularData {
  return {
    title: "Очередь",
    columns: [
      { header: "Группа", width: 3 },
      { header: "В очереди", width: 2 },
    ],
    rows: data.groups.map((g) => [g.groupName, g.waitlisted]),
  };
}

export function debtTable(data: DebtRegistry): TabularData {
  return {
    title: "Задолженность",
    columns: [
      { header: "Семья", width: 3 },
      { header: "Долг", width: 2 },
      { header: "Старейший неоплаченный период", width: 2 },
    ],
    rows: data.families.map((f) => [
      f.familyName,
      formatMinor(f.debtMinor),
      f.oldestUnpaidPeriod ? `${f.oldestUnpaidPeriod.month}/${f.oldestUnpaidPeriod.year}` : "—",
    ]),
  };
}

export function invoicesTable(data: InvoicesRegistry): TabularData {
  return {
    title: `Начисления ${data.month}/${data.year}`,
    columns: [
      { header: "Семья", width: 3 },
      { header: "Статус", width: 2 },
      { header: "Сумма", width: 2 },
    ],
    rows: data.invoices.map((inv) => [inv.familyName, INVOICE_STATUS_LABELS[inv.status] ?? inv.status, formatMinor(inv.totalMinor)]),
  };
}

export function paymentsTable(data: PaymentsRegistry): TabularData {
  return {
    title: `Оплаты ${data.month}/${data.year}`,
    columns: [
      { header: "Семья", width: 3 },
      { header: "Дата", width: 2 },
      { header: "Способ", width: 2 },
      { header: "Сумма", width: 2 },
    ],
    rows: data.payments.map((p) => [
      p.familyName,
      p.paidAt.toISOString().slice(0, 10),
      PAYMENT_METHOD_LABELS[p.method] ?? p.method,
      formatMinor(p.amountMinor),
    ]),
  };
}

export function discountsTable(data: DiscountsRegistry): TabularData {
  return {
    title: "Скидки",
    columns: [
      { header: "Семья", width: 3 },
      { header: "Ребёнок", width: 3 },
      { header: "Основание", width: 2 },
      { header: "Размер", width: 2 },
      { header: "Причина", width: 3 },
    ],
    rows: data.discounts.map((d) => [
      d.familyName,
      d.childName ?? "—",
      DISCOUNT_BASIS_LABELS[d.basis] ?? d.basis,
      d.kind === "PERCENT" ? `${d.value}%` : formatMinor(d.value),
      d.reason ?? "—",
    ]),
  };
}

export function portionsTable(data: PortionsReport): TabularData {
  return {
    title: `Порции на ${data.date}`,
    columns: [
      { header: "Группа", width: 3 },
      { header: "Порций нужно", width: 2 },
    ],
    rows: data.groups.map((g) => [g.groupName, g.portionsNeeded]),
  };
}

export function funnelTable(data: FunnelReport): TabularData {
  const rows: (string | number)[][] = [
    ["Всего лидов", data.totalLeads],
    ["Зачислено", data.enrolledCount],
    ["Конверсия", `${Math.round(data.conversionRate * 100)}%`],
    ["Отказано", data.rejectedCount],
    ["Ср. дней до зачисления", data.avgDaysToEnroll === null ? "—" : data.avgDaysToEnroll.toFixed(1)],
    ...data.stages.map((s) => [`Стадия: ${LEAD_STAGE_LABELS[s.stage] ?? s.stage}`, s.count]),
    ...data.rejectionBreakdown.map((r) => [`Отказ: ${r.reasonName}`, r.count]),
  ];

  return {
    title: `Воронка продаж ${data.month}/${data.year}`,
    columns: [
      { header: "Показатель", width: 4 },
      { header: "Значение", width: 2 },
    ],
    rows,
  };
}
