import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Form, Input, List, Modal, Select, Space, Table, Tag, Typography } from "antd";
import { staffAttendanceApi, type CorrectStaffAttendanceInput } from "../api/staffAttendance";
import { staffApi } from "../api/staff";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

function formatMinutes(minutes: number): string {
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}

export default function StaffAttendanceDashboardPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const [selectedStaffId, setSelectedStaffId] = useState<string | undefined>();
  const [correctOpen, setCorrectOpen] = useState(false);
  const [correctForm] = Form.useForm();

  const { data: present = [], isLoading: presentLoading } = useQuery({
    queryKey: ["staff-attendance-present", branchId],
    queryFn: () => staffAttendanceApi.present(branchId),
    enabled: Boolean(branchId),
    refetchInterval: 30_000,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff", branchId],
    queryFn: () => staffApi.list(branchId),
    enabled: Boolean(branchId),
  });
  const staffOptions = staff.filter((s) => s.user).map((s) => ({ value: s.id, label: s.user!.fullName }));

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["staff-attendance-events", branchId, selectedStaffId],
    queryFn: () => staffAttendanceApi.listForStaff(branchId, selectedStaffId!),
    enabled: Boolean(branchId && selectedStaffId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["staff-attendance-events", branchId] });
    void queryClient.invalidateQueries({ queryKey: ["staff-attendance-present", branchId] });
  };

  const correct = useMutation({
    mutationFn: (values: CorrectStaffAttendanceInput) => staffAttendanceApi.correct(branchId, values),
    onSuccess: () => {
      invalidate();
      message.success("Запись добавлена");
      correctForm.resetFields();
      setCorrectOpen(false);
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <Typography.Title level={3}>Посещаемость персонала</Typography.Title>

      <Card title="Сейчас в саду" style={{ marginBottom: 16 }}>
        <List
          loading={presentLoading}
          dataSource={present}
          locale={{ emptyText: "Никого нет" }}
          renderItem={(p) => (
            <List.Item>
              <Typography.Text>{p.fullName}</Typography.Text>
              <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                с {new Date(p.checkedInAt).toLocaleTimeString("ru-RU")}
              </Typography.Text>
              {p.isLate && (
                <Tag color="gold" style={{ marginLeft: 8 }}>
                  Опоздание
                </Tag>
              )}
            </List.Item>
          )}
        />
      </Card>

      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
        <Select
          placeholder="Выберите сотрудника"
          style={{ width: 280 }}
          options={staffOptions}
          value={selectedStaffId}
          onChange={setSelectedStaffId}
          showSearch
          optionFilterProp="label"
        />
        <Button onClick={() => setCorrectOpen(true)}>Добавить запись вручную</Button>
      </Space>

      {selectedStaffId && (
        <>
          <Table
            rowKey="date"
            loading={historyLoading}
            dataSource={history?.dailySummaries ?? []}
            locale={{ emptyText: "Нет данных" }}
            columns={[
              { title: "Дата", dataIndex: "date", render: (d: string) => new Date(d).toLocaleDateString("ru-RU") },
              { title: "Отработано", dataIndex: "workedMinutes", render: formatMinutes },
            ]}
          />
          <Table
            style={{ marginTop: 16 }}
            size="small"
            rowKey="id"
            dataSource={history?.events ?? []}
            locale={{ emptyText: "Нет событий" }}
            columns={[
              { title: "Время", dataIndex: "occurredAt", render: (v: string) => new Date(v).toLocaleString("ru-RU") },
              {
                title: "Тип",
                dataIndex: "type",
                render: (t: string, record) => (
                  <Space>
                    {t === "CHECK_IN" ? "Приход" : "Уход"}
                    {record.isLate && <Tag color="gold">Опоздание</Tag>}
                  </Space>
                ),
              },
              {
                title: "Источник",
                dataIndex: "source",
                // AUTO_CLOSE must never read as "Вручную" — the whole point of
                // the separate source is that nobody actually made this call.
                render: (s: string) =>
                  s === "QR" ? (
                    "QR"
                  ) : s === "AUTO_CLOSE" ? (
                    <Tag color="default">Авто (не отметился)</Tag>
                  ) : (
                    "Вручную"
                  ),
              },
              { title: "Причина правки", dataIndex: "correctionReason", render: (r: string | null) => r ?? "—" },
            ]}
          />
        </>
      )}

      <Modal
        title="Ручная запись"
        open={correctOpen}
        onCancel={() => setCorrectOpen(false)}
        onOk={() => correctForm.submit()}
        confirmLoading={correct.isPending}
        destroyOnClose
      >
        <Form
          form={correctForm}
          layout="vertical"
          initialValues={{ staffId: selectedStaffId }}
          onFinish={(v: CorrectStaffAttendanceInput) => correct.mutate(v)}
        >
          <Form.Item label="Сотрудник" name="staffId" rules={[{ required: true, message: "Выберите сотрудника" }]}>
            <Select options={staffOptions} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item label="Тип" name="type" rules={[{ required: true, message: "Выберите тип" }]}>
            <Select
              options={[
                { value: "CHECK_IN", label: "Приход" },
                { value: "CHECK_OUT", label: "Уход" },
              ]}
            />
          </Form.Item>
          <Form.Item label="Время" name="occurredAt" rules={[{ required: true, message: "Укажите время" }]}>
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item label="Причина" name="reason" rules={[{ required: true, message: "Укажите причину" }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
