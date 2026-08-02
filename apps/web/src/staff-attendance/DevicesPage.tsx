import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, Modal, Popconfirm, Space, Table, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { devicesApi, type Device, type ProvisionDeviceResult } from "../api/devices";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

export default function DevicesPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();
  const [justProvisioned, setJustProvisioned] = useState<ProvisionDeviceResult | null>(null);

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["devices", branchId],
    queryFn: () => devicesApi.list(branchId),
    enabled: Boolean(branchId),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["devices", branchId] });

  const provision = useMutation({
    mutationFn: (name: string) => devicesApi.provision(branchId, name),
    onSuccess: (result) => {
      invalidate();
      form.resetFields();
      setCreateOpen(false);
      setJustProvisioned(result);
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const revoke = useMutation({
    mutationFn: (deviceId: string) => devicesApi.revoke(branchId, deviceId),
    onSuccess: () => {
      invalidate();
      message.success("Устройство отключено");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Устройства
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Добавить киоск
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={devices}
        locale={{ emptyText: "Киосков ещё нет" }}
        columns={[
          { title: "Название", dataIndex: "name" },
          { title: "ID устройства", dataIndex: "id", render: (id: string) => <Typography.Text code>{id}</Typography.Text> },
          {
            title: "Статус",
            key: "status",
            render: (_, d: Device) =>
              d.revokedAt ? <Tag color="red">Отключено</Tag> : <Tag color="green">Активно</Tag>,
          },
          {
            title: "Последняя активность",
            dataIndex: "lastSeenAt",
            render: (v: string | null) => (v ? new Date(v).toLocaleString("ru-RU") : "—"),
          },
          {
            title: "",
            key: "actions",
            render: (_, d: Device) =>
              !d.revokedAt && (
                <Popconfirm title="Отключить это устройство?" onConfirm={() => revoke.mutate(d.id)}>
                  <Button danger size="small">
                    Отключить
                  </Button>
                </Popconfirm>
              ),
          },
        ]}
      />

      <Modal
        title="Новый киоск"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={provision.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v: { name: string }) => provision.mutate(v.name)}>
          <Form.Item
            label="Название"
            name="name"
            rules={[{ required: true, message: "Например: «Киоск — вход»" }]}
          >
            <Input placeholder="Киоск — вход" autoFocus />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Данные для настройки киоска"
        open={Boolean(justProvisioned)}
        onCancel={() => setJustProvisioned(null)}
        footer={<Button type="primary" onClick={() => setJustProvisioned(null)}>Готово</Button>}
      >
        <Typography.Paragraph type="warning">
          Секрет показывается один раз — сохраните его сейчас. Введите оба значения в форму настройки на планшете.
        </Typography.Paragraph>
        <Typography.Paragraph>
          <Typography.Text strong>ID устройства:</Typography.Text>
          <br />
          <Typography.Text code copyable>
            {justProvisioned?.device.id}
          </Typography.Text>
        </Typography.Paragraph>
        <Typography.Paragraph>
          <Typography.Text strong>Секрет:</Typography.Text>
          <br />
          <Typography.Text code copyable>
            {justProvisioned?.secret}
          </Typography.Text>
        </Typography.Paragraph>
      </Modal>
    </>
  );
}
