import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Alert, Checkbox, Form, Input, Modal, Select, Space, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { leadsApi, type CreateLeadInput } from "../api/leads";
import { ApiError } from "../api/client";
import { LEAD_STAGE_LABELS, type LeadDuplicate, type LeadSource } from "../api/types";

type LeadFormValues = Omit<CreateLeadInput, "confirmDuplicate">;

interface Props {
  branchId: string;
  open: boolean;
  onClose: () => void;
  sources: LeadSource[];
  staffOptions: { value: string; label: string }[];
}

export default function CreateLeadModal({ branchId, open, onClose, sources, staffOptions }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [duplicates, setDuplicates] = useState<LeadDuplicate[]>([]);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);

  function reset() {
    form.resetFields();
    setDuplicates([]);
    setConfirmDuplicate(false);
  }

  async function handlePhoneBlur() {
    const phone = form.getFieldValue("parentPhone");
    if (!phone) return;
    setCheckingPhone(true);
    try {
      const { duplicates: found } = await leadsApi.checkDuplicates(branchId, phone);
      setDuplicates(found);
      if (found.length === 0) setConfirmDuplicate(false);
    } catch {
      // Best-effort UX check — the server re-validates on submit either way.
    } finally {
      setCheckingPhone(false);
    }
  }

  const create = useMutation({
    mutationFn: (values: LeadFormValues) => leadsApi.create(branchId, { ...values, confirmDuplicate }),
    onSuccess: (lead) => {
      void queryClient.invalidateQueries({ queryKey: ["leads", branchId] });
      message.success("Лид создан");
      reset();
      onClose();
      navigate(`/leads/${lead.id}`);
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <Modal
      title="Новый лид"
      open={open}
      onCancel={() => {
        reset();
        onClose();
      }}
      onOk={() => form.submit()}
      confirmLoading={create.isPending}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={(values) => create.mutate(values)}>
        <Form.Item
          label="ФИО родителя"
          name="parentFullName"
          rules={[{ required: true, message: "Укажите ФИО" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Телефон"
          name="parentPhone"
          rules={[{ required: true, message: "Укажите телефон" }]}
        >
          <Input onBlur={handlePhoneBlur} />
        </Form.Item>

        {checkingPhone && <Typography.Text type="secondary">Проверка дублей…</Typography.Text>}
        {duplicates.length > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Найден лид с таким же номером"
            description={
              <Space direction="vertical" size="small">
                {duplicates.map((d) => (
                  <Typography.Text key={d.id}>
                    {d.branchName}: {LEAD_STAGE_LABELS[d.stage]}
                    {d.childFullName ? `, ребёнок ${d.childFullName}` : ""} (
                    {new Date(d.createdAt).toLocaleDateString("ru-RU")})
                  </Typography.Text>
                ))}
                <Checkbox checked={confirmDuplicate} onChange={(e) => setConfirmDuplicate(e.target.checked)}>
                  Всё равно создать новый лид
                </Checkbox>
              </Space>
            }
          />
        )}

        <Form.Item label="Email родителя" name="parentEmail">
          <Input />
        </Form.Item>
        <Form.Item label="ФИО ребёнка" name="childFullName">
          <Input />
        </Form.Item>
        <Form.Item label="Дата рождения ребёнка" name="childBirthDate">
          <Input type="date" />
        </Form.Item>
        <Form.Item label="Желаемая дата начала" name="targetDate">
          <Input type="date" />
        </Form.Item>
        <Form.Item label="Источник" name="sourceId">
          <Select
            allowClear
            options={sources.filter((s) => s.isActive).map((s) => ({ value: s.id, label: s.name }))}
          />
        </Form.Item>
        <Form.Item
          label="Ответственный"
          name="responsibleUserId"
          rules={[{ required: true, message: "Выберите ответственного" }]}
        >
          <Select options={staffOptions} showSearch optionFilterProp="label" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
