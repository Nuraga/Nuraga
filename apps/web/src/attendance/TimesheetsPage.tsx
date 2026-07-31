import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, DatePicker, Popconfirm, Space, Table, Tag, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { timesheetsApi } from "../api/attendance";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export default function TimesheetsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["timesheet-periods", branchId],
    queryFn: () => timesheetsApi.listPeriods(branchId),
    enabled: Boolean(branchId),
  });

  const [closeTarget, setCloseTarget] = useState<Dayjs>(dayjs());

  const closeMutation = useMutation({
    mutationFn: () => timesheetsApi.closePeriod(branchId, closeTarget.year(), closeTarget.month() + 1),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["timesheet-periods", branchId] });
      message.success("Период закрыт");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Табели
        </Typography.Title>
        <Space>
          <DatePicker picker="month" value={closeTarget} onChange={(d) => d && setCloseTarget(d)} allowClear={false} />
          <Popconfirm
            title="Закрыть период?"
            description="После закрытия изменить посещаемость можно будет только через корректировку."
            onConfirm={() => closeMutation.mutate()}
          >
            <Button type="primary" loading={closeMutation.isPending}>
              Закрыть период
            </Button>
          </Popconfirm>
        </Space>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={periods}
        columns={[
          { title: "Год", dataIndex: "year" },
          { title: "Месяц", dataIndex: "month", render: (m: number) => MONTH_NAMES[m - 1] },
          {
            title: "Статус",
            dataIndex: "status",
            render: (s: string) => (s === "CLOSED" ? <Tag>Закрыт</Tag> : <Tag color="green">Открыт</Tag>),
          },
          { title: "Закрыт", dataIndex: "closedAt" },
        ]}
      />
    </>
  );
}
