import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, Input, Modal, Select, Space, Steps } from "antd";
import { useNavigate } from "react-router-dom";
import { leadsApi, type ConvertLeadInput } from "../api/leads";
import { tariffsApi } from "../api/tariffs";
import { groupsApi } from "../api/groups";
import { ApiError } from "../api/client";
import type { Lead } from "../api/types";

interface Props {
  branchId: string;
  lead: Lead;
  open: boolean;
  onClose: () => void;
}

const STEP_FIELDS = [
  ["childFullName", "childBirthDate", "childSex"],
  ["parentFullName", "parentRelationship", "parentPhone", "parentEmail"],
  ["groupId", "tariffId", "contractNumber", "contractStartDate"],
];

export default function ConversionWizard({ branchId, lead, open, onClose }: Props) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);

  const { data: tariffs = [] } = useQuery({
    queryKey: ["tariffs", branchId],
    queryFn: () => tariffsApi.listForBranch(branchId),
    enabled: open,
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["groups", branchId],
    queryFn: () => groupsApi.list(branchId),
    enabled: open,
  });

  const convert = useMutation({
    mutationFn: (dto: ConvertLeadInput) => leadsApi.convert(branchId, lead.id, dto),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["leads", branchId] });
      void queryClient.invalidateQueries({ queryKey: ["lead", branchId, lead.id] });
      message.success("Лид зачислен, договор создан");
      onClose();
      navigate(`/families/${result.familyId}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        modal.confirm({
          title: "Группа заполнена",
          content: "В выбранной группе нет свободных мест. Зачислить сверх плана?",
          okText: "Зачислить",
          cancelText: "Отмена",
          onOk: () => convert.mutate({ ...form.getFieldsValue(true), confirmOverride: true }),
        });
        return;
      }
      message.error(err instanceof ApiError ? err.message : "Ошибка");
    },
  });

  async function next() {
    await form.validateFields(STEP_FIELDS[step]);
    setStep((s) => s + 1);
  }

  async function submit() {
    await form.validateFields(STEP_FIELDS[step]);
    convert.mutate(form.getFieldsValue(true));
  }

  return (
    <Modal
      title="Оформление зачисления"
      open={open}
      onCancel={onClose}
      destroyOnClose
      width={640}
      footer={
        <Space>
          <Button onClick={onClose}>Отмена</Button>
          {step > 0 && <Button onClick={() => setStep((s) => s - 1)}>Назад</Button>}
          {step < STEP_FIELDS.length - 1 ? (
            <Button type="primary" onClick={next}>
              Далее
            </Button>
          ) : (
            <Button type="primary" loading={convert.isPending} onClick={submit}>
              Зачислить
            </Button>
          )}
        </Space>
      }
    >
      <Steps
        current={step}
        style={{ marginBottom: 24 }}
        items={[{ title: "Ребёнок" }, { title: "Родитель" }, { title: "Договор" }]}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          childFullName: lead.childFullName ?? "",
          childBirthDate: lead.childBirthDate?.slice(0, 10) ?? "",
          parentFullName: lead.parentFullName,
          parentRelationship: "мать",
          parentPhone: lead.parentPhone,
          parentEmail: lead.parentEmail ?? undefined,
          contractStartDate: new Date().toISOString().slice(0, 10),
        }}
      >
        <div style={{ display: step === 0 ? "block" : "none" }}>
          <Form.Item
            label="ФИО ребёнка"
            name="childFullName"
            rules={[{ required: true, message: "Укажите ФИО ребёнка" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Дата рождения"
            name="childBirthDate"
            rules={[{ required: true, message: "Укажите дату рождения" }]}
          >
            <Input type="date" />
          </Form.Item>
          <Form.Item label="Пол" name="childSex">
            <Input placeholder="М / Ж" />
          </Form.Item>
        </div>

        <div style={{ display: step === 1 ? "block" : "none" }}>
          <Form.Item
            label="ФИО родителя"
            name="parentFullName"
            rules={[{ required: true, message: "Укажите ФИО" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Степень родства"
            name="parentRelationship"
            rules={[{ required: true, message: "Укажите степень родства" }]}
          >
            <Input placeholder="мать / отец / опекун" />
          </Form.Item>
          <Form.Item label="Телефон" name="parentPhone">
            <Input />
          </Form.Item>
          <Form.Item label="Email" name="parentEmail">
            <Input />
          </Form.Item>
        </div>

        <div style={{ display: step === 2 ? "block" : "none" }}>
          <Form.Item label="Группа (необязательно)" name="groupId">
            <Select allowClear options={groups.map((g) => ({ value: g.id, label: g.name }))} />
          </Form.Item>
          <Form.Item
            label="Тариф"
            name="tariffId"
            rules={[{ required: true, message: "Выберите тариф" }]}
          >
            <Select options={tariffs.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))} />
          </Form.Item>
          <Form.Item
            label="Номер договора"
            name="contractNumber"
            rules={[{ required: true, message: "Укажите номер договора" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Дата начала договора"
            name="contractStartDate"
            rules={[{ required: true, message: "Укажите дату начала" }]}
          >
            <Input type="date" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
