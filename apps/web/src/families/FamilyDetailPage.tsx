import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Table,
  Typography,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { familiesApi } from "../api/families";
import { childrenApi } from "../api/children";
import type { Parent, TrustedPerson } from "../api/types";
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
              title: "",
              key: "actions",
              render: (_, parent: Parent) => (
                <Space>
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
    </Space>
  );
}
