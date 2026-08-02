import { useQuery } from "@tanstack/react-query";
import { Card, Descriptions, Table, Tag, Typography } from "antd";
import { parentPortalApi } from "../api/parentPortal";
import { formatMinor, PAYMENT_METHOD_LABELS, type Invoice, type InvoiceLine, type InvoiceStatus } from "../api/types";

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Проект",
  APPROVED: "Утверждён",
  PARTIALLY_PAID: "Частично оплачен",
  PAID: "Оплачен",
  CANCELLED: "Отменён",
};

const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: "default",
  APPROVED: "blue",
  PARTIALLY_PAID: "gold",
  PAID: "green",
  CANCELLED: "red",
};

export default function ParentBillingPage() {
  const { data: balance } = useQuery({ queryKey: ["parent", "balance"], queryFn: parentPortalApi.balance });
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["parent", "invoices"],
    queryFn: parentPortalApi.invoices,
  });
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["parent", "payments"],
    queryFn: parentPortalApi.payments,
  });

  return (
    <>
      <Typography.Title level={4}>Счета и оплата</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Начислено всего">
            {formatMinor(balance?.totalInvoicedMinor ?? 0)}
          </Descriptions.Item>
          <Descriptions.Item label="Оплачено всего">
            {formatMinor(balance?.totalPaidMinor ?? 0)}
          </Descriptions.Item>
          <Descriptions.Item label="Баланс">
            <strong>{formatMinor(balance?.balanceMinor ?? 0)}</strong>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Счета" style={{ marginBottom: 16 }}>
        <Table
          rowKey="id"
          size="small"
          loading={invoicesLoading}
          dataSource={invoices}
          pagination={false}
          locale={{ emptyText: "Пока нет счетов" }}
          columns={[
            { title: "Период", key: "period", render: (_, i: Invoice) => `${i.month}/${i.year}` },
            {
              title: "Статус",
              dataIndex: "status",
              render: (s: InvoiceStatus) => <Tag color={INVOICE_STATUS_COLORS[s]}>{INVOICE_STATUS_LABELS[s]}</Tag>,
            },
            { title: "Сумма", key: "total", render: (_, i: Invoice) => formatMinor(i.totalMinor) },
          ]}
          expandable={{
            rowExpandable: (i) => Boolean(i.lines?.length),
            expandedRowRender: (i) => (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={i.lines}
                columns={[
                  { title: "Описание", dataIndex: "description" },
                  {
                    title: "Сумма",
                    key: "amount",
                    render: (_, l: InvoiceLine) => formatMinor(l.amountMinor),
                  },
                ]}
              />
            ),
          }}
        />
      </Card>

      <Card title="Оплаты">
        <Table
          rowKey="id"
          size="small"
          loading={paymentsLoading}
          dataSource={payments}
          pagination={false}
          locale={{ emptyText: "Пока нет оплат" }}
          columns={[
            {
              title: "Дата",
              dataIndex: "paidAt",
              render: (v: string) => new Date(v).toLocaleDateString("ru-RU"),
            },
            { title: "Способ", dataIndex: "method", render: (m: keyof typeof PAYMENT_METHOD_LABELS) => PAYMENT_METHOD_LABELS[m] },
            { title: "Сумма", key: "amount", render: (_, p) => formatMinor(p.amountMinor) },
          ]}
        />
      </Card>
    </>
  );
}
