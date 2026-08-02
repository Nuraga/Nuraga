import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Select, Space, Table, Tag, Typography } from "antd";
import { childrenApi } from "../api/children";
import { groupsApi } from "../api/groups";
import type { Child, ChildStatus } from "../api/types";
import { useBranch } from "../layout/BranchContext";

const STATUS_LABELS: Record<ChildStatus, { label: string; color: string }> = {
  WAITLIST: { label: "Очередь", color: "gold" },
  ENROLLED: { label: "Зачислен", color: "green" },
  SUSPENDED: { label: "Приостановлен", color: "orange" },
  DISCHARGED: { label: "Отчислен", color: "default" },
};

export default function ChildrenPage() {
  const navigate = useNavigate();
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const [status, setStatus] = useState<string | undefined>();
  const [groupId, setGroupId] = useState<string | undefined>();

  const { data: groups = [] } = useQuery({
    queryKey: ["groups", branchId],
    queryFn: () => groupsApi.list(branchId),
    enabled: Boolean(branchId),
  });

  const { data: children = [], isLoading } = useQuery({
    queryKey: ["children", branchId, status, groupId],
    queryFn: () => childrenApi.list(branchId, { status, groupId }),
    enabled: Boolean(branchId),
  });

  function groupName(id: string | null) {
    if (!id) return "—";
    return groups.find((g) => g.id === id)?.name ?? id;
  }

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Дети
        </Typography.Title>
        <Space>
          <Select
            placeholder="Статус"
            allowClear
            style={{ width: 180 }}
            value={status}
            onChange={setStatus}
            options={Object.entries(STATUS_LABELS).map(([value, { label }]) => ({ value, label }))}
          />
          <Select
            placeholder="Группа"
            allowClear
            style={{ width: 200 }}
            value={groupId}
            onChange={setGroupId}
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
          />
        </Space>
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={children}
        onRow={(child) => ({ onClick: () => navigate(`/children/${child.id}`), style: { cursor: "pointer" } })}
        columns={[
          { title: "ФИО", dataIndex: "fullName" },
          { title: "Дата рождения", dataIndex: "birthDate" },
          { title: "Группа", key: "group", render: (_, c: Child) => groupName(c.groupId) },
          {
            title: "Статус",
            dataIndex: "status",
            render: (s: ChildStatus) => <Tag color={STATUS_LABELS[s].color}>{STATUS_LABELS[s].label}</Tag>,
          },
        ]}
      />
    </>
  );
}
