import { useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  TimePicker,
  Typography,
} from "antd";
import { LeftOutlined, PlusOutlined, RightOutlined } from "@ant-design/icons";
import { shiftsApi } from "../api/shifts";
import { staffApi } from "../api/staff";
import type { Shift } from "../api/types";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";
import { useBranchRoles, hasAnyRole } from "../auth/roles";

const SHIFT_WRITE_ROLES = ["OWNER", "BRANCH_MANAGER"] as const;

function weekDates(weekStart: Dayjs): Dayjs[] {
  return Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day"));
}

function DayCard({
  date,
  shifts,
  canEdit,
  onAdd,
  onRemove,
}: {
  date: Dayjs;
  shifts: Shift[];
  canEdit: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card
      size="small"
      title={date.toDate().toLocaleDateString("ru-RU", { weekday: "short", day: "2-digit", month: "2-digit" })}
      style={{ minWidth: 220, flex: "1 0 220px" }}
      extra={
        canEdit && (
          <Button size="small" icon={<PlusOutlined />} onClick={onAdd}>
            Смена
          </Button>
        )
      }
    >
      {shifts.length === 0 ? (
        <Typography.Text type="secondary">—</Typography.Text>
      ) : (
        <Space direction="vertical" style={{ width: "100%" }} size={6}>
          {shifts.map((s) => (
            <div key={s.id}>
              <Typography.Text strong style={{ fontSize: 13 }}>
                {s.startTime}–{s.endTime}
              </Typography.Text>
              <br />
              <Typography.Text style={{ fontSize: 13 }}>{s.staffFullName}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {" "}
                ({s.position})
              </Typography.Text>
              {canEdit && (
                <Popconfirm title="Удалить смену?" onConfirm={() => onRemove(s.id)}>
                  <a style={{ marginLeft: 8, fontSize: 12 }}>удалить</a>
                </Popconfirm>
              )}
            </div>
          ))}
        </Space>
      )}
    </Card>
  );
}

export default function ShiftsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;
  const branchRoles = useBranchRoles(branchId);
  const canEdit = hasAnyRole(branchRoles, [...SHIFT_WRITE_ROLES]);

  const [weekStart, setWeekStart] = useState<Dayjs>(dayjs().startOf("week"));
  const days = useMemo(() => weekDates(weekStart), [weekStart]);
  const from = days[0].format("YYYY-MM-DD");
  const to = days[6].format("YYYY-MM-DD");

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["shifts", branchId, from, to],
    queryFn: () => shiftsApi.list(branchId, from, to),
    enabled: Boolean(branchId),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff", branchId],
    queryFn: () => staffApi.list(branchId),
    enabled: Boolean(branchId) && canEdit,
  });
  const staffOptions = staff.map((s) => ({ value: s.id, label: `${s.user?.fullName ?? "—"} — ${s.position}` }));

  const [addDate, setAddDate] = useState<string | null>(null);
  const [form] = Form.useForm<{ staffId: string; time: [Dayjs, Dayjs]; note?: string }>();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["shifts", branchId] });

  const create = useMutation({
    mutationFn: (values: { staffId: string; time: [Dayjs, Dayjs]; note?: string }) =>
      shiftsApi.create(branchId, {
        staffId: values.staffId,
        date: addDate!,
        startTime: values.time[0].format("HH:mm"),
        endTime: values.time[1].format("HH:mm"),
        note: values.note,
      }),
    onSuccess: () => {
      invalidate();
      message.success("Смена добавлена");
      setAddDate(null);
      form.resetFields();
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => shiftsApi.remove(branchId, id),
    onSuccess: () => {
      invalidate();
      message.success("Смена удалена");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of shifts) {
      const list = map.get(shift.date) ?? [];
      list.push(shift);
      map.set(shift.date, list);
    }
    return map;
  }, [shifts]);

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          График смен
        </Typography.Title>
        <Space>
          <Button icon={<LeftOutlined />} onClick={() => setWeekStart((w) => w.subtract(1, "week"))} />
          <Typography.Text>
            {days[0].format("DD.MM")} – {days[6].format("DD.MM.YYYY")}
          </Typography.Text>
          <Button icon={<RightOutlined />} onClick={() => setWeekStart((w) => w.add(1, "week"))} />
        </Space>
      </Space>

      {staff.length === 0 && canEdit && !isLoading && (
        <Typography.Paragraph type="secondary">
          В филиале пока нет сотрудников — добавьте их на странице «Сотрудники», прежде чем планировать смены.
        </Typography.Paragraph>
      )}

      <Flex gap={12} style={{ overflowX: "auto", paddingBottom: 8 }}>
        {!isLoading &&
          days.map((date) => {
            const dateStr = date.format("YYYY-MM-DD");
            return (
              <DayCard
                key={dateStr}
                date={date}
                shifts={shiftsByDate.get(dateStr) ?? []}
                canEdit={canEdit}
                onAdd={() => setAddDate(dateStr)}
                onRemove={(id) => remove.mutate(id)}
              />
            );
          })}
      </Flex>

      {!isLoading && shifts.length === 0 && <Empty style={{ marginTop: 24 }} description="На эту неделю смен нет" />}

      <Modal
        title={addDate ? `Новая смена на ${dayjs(addDate).format("DD.MM.YYYY")}` : ""}
        open={Boolean(addDate)}
        onCancel={() => setAddDate(null)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(values) => create.mutate(values)}>
          <Form.Item label="Сотрудник" name="staffId" rules={[{ required: true, message: "Выберите сотрудника" }]}>
            <Select options={staffOptions} placeholder="Не выбрано" showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item label="Время" name="time" rules={[{ required: true, message: "Укажите время смены" }]}>
            <TimePicker.RangePicker format="HH:mm" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Заметка" name="note">
            <Input placeholder="Необязательно" maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
