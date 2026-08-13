import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { staffApi, STAFF_GRANTABLE_ROLES } from "../api/staff";
import { groupsApi } from "../api/groups";
import type { CreateStaffInput } from "../api/staff";
import type { Staff } from "../api/types";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

const ROLE_LABELS: Record<string, string> = {
  BRANCH_MANAGER: "Управляющий филиалом",
  MANAGER: "Менеджер",
  ACCOUNTANT: "Бухгалтер",
  TEACHER: "Воспитатель",
  NANNY: "Няня",
  METHODIST: "Методист",
};

export default function StaffPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const [includeTerminated, setIncludeTerminated] = useState(false);
  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff", branchId, includeTerminated],
    queryFn: () => staffApi.list(branchId, includeTerminated),
    enabled: Boolean(branchId),
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["groups", branchId],
    queryFn: () => groupsApi.list(branchId),
    enabled: Boolean(branchId),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<Staff | null>(null);
  const [form] = Form.useForm();
  const [assignForm] = Form.useForm();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["staff", branchId] });

  const createMutation = useMutation({
    mutationFn: (values: CreateStaffInput) => staffApi.create(branchId, values),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      message.success("Сотрудник добавлен");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const assignMutation = useMutation({
    mutationFn: ({ staffId, groupId }: { staffId: string; groupId: string }) =>
      staffApi.assignGroup(branchId, staffId, groupId),
    onSuccess: () => {
      invalidate();
      setAssignFor(null);
      message.success("Группа назначена");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const unassignMutation = useMutation({
    mutationFn: ({ staffId, groupId }: { staffId: string; groupId: string }) =>
      staffApi.unassignGroup(branchId, staffId, groupId),
    onSuccess: invalidate,
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const terminateMutation = useMutation({
    mutationFn: (staffId: string) => staffApi.terminate(branchId, staffId),
    onSuccess: () => {
      invalidate();
      message.success("Сотрудник уволен");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  function groupName(groupId: string) {
    return groups.find((g) => g.id === groupId)?.name ?? groupId;
  }

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Сотрудники
        </Typography.Title>
        <Space>
          <Switch checked={includeTerminated} onChange={setIncludeTerminated} />
          <Typography.Text>Показывать уволенных</Typography.Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Добавить сотрудника
          </Button>
        </Space>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={staff}
        columns={[
          { title: "ФИО", dataIndex: ["user", "fullName"] },
          { title: "Email", dataIndex: ["user", "email"] },
          { title: "Должность", dataIndex: "position" },
          {
            title: "Статус",
            key: "status",
            render: (_, record: Staff) =>
              record.terminatedAt ? (
                <Tag color="red">Уволен {new Date(record.terminatedAt).toLocaleDateString("ru-RU")}</Tag>
              ) : (
                <Tag color="green">Работает</Tag>
              ),
          },
          {
            title: "Группы",
            key: "groups",
            render: (_, record: Staff) => (
              <Space wrap>
                {(record.groups ?? []).map((g) => (
                  <Tag
                    key={g.groupId}
                    closable
                    onClose={(e) => {
                      e.preventDefault();
                      unassignMutation.mutate({ staffId: record.id, groupId: g.groupId });
                    }}
                  >
                    {groupName(g.groupId)}
                  </Tag>
                ))}
              </Space>
            ),
          },
          {
            title: "",
            key: "actions",
            render: (_, record: Staff) =>
              !record.terminatedAt && (
                <Space>
                  <Button size="small" onClick={() => setAssignFor(record)}>
                    Назначить группу
                  </Button>
                  <Popconfirm
                    title="Уволить сотрудника?"
                    description="Доступ к филиалу будет отозван. История посещаемости и смен сохранится."
                    onConfirm={() => terminateMutation.mutate(record.id)}
                  >
                    <Button size="small" danger loading={terminateMutation.isPending}>
                      Уволить
                    </Button>
                  </Popconfirm>
                </Space>
              ),
          },
        ]}
      />

      <Modal
        title="Новый сотрудник"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values: CreateStaffInput) => {
            if (!values.email && !values.phone) {
              message.error("Укажите email или телефон");
              return;
            }
            createMutation.mutate(values);
          }}
        >
          <Form.Item label="ФИО" name="fullName" rules={[{ required: true, message: "Укажите ФИО" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            extra="Укажите email или телефон (или оба) — это логин для входа"
            rules={[{ type: "email", message: "Некорректный email" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Телефон" name="phone">
            <Input />
          </Form.Item>
          <Form.Item
            label="Пароль"
            name="password"
            rules={[
              { required: true, message: "Укажите пароль" },
              { min: 6, message: "Минимум 6 символов" },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item label="Роль" name="role" rules={[{ required: true, message: "Выберите роль" }]}>
            <Select
              options={STAFF_GRANTABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            />
          </Form.Item>
          <Form.Item label="Должность" name="position" rules={[{ required: true, message: "Укажите должность" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Дата приёма" name="hiredAt">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Назначить группу"
        open={Boolean(assignFor)}
        onCancel={() => setAssignFor(null)}
        onOk={() => assignForm.submit()}
        confirmLoading={assignMutation.isPending}
        destroyOnClose
      >
        <Form
          form={assignForm}
          layout="vertical"
          onFinish={(values: { groupId: string }) =>
            assignFor && assignMutation.mutate({ staffId: assignFor.id, groupId: values.groupId })
          }
        >
          <Form.Item label="Группа" name="groupId" rules={[{ required: true, message: "Выберите группу" }]}>
            <Select options={groups.map((g) => ({ value: g.id, label: g.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
