import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, InputNumber, Modal, Radio, Select, Space, Table, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { waitlistApi } from "../api/enrollment";
import { groupsApi } from "../api/groups";
import { childrenApi } from "../api/children";
import { leadsApi } from "../api/leads";
import { ApiError } from "../api/client";
import { useBranch } from "../layout/BranchContext";

export default function WaitlistPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const { data: groups = [] } = useQuery({
    queryKey: ["groups", branchId],
    queryFn: () => groupsApi.list(branchId),
    enabled: Boolean(branchId),
  });
  const [groupId, setGroupId] = useState<string | undefined>();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["waitlist", branchId, groupId],
    queryFn: () => waitlistApi.list(branchId, groupId!),
    enabled: Boolean(branchId && groupId),
  });
  const { data: waitlistedChildren = [] } = useQuery({
    queryKey: ["children", branchId, "WAITLIST"],
    queryFn: () => childrenApi.list(branchId, { status: "WAITLIST" }),
    enabled: Boolean(branchId),
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["leads", branchId],
    queryFn: () => leadsApi.list(branchId),
    enabled: Boolean(branchId),
  });
  const queueableLeads = leads.filter((l) => !["ENROLLED", "REJECTED", "WAITLISTED"].includes(l.stage));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["waitlist", branchId, groupId] });

  const [open, setOpen] = useState(false);
  const [entryType, setEntryType] = useState<"child" | "lead">("child");
  const [form] = Form.useForm();

  const addMutation = useMutation({
    mutationFn: (values: { childId?: string; leadId?: string; priority?: number }) =>
      waitlistApi.add(branchId, groupId!, values),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["leads", branchId] });
      setOpen(false);
      message.success("Добавлено в очередь");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const removeMutation = useMutation({
    mutationFn: (entryId: string) => waitlistApi.remove(branchId, groupId!, entryId),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["leads", branchId] });
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Очередь
        </Typography.Title>
        <Space>
          <Select
            placeholder="Выберите группу"
            style={{ width: 240 }}
            value={groupId}
            onChange={setGroupId}
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!groupId}
            onClick={() => {
              setEntryType("child");
              form.resetFields();
              setOpen(true);
            }}
          >
            Добавить в очередь
          </Button>
        </Space>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={entries}
        columns={[
          {
            title: "Кандидат",
            key: "candidate",
            render: (_, e) =>
              e.child?.fullName ?? e.lead?.childFullName ?? e.lead?.parentFullName ?? e.leadName ?? "—",
          },
          { title: "Приоритет", dataIndex: "priority" },
          { title: "В очереди с", dataIndex: "queuedAt" },
          {
            title: "",
            key: "actions",
            render: (_, e) => (
              <Button size="small" danger onClick={() => removeMutation.mutate(e.id)}>
                Убрать из очереди
              </Button>
            ),
          },
        ]}
      />

      <Modal
        title="Добавить в очередь"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={addMutation.isPending}
        destroyOnClose
      >
        <Radio.Group
          value={entryType}
          onChange={(e) => {
            setEntryType(e.target.value);
            form.resetFields(["childId", "leadId"]);
          }}
          style={{ marginBottom: 16 }}
        >
          <Radio.Button value="child">Зачисленный ребёнок</Radio.Button>
          <Radio.Button value="lead">Лид</Radio.Button>
        </Radio.Group>
        <Form form={form} layout="vertical" onFinish={(values) => addMutation.mutate(values)}>
          {entryType === "child" ? (
            <Form.Item label="Ребёнок" name="childId" rules={[{ required: true, message: "Выберите ребёнка" }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={waitlistedChildren.map((c) => ({ value: c.id, label: c.fullName }))}
              />
            </Form.Item>
          ) : (
            <Form.Item label="Лид" name="leadId" rules={[{ required: true, message: "Выберите лид" }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={queueableLeads.map((l) => ({
                  value: l.id,
                  label: `${l.parentFullName}${l.childFullName ? ` (${l.childFullName})` : ""}`,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item label="Приоритет" name="priority">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
