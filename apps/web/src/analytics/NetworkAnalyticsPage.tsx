import { useQuery } from "@tanstack/react-query";
import { Card, Col, Row, Statistic, Table, Typography } from "antd";
import { networkAnalyticsApi } from "../api/networkAnalytics";
import { formatMinor, type NetworkMonthRow } from "../api/types";

function monthLabel(row: { year: number; month: number }): string {
  return new Date(Date.UTC(row.year, row.month - 1, 1)).toLocaleDateString("ru-RU", {
    month: "short",
    year: "numeric",
  });
}

export default function NetworkAnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["network-analytics", "dashboard"],
    queryFn: networkAnalyticsApi.dashboard,
  });

  const monthly = data?.monthly ?? [];
  const totalInvoicedMinor = monthly.reduce((sum, m) => sum + m.invoicedMinor, 0);
  const totalPaidMinor = monthly.reduce((sum, m) => sum + m.paidMinor, 0);
  const netChildGrowth = monthly.reduce((sum, m) => sum + m.enrolledCount - m.dischargedCount, 0);
  const totalNewLeads = monthly.reduce((sum, m) => sum + m.newLeads, 0);
  const totalEnrolledLeads = monthly.reduce((sum, m) => sum + m.enrolledLeads, 0);
  const avgConversion = totalNewLeads === 0 ? 0 : totalEnrolledLeads / totalNewLeads;
  const attendanceMonths = monthly.filter((m) => m.avgAttendanceRate !== null);
  const avgAttendance =
    attendanceMonths.length === 0
      ? null
      : attendanceMonths.reduce((sum, m) => sum + (m.avgAttendanceRate ?? 0), 0) / attendanceMonths.length;

  const occupancyRate =
    !data || data.occupancyTotals.plannedCapacity === 0
      ? 0
      : (data.occupancyTotals.enrolled / data.occupancyTotals.plannedCapacity) * 100;

  return (
    <>
      <Typography.Title level={3}>Аналитика сети</Typography.Title>
      <Typography.Paragraph type="secondary">
        Сводно по всем филиалам. Заполняемость — на сегодня, остальное — динамика за последние 12 месяцев.
      </Typography.Paragraph>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card size="small" loading={isLoading}>
            <Statistic
              title="Заполняемость сети"
              value={occupancyRate}
              precision={0}
              suffix="%"
              valueStyle={occupancyRate > 100 ? { color: "#cf1322" } : undefined}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {data?.occupancyTotals.enrolled ?? 0} из {data?.occupancyTotals.plannedCapacity ?? 0} плановых мест
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" loading={isLoading}>
            <Statistic title="Выручка за 12 мес (оплачено)" value={formatMinor(totalPaidMinor)} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              начислено {formatMinor(totalInvoicedMinor)}
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" loading={isLoading}>
            <Statistic
              title="Чистый прирост детей за 12 мес"
              value={netChildGrowth}
              valueStyle={netChildGrowth < 0 ? { color: "#cf1322" } : { color: "#3f8600" }}
              prefix={netChildGrowth > 0 ? "+" : undefined}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" loading={isLoading}>
            <Statistic title="Конверсия лидов" value={Math.round(avgConversion * 100)} suffix="%" />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {totalEnrolledLeads} зачислено из {totalNewLeads} лидов
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      <Card title="Заполняемость по филиалам" style={{ marginBottom: 24 }}>
        <Table
          rowKey="branchId"
          loading={isLoading}
          dataSource={data?.occupancy ?? []}
          pagination={false}
          columns={[
            { title: "Филиал", dataIndex: "branchName" },
            { title: "Зачислено", dataIndex: "enrolled" },
            { title: "План", dataIndex: "plannedCapacity" },
            { title: "Максимум", dataIndex: "maxCapacity" },
            {
              title: "Заполняемость",
              key: "rate",
              render: (_, r) =>
                r.plannedCapacity === 0 ? "—" : `${Math.round((r.enrolled / r.plannedCapacity) * 100)}%`,
            },
          ]}
        />
      </Card>

      <Card title="Динамика за 12 месяцев">
        <Table
          rowKey={(r: NetworkMonthRow) => `${r.year}-${r.month}`}
          loading={isLoading}
          dataSource={monthly}
          pagination={false}
          scroll={{ x: true }}
          columns={[
            { title: "Месяц", key: "period", render: (_, r) => monthLabel(r), fixed: "left" },
            { title: "Начислено", key: "invoiced", render: (_, r) => formatMinor(r.invoicedMinor) },
            { title: "Оплачено", key: "paid", render: (_, r) => formatMinor(r.paidMinor) },
            { title: "Зачислено", dataIndex: "enrolledCount" },
            { title: "Отчислено", dataIndex: "dischargedCount" },
            {
              title: "Прирост",
              key: "net",
              render: (_, r) => {
                const net = r.enrolledCount - r.dischargedCount;
                return net > 0 ? `+${net}` : net;
              },
            },
            { title: "Новых лидов", dataIndex: "newLeads" },
            {
              title: "Конверсия",
              key: "conversion",
              render: (_, r) => `${Math.round(r.conversionRate * 100)}%`,
            },
            {
              title: "Посещаемость",
              key: "attendance",
              render: (_, r) => (r.avgAttendanceRate === null ? "—" : `${Math.round(r.avgAttendanceRate * 100)}%`),
            },
          ]}
        />
      </Card>

      {avgAttendance !== null && (
        <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
          Средняя посещаемость за период: {Math.round(avgAttendance * 100)}%
        </Typography.Paragraph>
      )}
    </>
  );
}
