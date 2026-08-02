import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, DatePicker, Form, Input, Modal, Select, Space, Table, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { attendanceApi, timesheetsApi } from "../api/attendance";
import type { RosterEntry } from "../api/attendance";
import { groupsApi } from "../api/groups";
import type { AttendanceStatus } from "../api/types";
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

export default function AttendancePage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

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
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Посещаемость
        </Typography.Title>
        <Space>
          <Select
            placeholder="Выберите группу"
            style={{ width: 240 }}
            value={groupId}
            onChange={setGroupId}
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
          />
          <DatePicker value={date} onChange={(d) => d && setDate(d)} allowClear={false} />
        </Space>
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
