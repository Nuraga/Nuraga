import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Segmented, Select, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { leadsApi } from "../api/leads";
import { leadSourcesApi } from "../api/dictionaries";
import { staffApi } from "../api/staff";
import { useBranch } from "../layout/BranchContext";
import LeadsBoard from "./LeadsBoard";
import LeadsTable from "./LeadsTable";
import CreateLeadModal from "./CreateLeadModal";

export default function LeadsPage() {
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const [view, setView] = useState<"board" | "table">("board");
  const [sourceId, setSourceId] = useState<string | undefined>();
  const [responsibleUserId, setResponsibleUserId] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", branchId, sourceId, responsibleUserId],
    queryFn: () => leadsApi.list(branchId, { sourceId, responsibleUserId }),
    enabled: Boolean(branchId),
  });
  const { data: sources = [] } = useQuery({ queryKey: ["lead-sources"], queryFn: leadSourcesApi.list });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff", branchId],
    queryFn: () => staffApi.list(branchId),
    enabled: Boolean(branchId),
  });

  const staffOptions = staff
    .filter((s) => s.user)
    .map((s) => ({ value: s.user!.id, label: s.user!.fullName }));

  return (
    <>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Лиды
        </Typography.Title>
        <Space wrap>
          <Select
            placeholder="Источник"
            allowClear
            style={{ width: 180 }}
            value={sourceId}
            onChange={setSourceId}
            options={sources.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            placeholder="Ответственный"
            allowClear
            style={{ width: 200 }}
            value={responsibleUserId}
            onChange={setResponsibleUserId}
            options={staffOptions}
          />
          <Segmented
            value={view}
            onChange={(v) => setView(v as "board" | "table")}
            options={[
              { label: "Воронка", value: "board" },
              { label: "Таблица", value: "table" },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Новый лид
          </Button>
        </Space>
      </Space>

      {view === "board" ? (
        <LeadsBoard branchId={branchId} leads={leads} isLoading={isLoading} />
      ) : (
        <LeadsTable leads={leads} isLoading={isLoading} />
      )}

      <CreateLeadModal
        branchId={branchId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        sources={sources}
        staffOptions={staffOptions}
      />
    </>
  );
}
