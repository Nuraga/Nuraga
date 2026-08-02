import { Table, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import { LEAD_STAGE_LABELS, type Lead } from "../api/types";

const STAGE_COLORS: Record<string, string> = {
  NEW: "blue",
  CONTACTED: "geekblue",
  TOUR_SCHEDULED: "purple",
  TOUR_DONE: "cyan",
  TRIAL_DAY: "gold",
  CONTRACT_SIGNING: "orange",
  ENROLLED: "green",
  REJECTED: "red",
  WAITLISTED: "default",
};

export default function LeadsTable({ leads, isLoading }: { leads: Lead[]; isLoading: boolean }) {
  const navigate = useNavigate();

  return (
    <Table
      rowKey="id"
      loading={isLoading}
      dataSource={leads}
      onRow={(lead) => ({ onClick: () => navigate(`/leads/${lead.id}`), style: { cursor: "pointer" } })}
      columns={[
        { title: "Родитель", dataIndex: "parentFullName" },
        { title: "Телефон", dataIndex: "parentPhone" },
        { title: "Ребёнок", dataIndex: "childFullName", render: (v: string | null) => v ?? "—" },
        { title: "Источник", key: "source", render: (_, l) => l.source?.name ?? "—" },
        {
          title: "Стадия",
          dataIndex: "stage",
          render: (stage: Lead["stage"]) => <Tag color={STAGE_COLORS[stage]}>{LEAD_STAGE_LABELS[stage]}</Tag>,
        },
        {
          title: "Создан",
          dataIndex: "createdAt",
          render: (v: string) => new Date(v).toLocaleDateString("ru-RU"),
        },
      ]}
    />
  );
}
