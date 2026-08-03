import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { leadsApi } from "../api/leads";
import { leadRejectionReasonsApi } from "../api/dictionaries";
import { staffApi } from "../api/staff";
import { groupsApi } from "../api/groups";
import { waitlistApi } from "../api/enrollment";
import { ApiError } from "../api/client";
import {
  ASSIGNABLE_LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type AssignableLeadStage,
} from "../api/types";
import { useBranch } from "../layout/BranchContext";
import TasksWidget from "./TasksWidget";
import ConversionWizard from "./ConversionWizard";

const TERMINAL_STAGES = ["ENROLLED", "REJECTED", "WAITLISTED"];
const STAGE_CHANGE_OPTIONS = ASSIGNABLE_LEAD_STAGES.filter((s) => s !== "REJECTED");

export default function LeadDetailPage() {
  const { leadId = "" } = useParams();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", branchId, leadId],
    queryFn: () => leadsApi.get(branchId, leadId),
    enabled: Boolean(branchId && leadId),
  });
  const { data: rejectionReasons = [] } = useQuery({
    queryKey: ["lead-rejection-reasons"],
    queryFn: leadRejectionReasonsApi.list,
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff", branchId],
    queryFn: () => staffApi.list(branchId),
    enabled: Boolean(branchId),
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["groups", branchId],
    queryFn: () => groupsApi.list(branchId),
    enabled: Boolean(branchId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["lead", branchId, leadId] });
    void queryClient.invalidateQueries({ queryKey: ["leads", branchId] });
  };

  const [noteForm] = Form.useForm();
  const addNote = useMutation({
    mutationFn: (content: string) => leadsApi.addActivity(branchId, leadId, content),
    onSuccess: () => {
      invalidate();
      noteForm.resetFields();
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const updateStage = useMutation({
    mutationFn: (stage: AssignableLeadStage) => leadsApi.updateStage(branchId, leadId, { stage }),
    onSuccess: () => {
      invalidate();
      message.success("Стадия изменена");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectForm] = Form.useForm();
  const reject = useMutation({
    mutationFn: (values: { rejectionReasonId: string; rejectionComment?: string }) =>
      leadsApi.updateStage(branchId, leadId, { stage: "REJECTED", ...values }),
    onSuccess: () => {
      invalidate();
      setRejectOpen(false);
      message.success("Лид отклонён");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistForm] = Form.useForm();
  const queueToWaitlist = useMutation({
    mutationFn: (groupId: string) => waitlistApi.add(branchId, groupId, { leadId }),
    onSuccess: () => {
      invalidate();
      setWaitlistOpen(false);
      message.success("Лид поставлен в очередь");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const remove = useMutation({
    mutationFn: () => leadsApi.remove(branchId, leadId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leads", branchId] });
      message.success("Лид удалён");
      navigate("/leads");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const [wizardOpen, setWizardOpen] = useState(false);

  if (isLoading || !lead) return null;

  const responsible = staff.find((s) => s.user?.id === lead.responsibleUserId)?.user?.fullName;
  const isTerminal = TERMINAL_STAGES.includes(lead.stage);

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {lead.parentFullName}
        </Typography.Title>
        <Space wrap>
          <Tag color={isTerminal ? "default" : "blue"}>{LEAD_STAGE_LABELS[lead.stage]}</Tag>
          {!isTerminal && (
            <Select
              placeholder="Изменить стадию"
              style={{ width: 200 }}
              onChange={(stage: AssignableLeadStage) => updateStage.mutate(stage)}
              options={STAGE_CHANGE_OPTIONS.map((s) => ({ value: s, label: LEAD_STAGE_LABELS[s] }))}
            />
          )}
          {!isTerminal && (
            <Button danger onClick={() => setRejectOpen(true)}>
              Отказ
            </Button>
          )}
          {!isTerminal && <Button onClick={() => setWaitlistOpen(true)}>В очередь</Button>}
          {!isTerminal && (
            <Button type="primary" onClick={() => setWizardOpen(true)}>
              Оформить
            </Button>
          )}
          <Popconfirm title="Удалить лид?" onConfirm={() => remove.mutate()}>
            <Button danger>Удалить</Button>
          </Popconfirm>
        </Space>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="Телефон">{lead.parentPhone}</Descriptions.Item>
          <Descriptions.Item label="Email">{lead.parentEmail ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Ребёнок">{lead.childFullName ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Дата рождения">
            {lead.childBirthDate ? new Date(lead.childBirthDate).toLocaleDateString("ru-RU") : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Источник">{lead.source?.name ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Ответственный">{responsible ?? "—"}</Descriptions.Item>
          {(lead.utmSource || lead.utmMedium || lead.utmCampaign) && (
            <Descriptions.Item label="UTM-метки" span={2}>
              {[lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(" / ")}
            </Descriptions.Item>
          )}
          {lead.stage === "REJECTED" && (
            <>
              <Descriptions.Item label="Причина отказа">
                {lead.rejectionReason?.name ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Комментарий">{lead.rejectionComment ?? "—"}</Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      <Card title="Задачи" style={{ marginBottom: 16 }}>
        <TasksWidget branchId={branchId} leadId={leadId} />
      </Card>

      <Card title="Лента активности">
        <Form form={noteForm} layout="inline" onFinish={(v) => addNote.mutate(v.content)}>
          <Form.Item name="content" style={{ flex: 1 }} rules={[{ required: true }]}>
            <Input placeholder="Добавить заметку…" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={addNote.isPending}>
              Добавить
            </Button>
          </Form.Item>
        </Form>
        <List
          style={{ marginTop: 16 }}
          dataSource={lead.activities ?? []}
          locale={{ emptyText: "Пока нет записей" }}
          renderItem={(a) => (
            <List.Item>
              <Space direction="vertical" size={0}>
                <Typography.Text>{a.content}</Typography.Text>
                <Typography.Text type="secondary">{new Date(a.createdAt).toLocaleString("ru-RU")}</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title="Отклонить лид"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => rejectForm.submit()}
        confirmLoading={reject.isPending}
        destroyOnClose
      >
        <Form form={rejectForm} layout="vertical" onFinish={(v) => reject.mutate(v)}>
          <Form.Item
            label="Причина"
            name="rejectionReasonId"
            rules={[{ required: true, message: "Выберите причину" }]}
          >
            <Select options={rejectionReasons.filter((r) => r.isActive).map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
          <Form.Item label="Комментарий" name="rejectionComment">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Поставить в очередь"
        open={waitlistOpen}
        onCancel={() => setWaitlistOpen(false)}
        onOk={() => waitlistForm.submit()}
        confirmLoading={queueToWaitlist.isPending}
        destroyOnClose
      >
        <Form form={waitlistForm} layout="vertical" onFinish={(v) => queueToWaitlist.mutate(v.groupId)}>
          <Form.Item label="Группа" name="groupId" rules={[{ required: true, message: "Выберите группу" }]}>
            <Select options={groups.map((g) => ({ value: g.id, label: g.name }))} />
          </Form.Item>
        </Form>
      </Modal>

      {wizardOpen && (
        <ConversionWizard branchId={branchId} lead={lead} open={wizardOpen} onClose={() => setWizardOpen(false)} />
      )}
    </>
  );
}
