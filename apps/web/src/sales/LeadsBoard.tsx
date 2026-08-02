import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { App, Card, Flex, Skeleton, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { leadsApi } from "../api/leads";
import { ApiError } from "../api/client";
import { LEAD_BOARD_STAGES, LEAD_STAGE_LABELS, type AssignableLeadStage, type Lead } from "../api/types";

function LeadCard({ lead }: { lead: Lead }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10, position: "relative" as const }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Card
        size="small"
        style={{ marginBottom: 8, cursor: "grab", opacity: isDragging ? 0.5 : 1 }}
        hoverable
        onClick={() => !isDragging && navigate(`/leads/${lead.id}`)}
      >
        <Typography.Text strong>{lead.parentFullName}</Typography.Text>
        {lead.childFullName && (
          <div>
            <Typography.Text type="secondary">{lead.childFullName}</Typography.Text>
          </div>
        )}
        <div>
          <Typography.Text type="secondary">{lead.parentPhone}</Typography.Text>
        </div>
      </Card>
    </div>
  );
}

function Column({ stage, leads }: { stage: AssignableLeadStage; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? "#e6f4ff" : "#fafafa",
        borderRadius: 8,
        padding: 8,
        minWidth: 240,
        flex: "1 0 240px",
      }}
    >
      <Typography.Text strong>
        {LEAD_STAGE_LABELS[stage]} ({leads.length})
      </Typography.Text>
      <div style={{ marginTop: 8, minHeight: 40 }}>
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

export default function LeadsBoard({
  branchId,
  leads,
  isLoading,
}: {
  branchId: string;
  leads: Lead[];
  isLoading: boolean;
}) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const updateStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: AssignableLeadStage }) =>
      leadsApi.updateStage(branchId, id, { stage }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["leads", branchId] }),
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Не удалось перенести лид"),
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const targetStage = over.id as AssignableLeadStage;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === targetStage) return;

    updateStage.mutate({ id: leadId, stage: targetStage });
  }

  if (isLoading) return <Skeleton active />;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <Flex gap={12} style={{ overflowX: "auto", paddingBottom: 8 }}>
        {LEAD_BOARD_STAGES.map((stage) => (
          <Column key={stage} stage={stage} leads={leads.filter((l) => l.stage === stage)} />
        ))}
      </Flex>
    </DndContext>
  );
}
