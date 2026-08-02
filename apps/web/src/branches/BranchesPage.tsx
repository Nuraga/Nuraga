import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, Modal, Space, Switch, Table, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { branchesApi } from "../api/branches";
import type { Branch } from "../api/types";
import { ApiError } from "../api/client";

export default function BranchesPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { data: branches = [], isLoading } = useQuery({ queryKey: ["branches"], queryFn: branchesApi.list });

  const [editing, setEditing] = useState<Branch | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    form.setFieldsValue(branch);
    setModalOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (values: { name: string; address?: string; timezone?: string; isActive?: boolean }) =>
      editing ? branchesApi.update(editing.id, values) : branchesApi.create(values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
      setModalOpen(false);
      message.success(editing ? "Филиал обновлён" : "Филиал создан");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка сохранения"),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => branchesApi.archive(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
      message.success("Филиал архивирован");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Филиалы
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новый филиал
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={branches}
        columns={[
          { title: "Название", dataIndex: "name" },
          { title: "Адрес", dataIndex: "address" },
          { title: "Часовой пояс", dataIndex: "timezone" },
          {
            title: "Статус",
            dataIndex: "isActive",
            render: (isActive: boolean) =>
              isActive ? <Tag color="green">Активен</Tag> : <Tag>Архив</Tag>,
          },
          {
            title: "",
            key: "actions",
            render: (_, branch: Branch) => (
              <Space>
                <Button size="small" onClick={() => openEdit(branch)}>
                  Изменить
                </Button>
                {branch.isActive && (
                  <Button
                    size="small"
                    danger
                    loading={archiveMutation.isPending}
                    onClick={() => archiveMutation.mutate(branch.id)}
                  >
                    В архив
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? "Изменить филиал" : "Новый филиал"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item label="Название" name="name" rules={[{ required: true, message: "Укажите название" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Адрес" name="address">
            <Input />
          </Form.Item>
          <Form.Item label="Часовой пояс" name="timezone">
            <Input placeholder="UTC" />
          </Form.Item>
          {editing && (
            <Form.Item label="Активен" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
