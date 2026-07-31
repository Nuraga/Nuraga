import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Form, InputNumber, Modal, Select, Space, Table, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { waitlistApi } from "../api/enrollment";
import { groupsApi } from "../api/groups";
import { childrenApi } from "../api/children";
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["waitlist", branchId, groupId] });

  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const addMutation = useMutation({
    mutationFn: (values: { childId: string; priority?: number }) => waitlistApi.add(branchId, groupId!, values),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      message.success("Добавлено в очередь");
    },
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Ошибка"),
  });

  const removeMutation = useMutation({
    mutationFn: (entryId: string) => waitlistApi.remove(branchId, groupId!, entryId),
    onSuccess: invalidate,
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
          <Button type="primary" icon={<PlusOutlined />} disabled={!groupId} onClick={() => setOpen(true)}>
            Добавить в очередь
          </Button>
        </Space>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={entries}
        columns={[
          { title: "Ребёнок", key: "child", render: (_, e) => e.child?.fullName ?? e.leadName ?? "—" },
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
        <Form form={form} layout="vertical" onFinish={(values) => addMutation.mutate(values)}>
          <Form.Item label="Ребёнок" name="childId" rules={[{ required: true, message: "Выберите ребёнка" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={waitlistedChildren.map((c) => ({ value: c.id, label: c.fullName }))}
            />
          </Form.Item>
          <Form.Item label="Приоритет" name="priority">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
