import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { tariffsApi } from "../api/tariffs";
import type { CreateTariffInput } from "../api/tariffs";
import { RECALC_RULES, RECURRENCE_PERIODS, TARIFF_TYPES, formatMinor } from "../api/types";
import type { Tariff } from "../api/types";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

const TYPE_LABELS: Record<string, string> = {
  MONTHLY_FULL: "Полный день (абонемент)",
  MONTHLY_HALF_DAY: "Полдня (абонемент)",
  HOURLY: "Почасовой",
  PAY_AS_YOU_GO: "По факту посещения",
  DUTY_GROUP: "Дежурная группа",
};
const RECURRENCE_LABELS: Record<string, string> = {
  MONTHLY: "Ежемесячно",
  ONE_TIME: "Разово",
  PER_VISIT: "За посещение",
};
const RECALC_LABELS: Record<string, string> = {
  NONE: "Не пересчитывается",
  MEALS_ONLY: "Только питание",
  FULL_DAY_WITH_THRESHOLD: "Полная стоимость дня (с порогом)",
};

export default function TariffsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const { data: tariffs = [], isLoading } = useQuery({
    queryKey: ["tariffs", branchId],
    queryFn: () => tariffsApi.listForBranch(branchId),
    enabled: Boolean(branchId),
  });

  const [editing, setEditing] = useState<Tariff | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tariffs", branchId] });

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  }
  function openEdit(tariff: Tariff) {
    setEditing(tariff);
    form.setFieldsValue({ ...tariff, recalcThresholdDays: tariff.recalcThresholdDays ?? undefined });
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => {
      if (editing) {
        return tariffsApi.update(editing.id, values);
      }
      const dto: CreateTariffInput = {
        name: values.name as string,
        type: values.type as CreateTariffInput["type"],
        baseAmountMinor: Math.round((values.amount as number) * 100),
        recurrence: values.recurrence as CreateTariffInput["recurrence"],
        recalcRule: values.recalcRule as CreateTariffInput["recalcRule"],
        recalcThresholdDays: values.recalcThresholdDays as number | undefined,
        includesDescription: values.includesDescription as string | undefined,
        validFrom: values.validFrom as string,
        branchId: values.branchOnly ? branchId : undefined,
      };
      return tariffsApi.create(dto);
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      message.success(editing ? "Тариф обновлён" : "Тариф создан");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка сохранения"),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => tariffsApi.archive(id),
    onSuccess: () => {
      invalidate();
      message.success("Тариф архивирован");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Тарифы
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новый тариф
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={tariffs}
        columns={[
          { title: "Название", dataIndex: "name" },
          { title: "Тип", dataIndex: "type", render: (t: string) => TYPE_LABELS[t] },
          {
            title: "Стоимость",
            key: "amount",
            render: (_, t: Tariff) => formatMinor(t.baseAmountMinor, t.currency),
          },
          { title: "Периодичность", dataIndex: "recurrence", render: (r: string) => RECURRENCE_LABELS[r] },
          {
            title: "Область",
            key: "scope",
            render: (_, t: Tariff) => (t.branchId ? <Tag>Этот филиал</Tag> : <Tag color="blue">Вся сеть</Tag>),
          },
          {
            title: "Статус",
            dataIndex: "isActive",
            render: (v: boolean) => (v ? <Tag color="green">Активен</Tag> : <Tag>Архив</Tag>),
          },
          {
            title: "",
            key: "actions",
            render: (_, t: Tariff) => (
              <Space>
                <Button size="small" onClick={() => openEdit(t)}>
                  Изменить
                </Button>
                {t.isActive && (
                  <Button size="small" danger onClick={() => archiveMutation.mutate(t.id)}>
                    В архив
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? "Изменить тариф" : "Новый тариф"}
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
          {!editing && (
            <>
              <Form.Item label="Тип" name="type" rules={[{ required: true, message: "Выберите тип" }]}>
                <Select options={TARIFF_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))} />
              </Form.Item>
              <Form.Item
                label="Стоимость (KZT)"
                name="amount"
                rules={[{ required: true, message: "Укажите стоимость" }]}
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item
                label="Периодичность"
                name="recurrence"
                rules={[{ required: true, message: "Выберите периодичность" }]}
              >
                <Select options={RECURRENCE_PERIODS.map((r) => ({ value: r, label: RECURRENCE_LABELS[r] }))} />
              </Form.Item>
              <Form.Item label="Только для текущего филиала" name="branchOnly" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item
                label="Дата начала действия"
                name="validFrom"
                rules={[{ required: true, message: "Укажите дату" }]}
              >
                <Input type="date" />
              </Form.Item>
            </>
          )}
          <Form.Item label="Правило перерасчёта" name="recalcRule">
            <Select
              allowClear
              options={RECALC_RULES.map((r) => ({ value: r, label: RECALC_LABELS[r] }))}
            />
          </Form.Item>
          <Form.Item label="Порог пересчёта (дней)" name="recalcThresholdDays">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Что включено" name="includesDescription">
            <Input.TextArea rows={2} />
          </Form.Item>
          {editing && (
            <>
              <Form.Item label="Дата окончания действия" name="validTo">
                <Input type="date" />
              </Form.Item>
              <Form.Item label="Активен" name="isActive" valuePropName="checked">
                <Switch />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </>
  );
}
