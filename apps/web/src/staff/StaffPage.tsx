import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  TimePicker,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { PlusOutlined } from "@ant-design/icons";
import { staffApi, STAFF_GRANTABLE_ROLES, DEFAULT_CHECK_IN_TIME, DEFAULT_CHECK_OUT_TIME } from "../api/staff";
import { groupsApi } from "../api/groups";
import type { CreateStaffInput } from "../api/staff";
import type { Staff, StaffVacation } from "../api/types";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

const { RangePicker } = DatePicker;

/** The staff member's active vacation, if today falls within one — used for the status tag and to gate the kiosk-attendance yellow flag elsewhere. */
function currentVacation(staff: Staff): StaffVacation | undefined {
  const today = dayjs().format("YYYY-MM-DD");
  return staff.vacations?.find((v) => v.startDate.slice(0, 10) <= today && today <= v.endDate.slice(0, 10));
}

const ROLE_LABELS: Record<string, string> = {
  BRANCH_MANAGER: "Управляющий филиалом",
  MANAGER: "Менеджер",
  ACCOUNTANT: "Бухгалтер",
  TEACHER: "Воспитатель",
  NANNY: "Няня",
  METHODIST: "Методист",
};

export default function StaffPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const [includeTerminated, setIncludeTerminated] = useState(false);
  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff", branchId, includeTerminated],
    queryFn: () => staffApi.list(branchId, includeTerminated),
    enabled: Boolean(branchId),
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["groups", branchId],
    queryFn: () => groupsApi.list(branchId),
    enabled: Boolean(branchId),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<Staff | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Staff | null>(null);
  const [vacationFor, setVacationFor] = useState<Staff | null>(null);
  const [form] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [scheduleForm] = Form.useForm();
  const [vacationForm] = Form.useForm();

  // Re-derive from the live list instead of the stale snapshot captured when
  // the modal opened, so an add/remove inside the "Отпуск" modal shows up
  // immediately without closing and reopening it.
  const vacationForLive = vacationFor ? (staff.find((s) => s.id === vacationFor.id) ?? vacationFor) : null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["staff", branchId] });

  const createMutation = useMutation({
    mutationFn: (values: CreateStaffInput) => staffApi.create(branchId, values),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      message.success("Сотрудник добавлен");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const assignMutation = useMutation({
    mutationFn: ({ staffId, groupId }: { staffId: string; groupId: string }) =>
      staffApi.assignGroup(branchId, staffId, groupId),
    onSuccess: () => {
      invalidate();
      setAssignFor(null);
      message.success("Группа назначена");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const unassignMutation = useMutation({
    mutationFn: ({ staffId, groupId }: { staffId: string; groupId: string }) =>
      staffApi.unassignGroup(branchId, staffId, groupId),
    onSuccess: invalidate,
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const terminateMutation = useMutation({
    mutationFn: (staffId: string) => staffApi.terminate(branchId, staffId),
    onSuccess: () => {
      invalidate();
      message.success("Сотрудник уволен");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const scheduleMutation = useMutation({
    mutationFn: ({
      staffId,
      checkInTime,
      checkOutTime,
    }: {
      staffId: string;
      checkInTime: string | null;
      checkOutTime: string | null;
    }) => staffApi.updateSchedule(branchId, staffId, checkInTime, checkOutTime),
    onSuccess: () => {
      invalidate();
      setScheduleFor(null);
      message.success("Расписание обновлено");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const addVacationMutation = useMutation({
    mutationFn: ({ staffId, startDate, endDate }: { staffId: string; startDate: string; endDate: string }) =>
      staffApi.addVacation(branchId, staffId, startDate, endDate),
    onSuccess: () => {
      invalidate();
      vacationForm.resetFields();
      message.success("Отпуск добавлен");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const removeVacationMutation = useMutation({
    mutationFn: ({ staffId, vacationId }: { staffId: string; vacationId: string }) =>
      staffApi.removeVacation(branchId, staffId, vacationId),
    onSuccess: invalidate,
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  function groupName(groupId: string) {
    return groups.find((g) => g.id === groupId)?.name ?? groupId;
  }

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Сотрудники
        </Typography.Title>
        <Space>
          <Switch checked={includeTerminated} onChange={setIncludeTerminated} />
          <Typography.Text>Показывать уволенных</Typography.Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Добавить сотрудника
          </Button>
        </Space>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={staff}
        columns={[
          { title: "ФИО", dataIndex: ["user", "fullName"] },
          { title: "Email", dataIndex: ["user", "email"] },
          { title: "Должность", dataIndex: "position" },
          {
            title: "Статус",
            key: "status",
            render: (_, record: Staff) => {
              if (record.terminatedAt) {
                return <Tag color="red">Уволен {new Date(record.terminatedAt).toLocaleDateString("ru-RU")}</Tag>;
              }
              const vacation = currentVacation(record);
              if (vacation) {
                return <Tag color="gold">В отпуске до {new Date(vacation.endDate).toLocaleDateString("ru-RU")}</Tag>;
              }
              return <Tag color="green">Работает</Tag>;
            },
          },
          {
            title: "Расписание",
            key: "schedule",
            render: (_, record: Staff) => (
              <Typography.Text type="secondary">
                {record.expectedCheckInTime ?? DEFAULT_CHECK_IN_TIME} – {record.expectedCheckOutTime ?? DEFAULT_CHECK_OUT_TIME}
              </Typography.Text>
            ),
          },
          {
            title: "Группы",
            key: "groups",
            render: (_, record: Staff) => (
              <Space wrap>
                {(record.groups ?? []).map((g) => (
                  <Tag
                    key={g.groupId}
                    closable
                    onClose={(e) => {
                      e.preventDefault();
                      unassignMutation.mutate({ staffId: record.id, groupId: g.groupId });
                    }}
                  >
                    {groupName(g.groupId)}
                  </Tag>
                ))}
              </Space>
            ),
          },
          {
            title: "",
            key: "actions",
            render: (_, record: Staff) =>
              !record.terminatedAt && (
                <Space wrap>
                  <Button size="small" onClick={() => setAssignFor(record)}>
                    Назначить группу
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setScheduleFor(record);
                      scheduleForm.setFieldsValue({
                        checkInTime: record.expectedCheckInTime ? dayjs(record.expectedCheckInTime, "HH:mm") : null,
                        checkOutTime: record.expectedCheckOutTime
                          ? dayjs(record.expectedCheckOutTime, "HH:mm")
                          : null,
                      });
                    }}
                  >
                    Расписание
                  </Button>
                  <Button size="small" onClick={() => setVacationFor(record)}>
                    Отпуск
                  </Button>
                  <Popconfirm
                    title="Уволить сотрудника?"
                    description="Доступ к филиалу будет отозван. История посещаемости и смен сохранится."
                    onConfirm={() => terminateMutation.mutate(record.id)}
                  >
                    <Button size="small" danger loading={terminateMutation.isPending}>
                      Уволить
                    </Button>
                  </Popconfirm>
                </Space>
              ),
          },
        ]}
      />

      <Modal
        title="Новый сотрудник"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values: CreateStaffInput) => {
            if (!values.email && !values.phone) {
              message.error("Укажите email или телефон");
              return;
            }
            createMutation.mutate(values);
          }}
        >
          <Form.Item label="ФИО" name="fullName" rules={[{ required: true, message: "Укажите ФИО" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            extra="Укажите email или телефон (или оба) — это логин для входа"
            rules={[{ type: "email", message: "Некорректный email" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Телефон" name="phone">
            <Input />
          </Form.Item>
          <Form.Item
            label="Пароль"
            name="password"
            rules={[
              { required: true, message: "Укажите пароль" },
              { min: 6, message: "Минимум 6 символов" },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item label="Роль" name="role" rules={[{ required: true, message: "Выберите роль" }]}>
            <Select
              options={STAFF_GRANTABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            />
          </Form.Item>
          <Form.Item label="Должность" name="position" rules={[{ required: true, message: "Укажите должность" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Дата приёма" name="hiredAt">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Назначить группу"
        open={Boolean(assignFor)}
        onCancel={() => setAssignFor(null)}
        onOk={() => assignForm.submit()}
        confirmLoading={assignMutation.isPending}
        destroyOnClose
      >
        <Form
          form={assignForm}
          layout="vertical"
          onFinish={(values: { groupId: string }) =>
            assignFor && assignMutation.mutate({ staffId: assignFor.id, groupId: values.groupId })
          }
        >
          <Form.Item label="Группа" name="groupId" rules={[{ required: true, message: "Выберите группу" }]}>
            <Select options={groups.map((g) => ({ value: g.id, label: g.name }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Расписание — ${scheduleFor?.user?.fullName ?? ""}`}
        open={Boolean(scheduleFor)}
        onCancel={() => setScheduleFor(null)}
        onOk={() => scheduleForm.submit()}
        confirmLoading={scheduleMutation.isPending}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">
          По умолчанию: приход не позже {DEFAULT_CHECK_IN_TIME}, уход не раньше {DEFAULT_CHECK_OUT_TIME}. Оставьте
          поле пустым, чтобы вернуть значение по умолчанию.
        </Typography.Paragraph>
        <Form
          form={scheduleForm}
          layout="vertical"
          onFinish={(values: { checkInTime?: Dayjs; checkOutTime?: Dayjs }) =>
            scheduleFor &&
            scheduleMutation.mutate({
              staffId: scheduleFor.id,
              checkInTime: values.checkInTime ? values.checkInTime.format("HH:mm") : null,
              checkOutTime: values.checkOutTime ? values.checkOutTime.format("HH:mm") : null,
            })
          }
        >
          <Form.Item label="Приход не позже" name="checkInTime">
            <TimePicker format="HH:mm" style={{ width: "100%" }} placeholder={DEFAULT_CHECK_IN_TIME} allowClear />
          </Form.Item>
          <Form.Item label="Уход не раньше" name="checkOutTime">
            <TimePicker format="HH:mm" style={{ width: "100%" }} placeholder={DEFAULT_CHECK_OUT_TIME} allowClear />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Отпуск — ${vacationFor?.user?.fullName ?? ""}`}
        open={Boolean(vacationFor)}
        onCancel={() => setVacationFor(null)}
        footer={<Button onClick={() => setVacationFor(null)}>Закрыть</Button>}
        destroyOnClose
      >
        <List
          style={{ marginBottom: 16 }}
          dataSource={vacationForLive?.vacations ?? []}
          locale={{ emptyText: "Отпусков нет" }}
          renderItem={(v: StaffVacation) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="del"
                  title="Удалить запись об отпуске?"
                  onConfirm={() =>
                    vacationFor && removeVacationMutation.mutate({ staffId: vacationFor.id, vacationId: v.id })
                  }
                >
                  <Button size="small" danger type="text">
                    Удалить
                  </Button>
                </Popconfirm>,
              ]}
            >
              {new Date(v.startDate).toLocaleDateString("ru-RU")} — {new Date(v.endDate).toLocaleDateString("ru-RU")}
            </List.Item>
          )}
        />
        <Form
          form={vacationForm}
          layout="vertical"
          onFinish={(values: { range: [Dayjs, Dayjs] }) =>
            vacationFor &&
            addVacationMutation.mutate({
              staffId: vacationFor.id,
              startDate: values.range[0].format("YYYY-MM-DD"),
              endDate: values.range[1].format("YYYY-MM-DD"),
            })
          }
        >
          <Form.Item label="Период отпуска" name="range" rules={[{ required: true, message: "Укажите период" }]}>
            <RangePicker style={{ width: "100%" }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={addVacationMutation.isPending}>
            Добавить отпуск
          </Button>
        </Form>
      </Modal>
    </>
  );
}
