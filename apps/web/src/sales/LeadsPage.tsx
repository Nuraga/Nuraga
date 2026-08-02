import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Segmented, Select, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { leadsApi } from "../api/leads";
import { leadSourcesApi } from "../api/dictionaries";
import { staffApi } from "../api/staff";
import { useBranch } from "../layout/BranchContext";
import LeadsBoard from "./LeadsBoard";
import LeadsTable from "./LeadsTable";
import LeadsAttentionList from "./LeadsAttentionList";
import CreateLeadModal from "./CreateLeadModal";

type View = "board" | "table" | "attention";

export default function LeadsPage() {
  const { selectedBranchId } = useBranch();
  const branchId = selectedBranchId!;

  const [view, setView] = useState<View>("board");
  const [sourceId, setSourceId] = useState<string | undefined>();
  const [responsibleUserId, setResponsibleUserId] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", branchId, sourceId, responsibleUserId],
    queryFn: () => leadsApi.list(branchId, { sourceId, responsibleUserId }),
    enabled: Boolean(branchId),
  });
  const { data: attentionLeads = [], isLoading: attentionLoading } = useQuery({
    queryKey: ["leads", branchId, "needing-attention"],
    queryFn: () => leadsApi.listNeedingAttention(branchId),
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
            onChange={(v) => setView(v as View)}
            options={[
              { label: "Воронка", value: "board" },
              { label: "Таблица", value: "table" },
              {
                label: (
                  <Badge count={attentionLeads.length} size="small" offset={[8, -2]}>
                    <span>Без внимания</span>
                  </Badge>
                ),
                value: "attention",
              },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Новый лид
          </Button>
        </Space>
      </Space>

      {view === "board" && <LeadsBoard branchId={branchId} leads={leads} isLoading={isLoading} />}
      {view === "table" && <LeadsTable leads={leads} isLoading={isLoading} />}
      {view === "attention" && (
        <LeadsAttentionList leads={attentionLeads} isLoading={attentionLoading} />
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
