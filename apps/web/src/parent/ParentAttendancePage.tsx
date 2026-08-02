import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Form, Input, Select, Table, Tag, Typography } from "antd";
import { parentPortalApi, type CreateAbsenceRequestInput } from "../api/parentPortal";
import { ApiError } from "../api/client";
import { ABSENCE_REQUEST_STATUS_LABELS, type AbsenceRequestStatus } from "../api/types";

const STATUS_COLORS: Record<AbsenceRequestStatus, string> = {
  PENDING: "gold",
  APPROVED: "green",
  REJECTED: "red",
};

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: "Присутствовал",
  ABSENT_SICK: "Болен",
  ABSENT_EXCUSED: "Уважит. причина",
  VACATION: "Отпуск",
  LATE: "Опоздание",
  UNMARKED: "Не отмечено",
};

export default function ParentAttendancePage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  const { data: family } = useQuery({ queryKey: ["parent", "me"], queryFn: parentPortalApi.me });
  const children = family?.children ?? [];
  const [selectedChildId, setSelectedChildId] = useState<string | undefined>();
  const activeChildId = selectedChildId ?? children[0]?.id;

  const { data: attendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ["parent", "attendance", activeChildId],
    queryFn: () => parentPortalApi.childAttendance(activeChildId!),
    enabled: Boolean(activeChildId),
  });
  const { data: requests = [] } = useQuery({
    queryKey: ["parent", "absence-requests"],
    queryFn: parentPortalApi.listAbsenceRequests,
  });

  const submitRequest = useMutation({
    mutationFn: (values: CreateAbsenceRequestInput) =>
      parentPortalApi.createAbsenceRequest(activeChildId!, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["parent", "absence-requests"] });
      form.resetFields();
      message.success("Заявка отправлена");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <Typography.Title level={4}>Посещаемость</Typography.Title>

      {children.length > 1 && (
        <Select
          style={{ width: "100%", marginBottom: 16 }}
          value={activeChildId}
          onChange={setSelectedChildId}
          options={children.map((c) => ({ value: c.id, label: c.fullName }))}
        />
      )}

      <Card title="История" style={{ marginBottom: 16 }}>
        <Table
          rowKey="id"
          size="small"
          loading={attendanceLoading}
          dataSource={attendance}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: "Нет данных" }}
          columns={[
            { title: "Дата", dataIndex: "date", render: (v: string) => new Date(v).toLocaleDateString("ru-RU") },
            {
              title: "Статус",
              dataIndex: "status",
              render: (s: string) => ATTENDANCE_STATUS_LABELS[s] ?? s,
            },
          ]}
        />
      </Card>

      <Card title="Заявка на отсутствие" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={(v) => submitRequest.mutate(v)} disabled={!activeChildId}>
          <Form.Item label="С даты" name="dateFrom" rules={[{ required: true, message: "Укажите дату" }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item label="По дату" name="dateTo" rules={[{ required: true, message: "Укажите дату" }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item label="Причина" name="reason">
            <Input.TextArea rows={2} placeholder="Необязательно" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitRequest.isPending}>
            Отправить
          </Button>
        </Form>
      </Card>

      <Card title="Мои заявки">
        <Table
          rowKey="id"
          size="small"
          dataSource={requests}
          pagination={false}
          locale={{ emptyText: "Пока нет заявок" }}
          columns={[
            {
              title: "Период",
              key: "period",
              render: (_, r) =>
                `${new Date(r.dateFrom).toLocaleDateString("ru-RU")} – ${new Date(r.dateTo).toLocaleDateString("ru-RU")}`,
            },
            {
              title: "Статус",
              dataIndex: "status",
              render: (s: AbsenceRequestStatus) => (
                <Tag color={STATUS_COLORS[s]}>{ABSENCE_REQUEST_STATUS_LABELS[s]}</Tag>
              ),
            },
            {
              title: "Комментарий",
              dataIndex: "reviewComment",
              render: (v: string | null) => v ?? "—",
            },
          ]}
        />
      </Card>
    </>
  );
}
