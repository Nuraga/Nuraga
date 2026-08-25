import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { familiesApi } from "../api/families";
import type { Family } from "../api/types";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

export default function FamiliesPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const { data: families = [], isLoading } = useQuery({
    queryKey: ["families", branchId, search, showArchived],
    queryFn: () => familiesApi.list(branchId, search || undefined, showArchived),
    enabled: Boolean(branchId),
  });

  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const createMutation = useMutation({
    mutationFn: (values: { name: string }) => familiesApi.create(branchId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["families", branchId] });
      setOpen(false);
      message.success("Семья создана");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["families", branchId] });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => familiesApi.archive(branchId, id),
    onSuccess: () => {
      void invalidate();
      message.success("Семья архивирована");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => familiesApi.restore(branchId, id),
    onSuccess: () => {
      void invalidate();
      message.success("Семья восстановлена");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Семьи
        </Typography.Title>
        <Space>
          <Space size="small">
            <Switch checked={showArchived} onChange={setShowArchived} />
            <Typography.Text type="secondary">Архивные</Typography.Text>
          </Space>
          <Input.Search
            placeholder="Поиск по имени или телефону"
            allowClear
            onSearch={setSearch}
            style={{ width: 280 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            Новая семья
          </Button>
        </Space>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={families}
        onRow={(family) => ({ onClick: () => navigate(`/families/${family.id}`), style: { cursor: "pointer" } })}
        columns={[
          {
            title: "Название",
            dataIndex: "name",
            render: (name: string, family: Family) => (
              <Space>
                {name}
                {family.archivedAt && <Tag>Архив</Tag>}
              </Space>
            ),
          },
          {
            title: "Родители",
            key: "parents",
            render: (_, family: Family) => (family.parents ?? []).map((p) => p.fullName).join(", "),
          },
          {
            title: "Дети",
            key: "children",
            render: (_, family: Family) => (family.children ?? []).map((c) => c.fullName).join(", "),
          },
          {
            title: "",
            key: "actions",
            render: (_, family: Family) =>
              family.archivedAt ? (
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    restoreMutation.mutate(family.id);
                  }}
                >
                  Восстановить
                </Button>
              ) : (
                <Popconfirm
                  title="Архивировать семью?"
                  // Popconfirm renders its "Да"/"Нет" buttons into a portal,
                  // but a portal still bubbles through the React tree (not
                  // the DOM tree) — without stopPropagation the click would
                  // reach onRow's onClick and navigate into the family.
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    archiveMutation.mutate(family.id);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button size="small" danger onClick={(e) => e.stopPropagation()}>
                    В архив
                  </Button>
                </Popconfirm>
              ),
          },
        ]}
      />

      <Modal
        title="Новая семья"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(values) => createMutation.mutate(values)}>
          <Form.Item label="Название семьи" name="name" rules={[{ required: true, message: "Укажите название" }]}>
            <Input placeholder="Например, Семья Ивановых" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
