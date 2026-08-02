import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { invoicingApi } from "../api/invoicing";
import { formatMinor, type Invoice, type InvoiceLine } from "../api/types";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Черновик", color: "gold" },
  APPROVED: { label: "Утверждён", color: "blue" },
  PARTIALLY_PAID: { label: "Частично оплачен", color: "orange" },
  PAID: { label: "Оплачен", color: "green" },
  CANCELLED: { label: "Отменён", color: "default" },
};
const LINE_TYPE_LABELS: Record<string, string> = {
  TARIFF: "Абонплата",
  SERVICE: "Услуга",
  FINE: "Штраф",
  RECALC: "Перерасчёт",
  DISCOUNT: "Скидка",
  MANUAL_ADJUSTMENT: "Ручная корректировка",
  PREVIOUS_BALANCE: "Зачёт баланса",
};

export default function InvoicingPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const [period, setPeriod] = useState<Dayjs>(dayjs());
  const year = period.year();
  const month = period.month() + 1;

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", branchId, year, month],
    queryFn: () => invoicingApi.listForBranch(branchId, year, month),
    enabled: Boolean(branchId),
  });

  const invalidateList = () => queryClient.invalidateQueries({ queryKey: ["invoices", branchId, year, month] });

  const generateMutation = useMutation({
    mutationFn: () => invoicingApi.generate(branchId, year, month),
    onSuccess: (result) => {
      invalidateList();
      message.success(`Сформировано счетов: ${result.totalFamilies}`);
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка формирования"),
  });

  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: detail } = useQuery({
    queryKey: ["invoice", branchId, detailId],
    queryFn: () => invoicingApi.getOne(branchId, detailId!),
    enabled: Boolean(detailId),
  });

  const invalidateDetail = () => {
    void invalidateList();
    void queryClient.invalidateQueries({ queryKey: ["invoice", branchId, detailId] });
  };

  const [adjustForm] = Form.useForm();
  const addAdjustment = useMutation({
    mutationFn: (values: { description: string; amount: number; comment: string }) =>
      invoicingApi.addAdjustment(branchId, detailId!, {
        description: values.description,
        amountMinor: Math.round(values.amount * 100),
        comment: values.comment,
      }),
    onSuccess: () => {
      invalidateDetail();
      adjustForm.resetFields();
      message.success("Корректировка добавлена");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const approveMutation = useMutation({
    mutationFn: () => invoicingApi.approve(branchId, detailId!),
    onSuccess: () => {
      invalidateDetail();
      message.success("Счёт утверждён");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Начисления
        </Typography.Title>
        <Space>
          <DatePicker picker="month" value={period} onChange={(d) => d && setPeriod(d)} allowClear={false} />
          <Popconfirm
            title="Сформировать начисления за период?"
            description="Требуется закрытый табель посещаемости за этот месяц."
            onConfirm={() => generateMutation.mutate()}
          >
            <Button type="primary" loading={generateMutation.isPending}>
              Сформировать начисления
            </Button>
          </Popconfirm>
        </Space>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={invoices}
        onRow={(inv) => ({ onClick: () => setDetailId(inv.id), style: { cursor: "pointer" } })}
        columns={[
          { title: "Семья", key: "family", render: (_, inv: Invoice) => inv.family?.name },
          { title: "Сумма", key: "total", render: (_, inv: Invoice) => formatMinor(inv.totalMinor) },
          {
            title: "Статус",
            dataIndex: "status",
            render: (s: string) => <Tag color={STATUS_LABELS[s].color}>{STATUS_LABELS[s].label}</Tag>,
          },
        ]}
      />

      <Modal
        title={detail ? `Счёт: ${detail.family?.name ?? ""} — ${detail.month}/${detail.year}` : "Счёт"}
        open={Boolean(detailId)}
        onCancel={() => setDetailId(null)}
        footer={null}
        width={700}
        destroyOnClose
      >
        {detail && (
          <>
            <Space style={{ marginBottom: 16 }}>
              <Tag color={STATUS_LABELS[detail.status].color}>{STATUS_LABELS[detail.status].label}</Tag>
              <Typography.Text strong>Итого: {formatMinor(detail.totalMinor)}</Typography.Text>
            </Space>

            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detail.lines ?? []}
              columns={[
                { title: "Тип", dataIndex: "type", render: (t: string) => LINE_TYPE_LABELS[t] },
                { title: "Описание", dataIndex: "description" },
                {
                  title: "Сумма",
                  key: "amount",
                  render: (_, l: InvoiceLine) => formatMinor(l.amountMinor),
                },
              ]}
              style={{ marginBottom: 16 }}
            />

            {detail.status === "DRAFT" && (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="Черновик можно скорректировать вручную перед утверждением. После утверждения счёт неизменяем."
                  style={{ marginBottom: 16 }}
                />
                <Form
                  form={adjustForm}
                  layout="inline"
                  onFinish={(values) => addAdjustment.mutate(values)}
                  style={{ marginBottom: 16, flexWrap: "wrap", rowGap: 8 }}
                >
                  <Form.Item name="description" rules={[{ required: true, message: "Описание" }]}>
                    <Input placeholder="Описание" style={{ width: 180 }} />
                  </Form.Item>
                  <Form.Item name="amount" rules={[{ required: true, message: "Сумма" }]}>
                    <InputNumber placeholder="Сумма (KZT, +/-)" style={{ width: 160 }} />
                  </Form.Item>
                  <Form.Item name="comment" rules={[{ required: true, message: "Причина" }]}>
                    <Input placeholder="Причина корректировки" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item>
                    <Button htmlType="submit" loading={addAdjustment.isPending}>
                      Добавить корректировку
                    </Button>
                  </Form.Item>
                </Form>

                <Popconfirm
                  title="Утвердить счёт?"
                  description="После утверждения изменить его будет нельзя."
                  onConfirm={() => approveMutation.mutate()}
                >
                  <Button type="primary" loading={approveMutation.isPending}>
                    Утвердить счёт
                  </Button>
                </Popconfirm>
              </>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
