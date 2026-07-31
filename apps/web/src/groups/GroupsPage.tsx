import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, InputNumber, Modal, Radio, Select, Space, Switch, Table, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { groupsApi } from "../api/groups";
import { groupTypesApi, dischargeReasonsApi } from "../api/dictionaries";
import { enrollmentApi } from "../api/enrollment";
import type { Group } from "../api/types";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

export default function GroupsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups", branchId],
    queryFn: () => groupsApi.list(branchId),
    enabled: Boolean(branchId),
  });
  const { data: groupTypes = [] } = useQuery({ queryKey: ["group-types"], queryFn: groupTypesApi.list });
  const { data: dischargeReasons = [] } = useQuery({
    queryKey: ["discharge-reasons"],
    queryFn: dischargeReasonsApi.list,
  });

  const [editing, setEditing] = useState<Group | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const [promoting, setPromoting] = useState<Group | null>(null);
  const [promoteForm] = Form.useForm();
  const promoteMutation = useMutation({
    mutationFn: (values: { mode: "transfer" | "discharge"; toGroupId?: string; dischargeReasonId?: string }) =>
      enrollmentApi.promoteGroup(branchId, promoting!.id, {
        toGroupId: values.mode === "transfer" ? values.toGroupId : undefined,
        dischargeReasonId: values.mode === "discharge" ? values.dischargeReasonId : undefined,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["groups", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["children", branchId] });
      setPromoting(null);
      message.success(
        `Переведено/отчислено: ${result.succeeded.length} из ${result.total}` +
          (result.failed.length ? `, ошибок: ${result.failed.length}` : ""),
      );
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(group: Group) {
    setEditing(group);
    form.setFieldsValue(group);
    setModalOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (values: {
      groupTypeId: string;
      name: string;
      plannedCapacity: number;
      maxCapacity: number;
      isActive?: boolean;
    }) => (editing ? groupsApi.update(branchId, editing.id, values) : groupsApi.create(branchId, values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups", branchId] });
      setModalOpen(false);
      message.success(editing ? "Группа обновлена" : "Группа создана");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка сохранения"),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => groupsApi.archive(branchId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["groups", branchId] });
      message.success("Группа архивирована");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Группы
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новая группа
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={groups}
        columns={[
          { title: "Название", dataIndex: "name" },
          { title: "Тип", dataIndex: ["groupType", "name"] },
          { title: "Плановая вместимость", dataIndex: "plannedCapacity" },
          { title: "Макс. вместимость", dataIndex: "maxCapacity" },
          {
            title: "Статус",
            dataIndex: "isActive",
            render: (isActive: boolean) =>
              isActive ? <Tag color="green">Активна</Tag> : <Tag>Архив</Tag>,
          },
          {
            title: "",
            key: "actions",
            render: (_, group: Group) => (
              <Space>
                <Button size="small" onClick={() => openEdit(group)}>
                  Изменить
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    promoteForm.resetFields();
                    setPromoting(group);
                  }}
                >
                  Перевод/выпуск
                </Button>
                {group.isActive && (
                  <Button
                    size="small"
                    danger
                    loading={archiveMutation.isPending}
                    onClick={() => archiveMutation.mutate(group.id)}
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
        title={editing ? "Изменить группу" : "Новая группа"}
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
          <Form.Item
            label="Тип группы"
            name="groupTypeId"
            rules={[{ required: true, message: "Выберите тип группы" }]}
          >
            <Select
              options={groupTypes.map((gt) => ({ value: gt.id, label: gt.name, disabled: !gt.isActive }))}
            />
          </Form.Item>
          <Form.Item
            label="Плановая вместимость"
            name="plannedCapacity"
            rules={[{ required: true, message: "Укажите плановую вместимость" }]}
          >
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            label="Максимальная вместимость"
            name="maxCapacity"
            rules={[{ required: true, message: "Укажите максимальную вместимость" }]}
          >
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          {editing && (
            <Form.Item label="Активна" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title={`Массовый перевод/выпуск: ${promoting?.name ?? ""}`}
        open={Boolean(promoting)}
        onCancel={() => setPromoting(null)}
        onOk={() => promoteForm.submit()}
        confirmLoading={promoteMutation.isPending}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">
          Переводит или отчисляет всех зачисленных детей группы «{promoting?.name}» одним подтверждением.
        </Typography.Paragraph>
        <Form
          form={promoteForm}
          layout="vertical"
          initialValues={{ mode: "transfer" }}
          onFinish={(values) => promoteMutation.mutate(values)}
        >
          <Form.Item name="mode">
            <Radio.Group
              options={[
                { value: "transfer", label: "Перевести в группу" },
                { value: "discharge", label: "Отчислить (выпуск)" },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.mode !== cur.mode}>
            {({ getFieldValue }) =>
              getFieldValue("mode") === "transfer" ? (
                <Form.Item
                  label="Целевая группа"
                  name="toGroupId"
                  rules={[{ required: true, message: "Выберите группу" }]}
                >
                  <Select
                    options={groups
                      .filter((g) => g.id !== promoting?.id)
                      .map((g) => ({ value: g.id, label: g.name }))}
                  />
                </Form.Item>
              ) : (
                <Form.Item
                  label="Причина отчисления"
                  name="dischargeReasonId"
                  rules={[{ required: true, message: "Выберите причину" }]}
                >
                  <Select
                    options={dischargeReasons.map((r) => ({ value: r.id, label: r.name, disabled: !r.isActive }))}
                  />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
