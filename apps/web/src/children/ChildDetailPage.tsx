import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { UploadFile } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { childrenApi } from "../api/children";
import { groupsApi } from "../api/groups";
import { dischargeReasonsApi, documentTypesApi } from "../api/dictionaries";
import { enrollmentApi } from "../api/enrollment";
import type { ChildStatus } from "../api/types";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

const STATUS_LABELS: Record<ChildStatus, { label: string; color: string }> = {
  WAITLIST: { label: "Очередь", color: "gold" },
  ENROLLED: { label: "Зачислен", color: "green" },
  SUSPENDED: { label: "Приостановлен", color: "orange" },
  DISCHARGED: { label: "Отчислен", color: "default" },
};

export default function ChildDetailPage() {
  const { childId = "" } = useParams();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const childQuery = useQuery({
    queryKey: ["children", branchId, childId],
    queryFn: () => childrenApi.get(branchId, childId),
    enabled: Boolean(branchId && childId),
  });
  const medicalQuery = useQuery({
    queryKey: ["children", branchId, childId, "medical"],
    queryFn: () => childrenApi.getMedical(branchId, childId),
    enabled: Boolean(branchId && childId),
  });
  const documentsQuery = useQuery({
    queryKey: ["children", branchId, childId, "documents"],
    queryFn: () => childrenApi.listDocuments(branchId, childId),
    enabled: Boolean(branchId && childId),
  });
  const historyQuery = useQuery({
    queryKey: ["children", branchId, childId, "history"],
    queryFn: () => childrenApi.history(branchId, childId),
    enabled: Boolean(branchId && childId),
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["groups", branchId],
    queryFn: () => groupsApi.list(branchId),
    enabled: Boolean(branchId),
  });
  const { data: dischargeReasons = [] } = useQuery({
    queryKey: ["discharge-reasons"],
    queryFn: dischargeReasonsApi.list,
  });
  const { data: documentTypes = [] } = useQuery({
    queryKey: ["document-types"],
    queryFn: documentTypesApi.list,
  });

  const invalidateChild = () => queryClient.invalidateQueries({ queryKey: ["children", branchId, childId] });

  const onError = (err: unknown) => message.error(err instanceof ApiError ? err.message : "Ошибка");

  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const updateChild = useMutation({
    mutationFn: (values: { fullName: string; birthDate: string; sex?: string }) =>
      childrenApi.update(branchId, childId, values),
    onSuccess: () => {
      invalidateChild();
      setEditOpen(false);
      message.success("Сохранено");
    },
    onError,
  });

  const [actionModal, setActionModal] = useState<"enroll" | "transfer" | "suspend" | "discharge" | null>(
    null,
  );
  const [actionForm] = Form.useForm();

  const enrollMutation = useMutation({
    mutationFn: (values: { groupId: string }) => enrollmentApi.enroll(branchId, childId, values),
    onSuccess: () => {
      invalidateChild();
      setActionModal(null);
      message.success("Ребёнок зачислен");
    },
    onError,
  });
  const transferMutation = useMutation({
    mutationFn: (values: { toGroupId: string }) => enrollmentApi.transfer(branchId, childId, values),
    onSuccess: () => {
      invalidateChild();
      setActionModal(null);
      message.success("Ребёнок переведён");
    },
    onError,
  });
  const suspendMutation = useMutation({
    mutationFn: (values: { reason?: string }) => enrollmentApi.suspend(branchId, childId, values),
    onSuccess: () => {
      invalidateChild();
      setActionModal(null);
      message.success("Приостановлено");
    },
    onError,
  });
  const resumeMutation = useMutation({
    mutationFn: () => enrollmentApi.resume(branchId, childId, {}),
    onSuccess: () => {
      invalidateChild();
      message.success("Возобновлено");
    },
    onError,
  });
  const dischargeMutation = useMutation({
    mutationFn: (values: { dischargeReasonId: string }) => enrollmentApi.discharge(branchId, childId, values),
    onSuccess: () => {
      invalidateChild();
      setActionModal(null);
      message.success("Ребёнок отчислен");
    },
    onError,
  });

  const [medicalForm] = Form.useForm();
  const saveMedical = useMutation({
    mutationFn: (values: Record<string, string>) => childrenApi.upsertMedical(branchId, childId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["children", branchId, childId, "medical"] });
      message.success("Медицинские данные сохранены");
    },
    onError,
  });

  const [uploadModal, setUploadModal] = useState(false);
  const [uploadForm] = Form.useForm();
  const uploadDoc = useMutation({
    mutationFn: (values: { documentTypeId: string; expiresAt?: string; file: UploadFile[] }) =>
      childrenApi.uploadDocument(
        branchId,
        childId,
        (values.file[0].originFileObj ?? values.file[0]) as File,
        values.documentTypeId,
        values.expiresAt,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["children", branchId, childId, "documents"] });
      setUploadModal(false);
      message.success("Документ загружен");
    },
    onError,
  });
  const removeDoc = useMutation({
    mutationFn: (documentId: string) => childrenApi.removeDocument(branchId, childId, documentId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["children", branchId, childId, "documents"] }),
    onError,
  });

  const child = childQuery.data;
  if (childQuery.isLoading || !child) return <Typography.Text>Загрузка...</Typography.Text>;

  const medical = medicalQuery.data;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Card
        title={
          <Space>
            {child.fullName}
            <Tag color={STATUS_LABELS[child.status].color}>{STATUS_LABELS[child.status].label}</Tag>
          </Space>
        }
        extra={
          <Button
            size="small"
            onClick={() => {
              editForm.setFieldsValue(child);
              setEditOpen(true);
            }}
          >
            Изменить
          </Button>
        }
      >
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Дата рождения">{child.birthDate}</Descriptions.Item>
          <Descriptions.Item label="Пол">{child.sex ?? "—"}</Descriptions.Item>
        </Descriptions>

        <Space style={{ marginTop: 16 }} wrap>
          {child.status === "WAITLIST" && (
            <Button
              type="primary"
              onClick={() => {
                actionForm.resetFields();
                setActionModal("enroll");
              }}
            >
              Зачислить
            </Button>
          )}
          {child.status === "ENROLLED" && (
            <>
              <Button
                onClick={() => {
                  actionForm.resetFields();
                  setActionModal("transfer");
                }}
              >
                Перевести
              </Button>
              <Button
                onClick={() => {
                  actionForm.resetFields();
                  setActionModal("suspend");
                }}
              >
                Приостановить
              </Button>
            </>
          )}
          {child.status === "SUSPENDED" && (
            <Button loading={resumeMutation.isPending} onClick={() => resumeMutation.mutate()}>
              Возобновить
            </Button>
          )}
          {(["WAITLIST", "ENROLLED", "SUSPENDED"] as ChildStatus[]).includes(child.status) && (
            <Button
              danger
              onClick={() => {
                actionForm.resetFields();
                setActionModal("discharge");
              }}
            >
              Отчислить
            </Button>
          )}
        </Space>
      </Card>

      <Card title="Медицинские данные">
        {medical?.level === "full" ? (
          <Form
            form={medicalForm}
            layout="vertical"
            initialValues={medical}
            onFinish={(values) => saveMedical.mutate(values)}
          >
            <Form.Item label="Аллергии" name="allergies">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item label="Хронические заболевания" name="chronic">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item label="Ограничения активности" name="activityLimits">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item label="Контакт врача" name="doctorContact">
              <Input />
            </Form.Item>
            <Form.Item
              label="Краткая сводка (видна воспитателю)"
              name="criticalInfo"
              extra="Только аллергии и диета — эта информация видна воспитателям группы"
            >
              <Input.TextArea rows={2} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={saveMedical.isPending}>
              Сохранить
            </Button>
          </Form>
        ) : (
          <Typography.Paragraph>
            <strong>Важная информация:</strong> {medical?.criticalInfo || "не указана"}
          </Typography.Paragraph>
        )}
      </Card>

      <Card
        title="Документы"
        extra={
          <Button size="small" icon={<UploadOutlined />} onClick={() => setUploadModal(true)}>
            Загрузить
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          loading={documentsQuery.isLoading}
          dataSource={documentsQuery.data ?? []}
          columns={[
            { title: "Тип", dataIndex: ["documentType", "name"] },
            { title: "Файл", dataIndex: "fileName" },
            { title: "Действует до", dataIndex: "expiresAt" },
            {
              title: "",
              key: "actions",
              render: (_, doc) => (
                <Space>
                  {doc.downloadUrl && (
                    <a href={doc.downloadUrl} target="_blank" rel="noreferrer">
                      Скачать
                    </a>
                  )}
                  <Popconfirm title="Удалить документ?" onConfirm={() => removeDoc.mutate(doc.id)}>
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

      <Card title="История">
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          loading={historyQuery.isLoading}
          dataSource={historyQuery.data ?? []}
          columns={[
            { title: "Событие", dataIndex: "type" },
            { title: "Дата", dataIndex: "effectiveAt" },
            { title: "Причина", dataIndex: "reason" },
          ]}
        />
      </Card>

      <Modal
        title="Изменить данные ребёнка"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateChild.isPending}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={(values) => updateChild.mutate(values)}>
          <Form.Item label="ФИО" name="fullName" rules={[{ required: true, message: "Укажите ФИО" }]}>
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
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          { enroll: "Зачислить", transfer: "Перевести", suspend: "Приостановить", discharge: "Отчислить" }[
            actionModal ?? "enroll"
          ]
        }
        open={Boolean(actionModal)}
        onCancel={() => setActionModal(null)}
        onOk={() => actionForm.submit()}
        confirmLoading={
          enrollMutation.isPending ||
          transferMutation.isPending ||
          suspendMutation.isPending ||
          dischargeMutation.isPending
        }
        destroyOnClose
      >
        <Form
          form={actionForm}
          layout="vertical"
          onFinish={(values) => {
            if (actionModal === "enroll") enrollMutation.mutate(values);
            else if (actionModal === "transfer") transferMutation.mutate(values);
            else if (actionModal === "suspend") suspendMutation.mutate(values);
            else if (actionModal === "discharge") dischargeMutation.mutate(values);
          }}
        >
          {actionModal === "enroll" && (
            <Form.Item label="Группа" name="groupId" rules={[{ required: true, message: "Выберите группу" }]}>
              <Select options={groups.map((g) => ({ value: g.id, label: g.name }))} />
            </Form.Item>
          )}
          {actionModal === "transfer" && (
            <Form.Item
              label="Новая группа"
              name="toGroupId"
              rules={[{ required: true, message: "Выберите группу" }]}
            >
              <Select options={groups.map((g) => ({ value: g.id, label: g.name }))} />
            </Form.Item>
          )}
          {actionModal === "suspend" && (
            <Form.Item label="Причина" name="reason">
              <Input.TextArea rows={2} />
            </Form.Item>
          )}
          {actionModal === "discharge" && (
            <Form.Item
              label="Причина отчисления"
              name="dischargeReasonId"
              rules={[{ required: true, message: "Выберите причину" }]}
            >
              <Select options={dischargeReasons.map((r) => ({ value: r.id, label: r.name, disabled: !r.isActive }))} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="Загрузить документ"
        open={uploadModal}
        onCancel={() => setUploadModal(false)}
        onOk={() => uploadForm.submit()}
        confirmLoading={uploadDoc.isPending}
        destroyOnClose
      >
        <Form form={uploadForm} layout="vertical" onFinish={(values) => uploadDoc.mutate(values)}>
          <Form.Item
            label="Тип документа"
            name="documentTypeId"
            rules={[{ required: true, message: "Выберите тип документа" }]}
          >
            <Select options={documentTypes.map((t) => ({ value: t.id, label: t.name, disabled: !t.isActive }))} />
          </Form.Item>
          <Form.Item label="Действует до" name="expiresAt">
            <Input type="date" />
          </Form.Item>
          <Form.Item
            label="Файл"
            name="file"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : (e?.fileList ?? []))}
            rules={[{ required: true, message: "Выберите файл" }]}
          >
            <Upload beforeUpload={() => false} maxCount={1}>
              <Button icon={<UploadOutlined />}>Выбрать файл</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
