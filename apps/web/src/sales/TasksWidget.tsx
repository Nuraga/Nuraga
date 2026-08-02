import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Checkbox, Form, Input, List, Select, Space, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { tasksApi } from "../api/tasks";
import { staffApi } from "../api/staff";
import { ApiError } from "../api/client";
import { getTaskStatus, type Task } from "../api/types";

const STATUS_COLORS: Record<string, string> = { OPEN: "blue", DONE: "green", OVERDUE: "red" };
const STATUS_LABELS: Record<string, string> = { OPEN: "Открыта", DONE: "Выполнена", OVERDUE: "Просрочена" };

interface Props {
  branchId: string;
  leadId?: string;
  familyId?: string;
}

export default function TasksWidget({ branchId, leadId, familyId }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [adding, setAdding] = useState(false);

  const queryKey = ["tasks", branchId, leadId, familyId];
  const { data: tasks = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => tasksApi.list(branchId, { leadId, familyId }),
    enabled: Boolean(branchId && (leadId || familyId)),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff", branchId],
    queryFn: () => staffApi.list(branchId),
    enabled: Boolean(branchId),
  });
  const staffOptions = staff.filter((s) => s.user).map((s) => ({ value: s.user!.id, label: s.user!.fullName }));

  const invalidate = () => void queryClient.invalidateQueries({ queryKey });

  const create = useMutation({
    mutationFn: (values: { description: string; dueAt: string; assignedToId: string }) =>
      tasksApi.create(branchId, { ...values, leadId, familyId }),
    onSuccess: () => {
      invalidate();
      form.resetFields();
      setAdding(false);
      message.success("Задача добавлена");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const complete = useMutation({
    mutationFn: (id: string) => tasksApi.complete(branchId, id),
    onSuccess: invalidate,
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <List
        loading={isLoading}
        dataSource={tasks}
        locale={{ emptyText: "Нет задач" }}
        renderItem={(task: Task) => {
          const status = getTaskStatus(task);
          return (
            <List.Item
              actions={[
                status !== "DONE" && (
                  <Checkbox key="complete" onChange={() => complete.mutate(task.id)}>
                    Выполнено
                  </Checkbox>
                ),
              ]}
            >
              <Space direction="vertical" size={0}>
                <Space>
                  <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>
                  <Typography.Text>{task.description}</Typography.Text>
                </Space>
                <Typography.Text type="secondary">
                  Срок: {new Date(task.dueAt).toLocaleString("ru-RU")}
                </Typography.Text>
              </Space>
            </List.Item>
          );
        }}
      />

      {adding ? (
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 12 }}
          onFinish={(values) => create.mutate(values)}
        >
          <Form.Item
            label="Описание"
            name="description"
            rules={[{ required: true, message: "Укажите описание" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Срок" name="dueAt" rules={[{ required: true, message: "Укажите срок" }]}>
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item
            label="Исполнитель"
            name="assignedToId"
            rules={[{ required: true, message: "Выберите исполнителя" }]}
          >
            <Select options={staffOptions} showSearch optionFilterProp="label" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={create.isPending}>
              Сохранить
            </Button>
            <Button onClick={() => setAdding(false)}>Отмена</Button>
          </Space>
        </Form>
      ) : (
        <Button icon={<PlusOutlined />} style={{ marginTop: 12 }} onClick={() => setAdding(true)}>
          Добавить задачу
        </Button>
      )}
    </>
  );
}
