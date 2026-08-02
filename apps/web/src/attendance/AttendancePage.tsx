import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Badge, Button, DatePicker, Form, Input, Modal, Select, Space, Table, Tabs, Tag, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { attendanceApi, timesheetsApi, absenceRequestsApi } from "../api/attendance";
import type { RosterEntry } from "../api/attendance";
import { groupsApi } from "../api/groups";
import { ABSENCE_REQUEST_STATUS_LABELS, type AbsenceRequestStatus, type AttendanceStatus } from "../api/types";
import { ATTENDANCE_STATUSES } from "../api/types";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Присутствует",
  ABSENT_SICK: "Болен",
  ABSENT_EXCUSED: "Уважительная причина",
  VACATION: "Отпуск",
  LATE: "Опоздание",
  UNMARKED: "Не отмечено",
};

const ABSENCE_STATUS_COLORS: Record<AbsenceRequestStatus, string> = {
  PENDING: "gold",
  APPROVED: "green",
  REJECTED: "red",
};

function AttendanceRosterTab({ branchId }: { branchId: string }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const { data: groups = [] } = useQuery({
    queryKey: ["groups", branchId],
    queryFn: () => groupsApi.list(branchId),
    enabled: Boolean(branchId),
  });
  const [groupId, setGroupId] = useState<string | undefined>();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const dateStr = date.format("YYYY-MM-DD");

  const rosterQuery = useQuery({
    queryKey: ["attendance-roster", branchId, groupId, dateStr],
    queryFn: () => attendanceApi.roster(branchId, groupId!, dateStr),
    enabled: Boolean(branchId && groupId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["attendance-roster", branchId, groupId, dateStr] });

  const markMutation = useMutation({
    mutationFn: ({ childId, status }: { childId: string; status: AttendanceStatus }) =>
      attendanceApi.mark(branchId, childId, { date: dateStr, status }),
    onSuccess: invalidate,
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const [correcting, setCorrecting] = useState<RosterEntry | null>(null);
  const [correctForm] = Form.useForm();
  const correctMutation = useMutation({
    mutationFn: (values: { status: AttendanceStatus; reason: string }) =>
      timesheetsApi.correctAttendance(branchId, correcting!.attendance!.id, values),
    onSuccess: () => {
      invalidate();
      setCorrecting(null);
      message.success("Запись скорректирована");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  function handleStatusChange(entry: RosterEntry, status: AttendanceStatus) {
    markMutation.mutate(
      { childId: entry.child.id, status },
      {
        onError: (err) => {
          const isClosedPeriod = err instanceof ApiError && err.status === 409;
          if (isClosedPeriod && entry.attendance) {
            correctForm.setFieldsValue({ status });
            setCorrecting(entry);
          } else {
            message.error(err instanceof ApiError ? err.message : "Ошибка");
          }
        },
      },
    );
  }

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="Выберите группу"
          style={{ width: 240 }}
          value={groupId}
          onChange={setGroupId}
          options={groups.map((g) => ({ value: g.id, label: g.name }))}
        />
        <DatePicker value={date} onChange={(d) => d && setDate(d)} allowClear={false} />
      </Space>

      <Table
        rowKey={(entry) => entry.child.id}
        loading={rosterQuery.isLoading}
        dataSource={rosterQuery.data ?? []}
        columns={[
          { title: "Ребёнок", key: "child", render: (_, entry: RosterEntry) => entry.child.fullName },
          {
            title: "Статус",
            key: "status",
            render: (_, entry: RosterEntry) => (
              <Select
                style={{ width: 220 }}
                value={entry.attendance?.status ?? "UNMARKED"}
                onChange={(status) => handleStatusChange(entry, status)}
                options={ATTENDANCE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
              />
            ),
          },
          {
            title: "Отметил(а)",
            key: "markedBy",
            render: (_, entry: RosterEntry) => (entry.attendance ? "✓" : "—"),
          },
        ]}
      />

      <Modal
        title="Корректировка (период закрыт)"
        open={Boolean(correcting)}
        onCancel={() => setCorrecting(null)}
        onOk={() => correctForm.submit()}
        confirmLoading={correctMutation.isPending}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">
          Табельный период для этой даты закрыт. Изменение статуса для {correcting?.child.fullName} требует
          указания причины и будет зафиксировано как корректировка.
        </Typography.Paragraph>
        <Form form={correctForm} layout="vertical" onFinish={(values) => correctMutation.mutate(values)}>
          <Form.Item label="Статус" name="status" rules={[{ required: true }]}>
            <Select options={ATTENDANCE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
          </Form.Item>
          <Form.Item label="Причина корректировки" name="reason" rules={[{ required: true, message: "Укажите причину" }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function AbsenceRequestsTab({ branchId }: { branchId: string }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectForm] = Form.useForm();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["absence-requests", branchId],
    queryFn: () => absenceRequestsApi.list(branchId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["absence-requests", branchId] });

  const approve = useMutation({
    mutationFn: (id: string) => absenceRequestsApi.approve(branchId, id),
    onSuccess: () => {
      invalidate();
      message.success("Заявка одобрена, посещаемость проставлена");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const reject = useMutation({
    mutationFn: (comment?: string) => absenceRequestsApi.reject(branchId, rejecting!, comment),
    onSuccess: () => {
      invalidate();
      setRejecting(null);
      message.success("Заявка отклонена");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={requests}
        locale={{ emptyText: "Заявок нет" }}
        columns={[
          { title: "Ребёнок", key: "child", render: (_, r) => r.child?.fullName ?? "—" },
          { title: "От", key: "parent", render: (_, r) => r.submittedByParent?.fullName ?? "—" },
          {
            title: "Период",
            key: "period",
            render: (_, r) =>
              `${new Date(r.dateFrom).toLocaleDateString("ru-RU")} – ${new Date(r.dateTo).toLocaleDateString("ru-RU")}`,
          },
          { title: "Причина", dataIndex: "reason", render: (v: string | null) => v ?? "—" },
          {
            title: "Статус",
            dataIndex: "status",
            render: (s: AbsenceRequestStatus) => (
              <Tag color={ABSENCE_STATUS_COLORS[s]}>{ABSENCE_REQUEST_STATUS_LABELS[s]}</Tag>
            ),
          },
          {
            title: "",
            key: "actions",
            render: (_, r) =>
              r.status === "PENDING" && (
                <Space>
                  <Button size="small" type="primary" loading={approve.isPending} onClick={() => approve.mutate(r.id)}>
                    Подтвердить
                  </Button>
                  <Button size="small" danger onClick={() => setRejecting(r.id)}>
                    Отклонить
                  </Button>
                </Space>
              ),
          },
        ]}
      />

      <Modal
        title="Отклонить заявку"
        open={Boolean(rejecting)}
        onCancel={() => setRejecting(null)}
        onOk={() => rejectForm.submit()}
        confirmLoading={reject.isPending}
        destroyOnClose
      >
        <Form form={rejectForm} layout="vertical" onFinish={(v) => reject.mutate(v.comment)}>
          <Form.Item label="Комментарий" name="comment">
            <Input.TextArea rows={2} placeholder="Необязательно" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default function AttendancePage() {
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["absence-requests", branchId, "PENDING"],
    queryFn: () => absenceRequestsApi.list(branchId, "PENDING"),
    enabled: Boolean(branchId),
  });

  return (
    <>
      <Typography.Title level={3}>Посещаемость</Typography.Title>
      <Tabs
        items={[
          { key: "roster", label: "Отметка", children: <AttendanceRosterTab branchId={branchId} /> },
          {
            key: "absence-requests",
            label: (
              <Badge count={pendingRequests.length} size="small" offset={[8, -2]}>
                <span>Заявки на отсутствие</span>
              </Badge>
            ),
            children: <AbsenceRequestsTab branchId={branchId} />,
          },
        ]}
      />
    </>
  );
}
