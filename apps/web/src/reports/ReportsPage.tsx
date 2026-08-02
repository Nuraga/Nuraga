import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DatePicker, Select, Space, Table, Tabs, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { reportsApi } from "../api/reports";
import { groupsApi } from "../api/groups";
import {
  ATTENDANCE_STATUSES,
  DISCOUNT_BASIS_LABELS,
  PAYMENT_METHOD_LABELS,
  formatMinor,
  type InvoiceStatus,
} from "../api/types";
import { useBranch } from "../layout/BranchContext";

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Проект",
  APPROVED: "Утверждён",
  PARTIALLY_PAID: "Частично оплачен",
  PAID: "Оплачен",
  CANCELLED: "Отменён",
};

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: "Присутствовал",
  ABSENT_SICK: "Болен",
  ABSENT_EXCUSED: "Уважит. причина",
  VACATION: "Отпуск",
  LATE: "Опоздание",
  UNMARKED: "Не отмечено",
};

function OccupancyTab({ branchId }: { branchId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "occupancy", branchId],
    queryFn: () => reportsApi.occupancy(branchId),
    enabled: Boolean(branchId),
  });

  return (
    <>
      {data && (
        <Typography.Paragraph>
          Всего зачислено: <strong>{data.totals.enrolled}</strong> из плановых{" "}
          <strong>{data.totals.plannedCapacity}</strong> (максимум {data.totals.maxCapacity})
        </Typography.Paragraph>
      )}
      <Table
        rowKey="groupName"
        loading={isLoading}
        dataSource={data?.groups ?? []}
        pagination={false}
        columns={[
          { title: "Группа", dataIndex: "groupName" },
          { title: "Зачислено", dataIndex: "enrolled" },
          { title: "План", dataIndex: "plannedCapacity" },
          { title: "Максимум", dataIndex: "maxCapacity" },
          { title: "Превышен план", dataIndex: "isOverPlanned", render: (v: boolean) => (v ? "Да" : "Нет") },
        ]}
      />
    </>
  );
}

function AttendanceSummaryTab({ branchId }: { branchId: string }) {
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const { data: groups = [] } = useQuery({
    queryKey: ["groups", branchId],
    queryFn: () => groupsApi.list(branchId),
    enabled: Boolean(branchId),
  });
  const [groupId, setGroupId] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "attendance-summary", branchId, month.year(), month.month(), groupId],
    queryFn: () => reportsApi.attendanceSummary(branchId, month.year(), month.month() + 1, groupId),
    enabled: Boolean(branchId),
  });

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <DatePicker picker="month" value={month} onChange={(d) => d && setMonth(d)} allowClear={false} />
        <Select
          placeholder="Все группы"
          allowClear
          style={{ width: 200 }}
          value={groupId}
          onChange={setGroupId}
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
        />
      </Space>
      <Table
        rowKey="childId"
        loading={isLoading}
        dataSource={data?.children ?? []}
        pagination={false}
        columns={[
          { title: "Ребёнок", dataIndex: "fullName" },
          ...ATTENDANCE_STATUSES.map((s) => ({
            title: ATTENDANCE_STATUS_LABELS[s],
            dataIndex: s,
          })),
        ]}
      />
    </>
  );
}

function WaitlistTab({ branchId }: { branchId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "waitlist", branchId],
    queryFn: () => reportsApi.waitlist(branchId),
    enabled: Boolean(branchId),
  });

  return (
    <>
      {data && (
        <Typography.Paragraph>
          Всего в очереди: <strong>{data.total}</strong>
        </Typography.Paragraph>
      )}
      <Table
        rowKey="groupId"
        loading={isLoading}
        dataSource={data?.groups ?? []}
        pagination={false}
        columns={[
          { title: "Группа", dataIndex: "groupName" },
          { title: "В очереди", dataIndex: "waitlisted" },
        ]}
      />
    </>
  );
}

function DebtTab({ branchId }: { branchId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "debt", branchId],
    queryFn: () => reportsApi.debt(branchId),
    enabled: Boolean(branchId),
  });

  return (
    <>
      {data && (
        <Typography.Paragraph>
          Общая задолженность: <strong>{formatMinor(data.totalDebtMinor)}</strong>
        </Typography.Paragraph>
      )}
      <Table
        rowKey="familyId"
        loading={isLoading}
        dataSource={data?.families ?? []}
        pagination={false}
        columns={[
          { title: "Семья", dataIndex: "familyName" },
          { title: "Долг", key: "debt", render: (_, r) => formatMinor(r.debtMinor) },
          {
            title: "Старейший неоплаченный период",
            key: "oldest",
            render: (_, r) => (r.oldestUnpaidPeriod ? `${r.oldestUnpaidPeriod.month}/${r.oldestUnpaidPeriod.year}` : "—"),
          },
        ]}
      />
    </>
  );
}

function InvoicesTab({ branchId }: { branchId: string }) {
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "invoices", branchId, month.year(), month.month()],
    queryFn: () => reportsApi.invoices(branchId, month.year(), month.month() + 1),
    enabled: Boolean(branchId),
  });

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <DatePicker picker="month" value={month} onChange={(d) => d && setMonth(d)} allowClear={false} />
      </Space>
      {data && (
        <Typography.Paragraph>
          Начислено всего: <strong>{formatMinor(data.totalMinor)}</strong>
        </Typography.Paragraph>
      )}
      <Table
        rowKey="invoiceId"
        loading={isLoading}
        dataSource={data?.invoices ?? []}
        pagination={false}
        columns={[
          { title: "Семья", dataIndex: "familyName" },
          { title: "Статус", dataIndex: "status", render: (s: InvoiceStatus) => INVOICE_STATUS_LABELS[s] },
          { title: "Сумма", key: "total", render: (_, r) => formatMinor(r.totalMinor) },
        ]}
      />
    </>
  );
}

function PaymentsTab({ branchId }: { branchId: string }) {
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "payments", branchId, month.year(), month.month()],
    queryFn: () => reportsApi.payments(branchId, month.year(), month.month() + 1),
    enabled: Boolean(branchId),
  });

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <DatePicker picker="month" value={month} onChange={(d) => d && setMonth(d)} allowClear={false} />
      </Space>
      {data && (
        <Typography.Paragraph>
          Оплачено всего: <strong>{formatMinor(data.totalMinor)}</strong>
        </Typography.Paragraph>
      )}
      <Table
        rowKey="paymentId"
        loading={isLoading}
        dataSource={data?.payments ?? []}
        pagination={false}
        columns={[
          { title: "Семья", dataIndex: "familyName" },
          { title: "Дата", dataIndex: "paidAt", render: (d: string) => dayjs(d).format("DD.MM.YYYY") },
          {
            title: "Способ",
            dataIndex: "method",
            render: (m: keyof typeof PAYMENT_METHOD_LABELS) => PAYMENT_METHOD_LABELS[m],
          },
          { title: "Сумма", key: "amount", render: (_, r) => formatMinor(r.amountMinor) },
        ]}
      />
    </>
  );
}

function DiscountsTab({ branchId }: { branchId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "discounts", branchId],
    queryFn: () => reportsApi.discounts(branchId),
    enabled: Boolean(branchId),
  });

  return (
    <>
      {data && (
        <Typography.Paragraph>
          Активных скидок: <strong>{data.total}</strong>
        </Typography.Paragraph>
      )}
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data?.discounts ?? []}
        pagination={false}
        columns={[
          { title: "Семья", dataIndex: "familyName" },
          { title: "Ребёнок", dataIndex: "childName", render: (c: string | null) => c ?? "—" },
          {
            title: "Основание",
            dataIndex: "basis",
            render: (b: keyof typeof DISCOUNT_BASIS_LABELS) => DISCOUNT_BASIS_LABELS[b],
          },
          {
            title: "Размер",
            key: "value",
            render: (_, r) => (r.kind === "PERCENT" ? `${r.value}%` : formatMinor(r.value)),
          },
          { title: "Причина", dataIndex: "reason", render: (r: string | null) => r ?? "—" },
        ]}
      />
    </>
  );
}

export default function ReportsPage() {
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  return (
    <>
      <Typography.Title level={3}>Отчёты</Typography.Title>
      <Tabs
        items={[
          { key: "occupancy", label: "Заполняемость", children: <OccupancyTab branchId={branchId} /> },
          {
            key: "attendance",
            label: "Посещаемость",
            children: <AttendanceSummaryTab branchId={branchId} />,
          },
          { key: "waitlist", label: "Очередь", children: <WaitlistTab branchId={branchId} /> },
          { key: "debt", label: "Задолженность", children: <DebtTab branchId={branchId} /> },
          { key: "invoices", label: "Начисления", children: <InvoicesTab branchId={branchId} /> },
          { key: "payments", label: "Оплаты", children: <PaymentsTab branchId={branchId} /> },
          { key: "discounts", label: "Скидки", children: <DiscountsTab branchId={branchId} /> },
        ]}
      />
    </>
  );
}
