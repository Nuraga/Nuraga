import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tabs, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import {
  groupTypesApi,
  dischargeReasonsApi,
  documentTypesApi,
  leadSourcesApi,
  leadRejectionReasonsApi,
  allergensApi,
  dishesApi,
} from "../api/dictionaries";
import type {
  Allergen,
  DischargeReason,
  Dish,
  DocumentType,
  GroupType,
  LeadRejectionReason,
  LeadSource,
} from "../api/types";
import { ApiError } from "../api/client";

function useDictionaryMutations<T extends { id: string }, TCreate, TUpdate>(
  queryKey: string,
  api: {
    create: (dto: TCreate) => Promise<T>;
    update: (id: string, dto: TUpdate) => Promise<T>;
    archive: (id: string) => Promise<T>;
  },
) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey] });

  const save = useMutation({
    mutationFn: ({ id, values }: { id?: string; values: TCreate & Partial<TUpdate> }) =>
      id ? api.update(id, values as TUpdate) : api.create(values as TCreate),
    onSuccess: () => {
      invalidate();
      message.success("Сохранено");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка сохранения"),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.archive(id),
    onSuccess: () => {
      invalidate();
      message.success("Запись архивирована");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return { save, archive };
}

function GroupTypesTab() {
  const { data = [], isLoading } = useQuery({ queryKey: ["group-types"], queryFn: groupTypesApi.list });
  const { save, archive } = useDictionaryMutations("group-types", groupTypesApi);
  const [editing, setEditing] = useState<GroupType | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  }
  function openEdit(row: GroupType) {
    setEditing(row);
    form.setFieldsValue(row);
    setOpen(true);
  }

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новый тип группы
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: "Название", dataIndex: "name" },
          { title: "Возраст от (мес.)", dataIndex: "minAgeMonths" },
          { title: "Возраст до (мес.)", dataIndex: "maxAgeMonths" },
          {
            title: "Статус",
            dataIndex: "isActive",
            render: (v: boolean) => (v ? <Tag color="green">Активен</Tag> : <Tag>Архив</Tag>),
          },
          {
            title: "",
            key: "actions",
            render: (_, row: GroupType) => (
              <Space>
                <Button size="small" onClick={() => openEdit(row)}>
                  Изменить
                </Button>
                {row.isActive && (
                  <Button size="small" danger onClick={() => archive.mutate(row.id)}>
                    В архив
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? "Изменить тип группы" : "Новый тип группы"}
        open={open}
        onCancel={() => setOpen(false)}
        confirmLoading={save.isPending}
        destroyOnClose
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            save.mutate({ id: editing?.id, values });
            setOpen(false);
          }}
        >
          <Form.Item label="Название" name="name" rules={[{ required: true, message: "Укажите название" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            label="Возраст от (мес.)"
            name="minAgeMonths"
            rules={[{ required: true, message: "Укажите минимальный возраст" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            label="Возраст до (мес.)"
            name="maxAgeMonths"
            rules={[{ required: true, message: "Укажите максимальный возраст" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          {editing && (
            <Form.Item label="Активен" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}

function DischargeReasonsTab() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["discharge-reasons"],
    queryFn: dischargeReasonsApi.list,
  });
  const { save, archive } = useDictionaryMutations(
    "discharge-reasons",
    dischargeReasonsApi,
  );
  const [editing, setEditing] = useState<DischargeReason | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  }
  function openEdit(row: DischargeReason) {
    setEditing(row);
    form.setFieldsValue(row);
    setOpen(true);
  }

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новая причина отчисления
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: "Название", dataIndex: "name" },
          {
            title: "Статус",
            dataIndex: "isActive",
            render: (v: boolean) => (v ? <Tag color="green">Активна</Tag> : <Tag>Архив</Tag>),
          },
          {
            title: "",
            key: "actions",
            render: (_, row: DischargeReason) => (
              <Space>
                <Button size="small" onClick={() => openEdit(row)}>
                  Изменить
                </Button>
                {row.isActive && (
                  <Button size="small" danger onClick={() => archive.mutate(row.id)}>
                    В архив
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? "Изменить причину" : "Новая причина отчисления"}
        open={open}
        onCancel={() => setOpen(false)}
        confirmLoading={save.isPending}
        destroyOnClose
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            save.mutate({ id: editing?.id, values });
            setOpen(false);
          }}
        >
          <Form.Item label="Название" name="name" rules={[{ required: true, message: "Укажите название" }]}>
            <Input />
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

function LeadSourcesTab() {
  const { data = [], isLoading } = useQuery({ queryKey: ["lead-sources"], queryFn: leadSourcesApi.list });
  const { save, archive } = useDictionaryMutations("lead-sources", leadSourcesApi);
  const [editing, setEditing] = useState<LeadSource | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  }
  function openEdit(row: LeadSource) {
    setEditing(row);
    form.setFieldsValue(row);
    setOpen(true);
  }

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новый источник
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: "Название", dataIndex: "name" },
          {
            title: "Статус",
            dataIndex: "isActive",
            render: (v: boolean) => (v ? <Tag color="green">Активен</Tag> : <Tag>Архив</Tag>),
          },
          {
            title: "",
            key: "actions",
            render: (_, row: LeadSource) => (
              <Space>
                <Button size="small" onClick={() => openEdit(row)}>
                  Изменить
                </Button>
                {row.isActive && (
                  <Button size="small" danger onClick={() => archive.mutate(row.id)}>
                    В архив
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? "Изменить источник" : "Новый источник"}
        open={open}
        onCancel={() => setOpen(false)}
        confirmLoading={save.isPending}
        destroyOnClose
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            save.mutate({ id: editing?.id, values });
            setOpen(false);
          }}
        >
          <Form.Item label="Название" name="name" rules={[{ required: true, message: "Укажите название" }]}>
            <Input />
          </Form.Item>
          {editing && (
            <Form.Item label="Активен" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}

function LeadRejectionReasonsTab() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["lead-rejection-reasons"],
    queryFn: leadRejectionReasonsApi.list,
  });
  const { save, archive } = useDictionaryMutations("lead-rejection-reasons", leadRejectionReasonsApi);
  const [editing, setEditing] = useState<LeadRejectionReason | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  }
  function openEdit(row: LeadRejectionReason) {
    setEditing(row);
    form.setFieldsValue(row);
    setOpen(true);
  }

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новая причина отказа
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: "Название", dataIndex: "name" },
          {
            title: "Статус",
            dataIndex: "isActive",
            render: (v: boolean) => (v ? <Tag color="green">Активна</Tag> : <Tag>Архив</Tag>),
          },
          {
            title: "",
            key: "actions",
            render: (_, row: LeadRejectionReason) => (
              <Space>
                <Button size="small" onClick={() => openEdit(row)}>
                  Изменить
                </Button>
                {row.isActive && (
                  <Button size="small" danger onClick={() => archive.mutate(row.id)}>
                    В архив
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? "Изменить причину" : "Новая причина отказа"}
        open={open}
        onCancel={() => setOpen(false)}
        confirmLoading={save.isPending}
        destroyOnClose
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            save.mutate({ id: editing?.id, values });
            setOpen(false);
          }}
        >
          <Form.Item label="Название" name="name" rules={[{ required: true, message: "Укажите название" }]}>
            <Input />
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

function AllergensTab() {
  const { data = [], isLoading } = useQuery({ queryKey: ["allergens"], queryFn: allergensApi.list });
  const { save, archive } = useDictionaryMutations("allergens", allergensApi);
  const [editing, setEditing] = useState<Allergen | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  }
  function openEdit(row: Allergen) {
    setEditing(row);
    form.setFieldsValue(row);
    setOpen(true);
  }

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новый аллерген
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: "Название", dataIndex: "name" },
          {
            title: "Статус",
            dataIndex: "isActive",
            render: (v: boolean) => (v ? <Tag color="green">Активен</Tag> : <Tag>Архив</Tag>),
          },
          {
            title: "",
            key: "actions",
            render: (_, row: Allergen) => (
              <Space>
                <Button size="small" onClick={() => openEdit(row)}>
                  Изменить
                </Button>
                {row.isActive && (
                  <Button size="small" danger onClick={() => archive.mutate(row.id)}>
                    В архив
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? "Изменить аллерген" : "Новый аллерген"}
        open={open}
        onCancel={() => setOpen(false)}
        confirmLoading={save.isPending}
        destroyOnClose
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            save.mutate({ id: editing?.id, values });
            setOpen(false);
          }}
        >
          <Form.Item label="Название" name="name" rules={[{ required: true, message: "Укажите название" }]}>
            <Input />
          </Form.Item>
          {editing && (
            <Form.Item label="Активен" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}

function DishesTab() {
  const { data = [], isLoading } = useQuery({ queryKey: ["dishes"], queryFn: dishesApi.list });
  const { data: allergens = [] } = useQuery({ queryKey: ["allergens"], queryFn: allergensApi.list });
  const { save, archive } = useDictionaryMutations("dishes", dishesApi);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const allergenOptions = allergens.map((a) => ({ value: a.id, label: a.name }));

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  }
  function openEdit(row: Dish) {
    setEditing(row);
    form.setFieldsValue({ name: row.name, isActive: row.isActive, allergenIds: row.allergens.map((a) => a.allergen.id) });
    setOpen(true);
  }

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новое блюдо
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: "Название", dataIndex: "name" },
          {
            title: "Аллергены",
            key: "allergens",
            render: (_, row: Dish) =>
              row.allergens.length ? (
                <Space wrap>
                  {row.allergens.map((a) => (
                    <Tag key={a.allergen.id} color="orange">
                      {a.allergen.name}
                    </Tag>
                  ))}
                </Space>
              ) : (
                "—"
              ),
          },
          {
            title: "Статус",
            dataIndex: "isActive",
            render: (v: boolean) => (v ? <Tag color="green">Активно</Tag> : <Tag>Архив</Tag>),
          },
          {
            title: "",
            key: "actions",
            render: (_, row: Dish) => (
              <Space>
                <Button size="small" onClick={() => openEdit(row)}>
                  Изменить
                </Button>
                {row.isActive && (
                  <Button size="small" danger onClick={() => archive.mutate(row.id)}>
                    В архив
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? "Изменить блюдо" : "Новое блюдо"}
        open={open}
        onCancel={() => setOpen(false)}
        confirmLoading={save.isPending}
        destroyOnClose
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            save.mutate({ id: editing?.id, values });
            setOpen(false);
          }}
        >
          <Form.Item label="Название" name="name" rules={[{ required: true, message: "Укажите название" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Аллергены" name="allergenIds">
            <Select mode="multiple" options={allergenOptions} placeholder="Не выбрано" allowClear />
          </Form.Item>
          {editing && (
            <Form.Item label="Активно" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}

function DocumentTypesTab() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["document-types"],
    queryFn: documentTypesApi.list,
  });
  const { save, archive } = useDictionaryMutations("document-types", documentTypesApi);
  const [editing, setEditing] = useState<DocumentType | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  }
  function openEdit(row: DocumentType) {
    setEditing(row);
    form.setFieldsValue(row);
    setOpen(true);
  }

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Новый тип документа
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          { title: "Название", dataIndex: "name" },
          { title: "Со сроком действия", dataIndex: "hasExpiry", render: (v: boolean) => (v ? "Да" : "Нет") },
          {
            title: "Статус",
            dataIndex: "isActive",
            render: (v: boolean) => (v ? <Tag color="green">Активен</Tag> : <Tag>Архив</Tag>),
          },
          {
            title: "",
            key: "actions",
            render: (_, row: DocumentType) => (
              <Space>
                <Button size="small" onClick={() => openEdit(row)}>
                  Изменить
                </Button>
                {row.isActive && (
                  <Button size="small" danger onClick={() => archive.mutate(row.id)}>
                    В архив
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? "Изменить тип документа" : "Новый тип документа"}
        open={open}
        onCancel={() => setOpen(false)}
        confirmLoading={save.isPending}
        destroyOnClose
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            save.mutate({ id: editing?.id, values });
            setOpen(false);
          }}
        >
          <Form.Item label="Название" name="name" rules={[{ required: true, message: "Укажите название" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Со сроком действия" name="hasExpiry" valuePropName="checked">
            <Switch />
          </Form.Item>
          {editing && (
            <Form.Item label="Активен" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}

export default function DictionariesPage() {
  return (
    <>
      <Typography.Title level={3}>Справочники</Typography.Title>
      <Tabs
        items={[
          { key: "group-types", label: "Типы групп", children: <GroupTypesTab /> },
          { key: "discharge-reasons", label: "Причины отчисления", children: <DischargeReasonsTab /> },
          { key: "document-types", label: "Типы документов", children: <DocumentTypesTab /> },
          { key: "lead-sources", label: "Источники лидов", children: <LeadSourcesTab /> },
          { key: "lead-rejection-reasons", label: "Причины отказа", children: <LeadRejectionReasonsTab /> },
          { key: "allergens", label: "Аллергены", children: <AllergensTab /> },
          { key: "dishes", label: "Блюда", children: <DishesTab /> },
        ]}
      />
    </>
  );
}
