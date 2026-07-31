import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DatePicker, Select, Space, Table, Tabs, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { reportsApi } from "../api/reports";
import { groupsApi } from "../api/groups";
import { ATTENDANCE_STATUSES } from "../api/types";
import { useBranch } from "../layout/BranchContext";

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
        ]}
      />
    </>
  );
}
