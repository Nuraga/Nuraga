import { Table, Tag, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { LEAD_STAGE_LABELS, type Lead } from "../api/types";

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

// ТЗ §3.3: "Если у лида в нетерминальной стадии нет открытой задачи более
// 2 суток — он попадает в отдельный список «Без внимания»". The filtering
// itself (no open task, stage untouched >2 days) happens server-side in
// LeadsService.listNeedingAttention — this view just renders the result.
export default function LeadsAttentionList({
  leads,
  isLoading,
}: {
  leads: Lead[];
  isLoading: boolean;
}) {
  const navigate = useNavigate();

  return (
    <>
      <Typography.Paragraph type="secondary">
        Лиды в работе без задач и без движения по стадии более 2 дней — по каждому нужно
        зафиксировать следующий шаг.
      </Typography.Paragraph>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={leads}
        onRow={(lead) => ({ onClick: () => navigate(`/leads/${lead.id}`), style: { cursor: "pointer" } })}
        locale={{ emptyText: "Лидов, требующих внимания, нет" }}
        columns={[
          { title: "Родитель", dataIndex: "parentFullName" },
          { title: "Телефон", dataIndex: "parentPhone" },
          { title: "Ребёнок", dataIndex: "childFullName", render: (v: string | null) => v ?? "—" },
          {
            title: "Стадия",
            dataIndex: "stage",
            render: (stage: Lead["stage"]) => <Tag color="orange">{LEAD_STAGE_LABELS[stage]}</Tag>,
          },
          {
            title: "Без движения",
            dataIndex: "stageEnteredAt",
            render: (v: string) => `${daysSince(v)} дн.`,
          },
        ]}
      />
    </>
  );
}
