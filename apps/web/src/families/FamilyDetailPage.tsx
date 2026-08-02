import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { familiesApi } from "../api/families";
import { childrenApi } from "../api/children";
import { contractsApi } from "../api/contracts";
import type { CreateContractInput } from "../api/contracts";
import { discountsApi } from "../api/discounts";
import type { CreateDiscountInput } from "../api/discounts";
import { paymentsApi } from "../api/payments";
import type { RecordPaymentInput } from "../api/payments";
import { tariffsApi } from "../api/tariffs";
import {
  DISCOUNT_BASES,
  DISCOUNT_BASIS_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  formatMinor,
  type Contract,
  type Discount,
  type DiscountBasis,
  type Parent,
  type PaymentMethod,
  type TrustedPerson,
} from "../api/types";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

export default function FamilyDetailPage() {
  const { familyId = "" } = useParams();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const { data: family, isLoading } = useQuery({
    queryKey: ["families", branchId, familyId],
    queryFn: () => familiesApi.get(branchId, familyId),
    enabled: Boolean(branchId && familyId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["families", branchId, familyId] });

  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts", branchId, familyId],
    queryFn: () => contractsApi.listForFamily(branchId, familyId),
    enabled: Boolean(branchId && familyId),
  });
  const { data: tariffs = [] } = useQuery({
    queryKey: ["tariffs", branchId],
    queryFn: () => tariffsApi.listForBranch(branchId),
    enabled: Boolean(branchId),
  });
  const { data: discounts = [] } = useQuery({
    queryKey: ["discounts", branchId, familyId],
    queryFn: () => discountsApi.listForFamily(branchId, familyId),
    enabled: Boolean(branchId && familyId),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments", branchId, familyId],
    queryFn: () => paymentsApi.listForFamily(branchId, familyId),
    enabled: Boolean(branchId && familyId),
  });
  const { data: balance } = useQuery({
    queryKey: ["balance", branchId, familyId],
    queryFn: () => paymentsApi.getBalance(branchId, familyId),
    enabled: Boolean(branchId && familyId),
  });

  const invalidateContracts = () => queryClient.invalidateQueries({ queryKey: ["contracts", branchId, familyId] });
  const invalidateDiscounts = () => queryClient.invalidateQueries({ queryKey: ["discounts", branchId, familyId] });
  const invalidatePayments = () => {
    void queryClient.invalidateQueries({ queryKey: ["payments", branchId, familyId] });
    void queryClient.invalidateQueries({ queryKey: ["balance", branchId, familyId] });
  };

  function childName(childId: string) {
    return family?.children?.find((c) => c.id === childId)?.fullName ?? childId;
  }
  function tariffName(tariffId: string) {
    return tariffs.find((t) => t.id === tariffId)?.name ?? tariffId;
  }

  const [contractModal, setContractModal] = useState(false);
  const [contractForm] = Form.useForm();
  const createContract = useMutation({
    mutationFn: (values: CreateContractInput) => contractsApi.create(branchId, values),
    onSuccess: () => {
      invalidateContracts();
      setContractModal(false);
      message.success("Договор создан");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });
  const terminateContract = useMutation({
    mutationFn: (id: string) => contractsApi.terminate(branchId, id),
    onSuccess: () => {
      invalidateContracts();
      message.success("Договор расторгнут");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const [discountModal, setDiscountModal] = useState(false);
  const [discountForm] = Form.useForm();
  const createDiscount = useMutation({
    mutationFn: (values: CreateDiscountInput & { scope: "family" | "child" }) => {
      const { scope, ...dto } = values;
      return discountsApi.create(branchId, {
        ...dto,
        familyId: scope === "family" ? familyId : undefined,
        childId: scope === "child" ? dto.childId : undefined,
      });
    },
    onSuccess: () => {
      invalidateDiscounts();
      setDiscountModal(false);
      message.success("Скидка добавлена");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });
  const archiveDiscount = useMutation({
    mutationFn: (id: string) => discountsApi.archive(branchId, id),
    onSuccess: () => {
      invalidateDiscounts();
      message.success("Скидка архивирована");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm] = Form.useForm();
  const recordPayment = useMutation({
    mutationFn: (values: { amount: number; method: RecordPaymentInput["method"]; paidAt: string }) =>
      paymentsApi.record(branchId, familyId, {
        amountMinor: Math.round(values.amount * 100),
        method: values.method,
        paidAt: values.paidAt,
      }),
    onSuccess: () => {
      invalidatePayments();
      setPaymentModal(false);
      message.success("Оплата зафиксирована");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const [parentModal, setParentModal] = useState<{ editing: Parent | null } | null>(null);
  const [trustedModal, setTrustedModal] = useState<{ editing: TrustedPerson | null } | null>(null);
  const [childModal, setChildModal] = useState(false);
  const [parentForm] = Form.useForm();
  const [trustedForm] = Form.useForm();
  const [childForm] = Form.useForm();

  const saveParent = useMutation({
    mutationFn: (values: Parent extends never ? never : Record<string, unknown>) =>
      parentModal?.editing
        ? familiesApi.updateParent(branchId, familyId, parentModal.editing.id, values as never)
        : familiesApi.addParent(branchId, familyId, values as never),
    onSuccess: () => {
      invalidate();
      setParentModal(null);
      message.success("Сохранено");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const removeParent = useMutation({
    mutationFn: (parentId: string) => familiesApi.removeParent(branchId, familyId, parentId),
    onSuccess: invalidate,
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const [accountModal, setAccountModal] = useState<{ parent: Parent } | null>(null);
  const [accountForm] = Form.useForm();

  const provisionAccount = useMutation({
    mutationFn: (values: { password: string; email?: string; phone?: string }) =>
      familiesApi.provisionParentAccount(branchId, familyId, accountModal!.parent.id, values),
    onSuccess: () => {
      invalidate();
      setAccountModal(null);
      message.success("Аккаунт создан — сообщите родителю логин и пароль");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const saveTrusted = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      trustedModal?.editing
        ? familiesApi.updateTrustedPerson(branchId, familyId, trustedModal.editing.id, values as never)
        : familiesApi.addTrustedPerson(branchId, familyId, values as never),
    onSuccess: () => {
      invalidate();
      setTrustedModal(null);
      message.success("Сохранено");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const removeTrusted = useMutation({
    mutationFn: (personId: string) => familiesApi.removeTrustedPerson(branchId, familyId, personId),
    onSuccess: invalidate,
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const createChild = useMutation({
    mutationFn: (values: { fullName: string; birthDate: string; sex?: string }) =>
      childrenApi.create(branchId, familyId, values),
    onSuccess: (child) => {
      invalidate();
      setChildModal(false);
      message.success("Ребёнок добавлен");
      navigate(`/children/${child.id}`);
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  if (isLoading || !family) return <Typography.Text>Загрузка...</Typography.Text>;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Typography.Title level={3}>{family.name}</Typography.Title>

      <Card
        title="Родители"
        extra={
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              parentForm.resetFields();
              setParentModal({ editing: null });
            }}
          >
            Добавить
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={family.parents ?? []}
          columns={[
            { title: "ФИО", dataIndex: "fullName" },
            { title: "Родство", dataIndex: "relationship" },
            { title: "Телефон", dataIndex: "phone" },
            { title: "Email", dataIndex: "email" },
            {
              title: "Аккаунт",
              key: "account",
              render: (_, parent: Parent) =>
                parent.userId ? (
                  <Tag color="green">Есть доступ</Tag>
                ) : (
                  <Tag>Нет доступа</Tag>
                ),
            },
            {
              title: "",
              key: "actions",
              render: (_, parent: Parent) => (
                <Space>
                  {!parent.userId && (
                    <Button
                      size="small"
                      onClick={() => {
                        accountForm.resetFields();
                        setAccountModal({ parent });
                      }}
                    >
                      Создать аккаунт
                    </Button>
                  )}
                  <Button
                    size="small"
                    onClick={() => {
                      parentForm.setFieldsValue(parent);
                      setParentModal({ editing: parent });
                    }}
                  >
                    Изменить
                  </Button>
                  <Popconfirm title="Удалить родителя?" onConfirm={() => removeParent.mutate(parent.id)}>
                    <Button size="small" danger>
                      Удалить
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card
        title="Доверенные лица"
        extra={
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              trustedForm.resetFields();
              setTrustedModal({ editing: null });
            }}
          >
            Добавить
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={family.trustedPersons ?? []}
          columns={[
            { title: "ФИО", dataIndex: "fullName" },
            { title: "Документ", dataIndex: "documentInfo" },
            { title: "Действует до", dataIndex: "expiresAt" },
            {
              title: "",
              key: "actions",
              render: (_, person: TrustedPerson) => (
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      trustedForm.setFieldsValue(person);
                      setTrustedModal({ editing: person });
                    }}
                  >
                    Изменить
                  </Button>
                  <Popconfirm
                    title="Удалить доверенное лицо?"
                    onConfirm={() => removeTrusted.mutate(person.id)}
                  >
                    <Button size="small" danger>
                      Удалить
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card
        title="Дети"
        extra={
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              childForm.resetFields();
              setChildModal(true);
            }}
          >
            Добавить ребёнка
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={family.children ?? []}
          onRow={(child) => ({ onClick: () => navigate(`/children/${child.id}`), style: { cursor: "pointer" } })}
          columns={[
            { title: "ФИО", dataIndex: "fullName" },
            { title: "Дата рождения", dataIndex: "birthDate" },
            { title: "Статус", dataIndex: "status" },
          ]}
        />
      </Card>

      <Card
        title="Договоры"
        extra={
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              contractForm.resetFields();
              setContractModal(true);
            }}
          >
            Новый договор
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={contracts}
          columns={[
            { title: "№", dataIndex: "number" },
            { title: "Ребёнок", key: "child", render: (_, c: Contract) => childName(c.childId) },
            { title: "Тариф", key: "tariff", render: (_, c: Contract) => tariffName(c.tariffId) },
            { title: "Начало", dataIndex: "startDate" },
            {
              title: "Статус",
              dataIndex: "status",
              render: (s: string) =>
                s === "ACTIVE" ? <Tag color="green">Активен</Tag> : <Tag>{s}</Tag>,
            },
            {
              title: "",
              key: "actions",
              render: (_, c: Contract) =>
                c.status === "ACTIVE" && (
                  <Popconfirm title="Расторгнуть договор?" onConfirm={() => terminateContract.mutate(c.id)}>
                    <Button size="small" danger>
                      Расторгнуть
                    </Button>
                  </Popconfirm>
                ),
            },
          ]}
        />
      </Card>

      <Card
        title="Скидки"
        extra={
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              discountForm.resetFields();
              discountForm.setFieldsValue({ scope: "family", kind: "PERCENT" });
              setDiscountModal(true);
            }}
          >
            Добавить скидку
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={discounts}
          columns={[
            { title: "Основание", dataIndex: "basis", render: (b: DiscountBasis) => DISCOUNT_BASIS_LABELS[b] },
            {
              title: "Размер",
              key: "value",
              render: (_, d: Discount) => (d.kind === "PERCENT" ? `${d.value}%` : formatMinor(d.value)),
            },
            {
              title: "Область",
              key: "scope",
              render: (_, d: Discount) => (d.childId ? childName(d.childId) : "Вся семья"),
            },
            { title: "Причина", dataIndex: "reason" },
            {
              title: "Статус",
              dataIndex: "isActive",
              render: (v: boolean) => (v ? <Tag color="green">Активна</Tag> : <Tag>Архив</Tag>),
            },
            {
              title: "",
              key: "actions",
              render: (_, d: Discount) =>
                d.isActive && (
                  <Button size="small" danger onClick={() => archiveDiscount.mutate(d.id)}>
                    В архив
                  </Button>
                ),
            },
          ]}
        />
      </Card>

      <Card
        title="Оплаты и баланс"
        extra={
          <Button size="small" icon={<PlusOutlined />} onClick={() => setPaymentModal(true)}>
            Внести оплату
          </Button>
        }
      >
        {balance && (
          <Descriptions column={3} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Оплачено всего">{formatMinor(balance.totalPaidMinor)}</Descriptions.Item>
            <Descriptions.Item label="Начислено всего">{formatMinor(balance.totalInvoicedMinor)}</Descriptions.Item>
            <Descriptions.Item label="Баланс">
              <Typography.Text type={balance.balanceMinor < 0 ? "danger" : "success"}>
                {formatMinor(balance.balanceMinor)}
              </Typography.Text>
            </Descriptions.Item>
          </Descriptions>
        )}
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={payments}
          columns={[
            { title: "Дата", dataIndex: "paidAt" },
            { title: "Сумма", key: "amount", render: (_, p) => formatMinor(p.amountMinor) },
            { title: "Способ", dataIndex: "method", render: (m: PaymentMethod) => PAYMENT_METHOD_LABELS[m] },
          ]}
        />
      </Card>

      <Modal
        title={parentModal?.editing ? "Изменить родителя" : "Новый родитель"}
        open={Boolean(parentModal)}
        onCancel={() => setParentModal(null)}
        onOk={() => parentForm.submit()}
        confirmLoading={saveParent.isPending}
        destroyOnClose
      >
        <Form form={parentForm} layout="vertical" onFinish={(values) => saveParent.mutate(values)}>
          <Form.Item label="ФИО" name="fullName" rules={[{ required: true, message: "Укажите ФИО" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Родство"
            name="relationship"
            rules={[{ required: true, message: "Укажите родство" }]}
          >
            <Input placeholder="мать / отец / опекун" />
          </Form.Item>
          <Form.Item label="Приоритет контакта" name="contactPriority">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Телефон" name="phone">
            <Input />
          </Form.Item>
          <Form.Item label="Email" name="email">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Создать аккаунт: ${accountModal?.parent.fullName ?? ""}`}
        open={Boolean(accountModal)}
        onCancel={() => setAccountModal(null)}
        onOk={() => accountForm.submit()}
        confirmLoading={provisionAccount.isPending}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary">
          Логином станет email или телефон родителя (уже указанные в карточке, если не переопределить
          здесь). Пароль нужно будет сообщить родителю отдельно.
        </Typography.Paragraph>
        <Form
          form={accountForm}
          layout="vertical"
          onFinish={(values) => provisionAccount.mutate(values)}
        >
          <Form.Item
            label="Пароль"
            name="password"
            rules={[
              { required: true, message: "Укажите пароль" },
              { min: 6, message: "Не менее 6 символов" },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="Email (если не указан в карточке)"
            name="email"
            initialValue={accountModal?.parent.email ?? undefined}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Телефон (если не указан в карточке)"
            name="phone"
            initialValue={accountModal?.parent.phone ?? undefined}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={trustedModal?.editing ? "Изменить доверенное лицо" : "Новое доверенное лицо"}
        open={Boolean(trustedModal)}
        onCancel={() => setTrustedModal(null)}
        onOk={() => trustedForm.submit()}
        confirmLoading={saveTrusted.isPending}
        destroyOnClose
      >
        <Form form={trustedForm} layout="vertical" onFinish={(values) => saveTrusted.mutate(values)}>
          <Form.Item label="ФИО" name="fullName" rules={[{ required: true, message: "Укажите ФИО" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Документ" name="documentInfo">
            <Input />
          </Form.Item>
          <Form.Item label="Действует до" name="expiresAt">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Новый ребёнок"
        open={childModal}
        onCancel={() => setChildModal(false)}
        onOk={() => childForm.submit()}
        confirmLoading={createChild.isPending}
        destroyOnClose
      >
        <Form form={childForm} layout="vertical" onFinish={(values) => createChild.mutate(values)}>
          <Form.Item label="ФИО ребёнка" name="fullName" rules={[{ required: true, message: "Укажите ФИО" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Дата рождения"
            name="birthDate"
            rules={[{ required: true, message: "Укажите дату рождения" }]}
          >
            <Input type="date" />
          </Form.Item>
          <Form.Item label="Пол" name="sex">
            <Input placeholder="М / Ж" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Новый договор"
        open={contractModal}
        onCancel={() => setContractModal(false)}
        onOk={() => contractForm.submit()}
        confirmLoading={createContract.isPending}
        destroyOnClose
      >
        <Form
          form={contractForm}
          layout="vertical"
          onFinish={(values) => createContract.mutate({ ...values, familyId })}
        >
          <Form.Item label="Ребёнок" name="childId" rules={[{ required: true, message: "Выберите ребёнка" }]}>
            <Select options={(family.children ?? []).map((c) => ({ value: c.id, label: c.fullName }))} />
          </Form.Item>
          <Form.Item label="Тариф" name="tariffId" rules={[{ required: true, message: "Выберите тариф" }]}>
            <Select options={tariffs.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))} />
          </Form.Item>
          <Form.Item label="Номер договора" name="number" rules={[{ required: true, message: "Укажите номер" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Дата начала"
            name="startDate"
            rules={[{ required: true, message: "Укажите дату начала" }]}
          >
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Новая скидка"
        open={discountModal}
        onCancel={() => setDiscountModal(false)}
        onOk={() => discountForm.submit()}
        confirmLoading={createDiscount.isPending}
        destroyOnClose
      >
        <Form form={discountForm} layout="vertical" onFinish={(values) => createDiscount.mutate(values)}>
          <Form.Item label="Область действия" name="scope">
            <Radio.Group
              options={[
                { value: "family", label: "Вся семья" },
                { value: "child", label: "Один ребёнок" },
              ]}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.scope !== cur.scope}
          >
            {({ getFieldValue }) =>
              getFieldValue("scope") === "child" && (
                <Form.Item label="Ребёнок" name="childId" rules={[{ required: true, message: "Выберите ребёнка" }]}>
                  <Select options={(family.children ?? []).map((c) => ({ value: c.id, label: c.fullName }))} />
                </Form.Item>
              )
            }
          </Form.Item>
          <Form.Item label="Основание" name="basis" rules={[{ required: true, message: "Выберите основание" }]}>
            <Select options={DISCOUNT_BASES.map((b) => ({ value: b, label: DISCOUNT_BASIS_LABELS[b] }))} />
          </Form.Item>
          <Form.Item label="Тип" name="kind" rules={[{ required: true, message: "Выберите тип" }]}>
            <Radio.Group
              options={[
                { value: "PERCENT", label: "Процент" },
                { value: "FIXED_AMOUNT", label: "Фиксированная сумма" },
              ]}
            />
          </Form.Item>
          <Form.Item label="Размер" name="value" rules={[{ required: true, message: "Укажите размер" }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Причина" name="reason" extra="Обязательна для скидки «решением директора»">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            label="Действует с"
            name="validFrom"
            rules={[{ required: true, message: "Укажите дату" }]}
          >
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Внести оплату"
        open={paymentModal}
        onCancel={() => setPaymentModal(false)}
        onOk={() => paymentForm.submit()}
        confirmLoading={recordPayment.isPending}
        destroyOnClose
      >
        <Form form={paymentForm} layout="vertical" onFinish={(values) => recordPayment.mutate(values)}>
          <Form.Item label="Сумма (KZT)" name="amount" rules={[{ required: true, message: "Укажите сумму" }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Способ оплаты" name="method" rules={[{ required: true, message: "Выберите способ" }]}>
            <Select options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
          </Form.Item>
          <Form.Item label="Дата оплаты" name="paidAt" rules={[{ required: true, message: "Укажите дату" }]}>
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
