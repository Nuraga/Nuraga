import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, InputNumber, Modal, Space, Switch, Table, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { servicesApi } from "../api/services";
import { formatMinor } from "../api/types";
import type { Service } from "../api/types";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

export default function ServicesPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services", branchId],
    queryFn: () => servicesApi.listForBranch(branchId),
    enabled: Boolean(branchId),
  });

  const [editing, setEditing] = useState<Service | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["services", branchId] });

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  }
  function openEdit(service: Service) {
    setEditing(service);
    form.setFieldsValue({ ...service, price: service.priceMinor / 100 });
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (values: { name: string; price?: number; scheduleInfo?: string; capacity?: number; isActive?: boolean }) => {
      const dto = {
        name: values.name,
        scheduleInfo: values.scheduleInfo,
        capacity: values.capacity,
        isActive: values.isActive,
        ...(values.price !== undefined ? { priceMinor: Math.round(values.price * 100) } : {}),
      };
      return editing ? servicesApi.update(branchId, editing.id, dto) : servicesApi.create(branchId, dto as never);
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      message.success(editing ? "Услуга обновлена" : "Услуга создана");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка сохранения"),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => servicesApi.archive(branchId, id),
    onSuccess: () => {
      invalidate();
      message.success("Услуга архивирована");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Услуги
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новая услуга
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={services}
        columns={[
          { title: "Название", dataIndex: "name" },
          { title: "Стоимость", key: "price", render: (_, s: Service) => formatMinor(s.priceMinor) },
          { title: "Расписание", dataIndex: "scheduleInfo" },
          { title: "Лимит мест", dataIndex: "capacity" },
          {
            title: "Статус",
            dataIndex: "isActive",
            render: (v: boolean) => (v ? <Tag color="green">Активна</Tag> : <Tag>Архив</Tag>),
          },
          {
            title: "",
            key: "actions",
            render: (_, s: Service) => (
              <Space>
                <Button size="small" onClick={() => openEdit(s)}>
                  Изменить
                </Button>
                {s.isActive && (
                  <Button size="small" danger onClick={() => archiveMutation.mutate(s.id)}>
                    В архив
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? "Изменить услугу" : "Новая услуга"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(values) => saveMutation.mutate(values)}>
          <Form.Item label="Название" name="name" rules={[{ required: true, message: "Укажите название" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Стоимость (KZT)"
            name="price"
            rules={[{ required: true, message: "Укажите стоимость" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Расписание" name="scheduleInfo">
            <Input placeholder="Пн/Ср/Пт, 16:00" />
          </Form.Item>
          <Form.Item label="Лимит мест" name="capacity">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          {editing && (
            <Form.Item label="Активна" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
