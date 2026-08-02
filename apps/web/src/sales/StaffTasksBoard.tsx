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
import { tasksApi } from "../api/tasks";
import { ApiError } from "../api/client";
import { TASK_BOARD_STATUSES, TASK_BOARD_STATUS_LABELS, type Task, type TaskBoardStatus } from "../api/types";

function TaskCard({ task, assigneeName }: { task: Task; assigneeName: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 10, position: "relative" as const }
    : undefined;
  const isOverdue = task.status !== "DONE" && new Date(task.dueAt).getTime() < Date.now();

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Card size="small" style={{ marginBottom: 8, cursor: "grab", opacity: isDragging ? 0.5 : 1 }}>
        <Typography.Text>{task.description}</Typography.Text>
        <div>
          <Typography.Text type="secondary">{assigneeName}</Typography.Text>
        </div>
        <div>
          <Typography.Text type={isOverdue ? "danger" : "secondary"}>
            {isOverdue && "Просрочено · "}
            Срок: {new Date(task.dueAt).toLocaleDateString("ru-RU")}
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
}

function Column({
  status,
  tasks,
  assigneeNames,
}: {
  status: TaskBoardStatus;
  tasks: Task[];
  assigneeNames: Map<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

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
        {TASK_BOARD_STATUS_LABELS[status]} ({tasks.length})
      </Typography.Text>
      <div style={{ marginTop: 8, minHeight: 40 }}>
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} assigneeName={assigneeNames.get(task.assignedToId) ?? "—"} />
        ))}
      </div>
    </div>
  );
}

export default function StaffTasksBoard({
  branchId,
  tasks,
  isLoading,
  assigneeNames,
}: {
  branchId: string;
  tasks: Task[];
  isLoading: boolean;
  assigneeNames: Map<string, string>;
}) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskBoardStatus }) =>
      tasksApi.updateStatus(branchId, id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks", branchId] }),
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Не удалось перенести задачу"),
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const targetStatus = over.id as TaskBoardStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    updateStatus.mutate({ id: taskId, status: targetStatus });
  }

  if (isLoading) return <Skeleton active />;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <Flex gap={12} style={{ overflowX: "auto", paddingBottom: 8 }}>
        {TASK_BOARD_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={tasks.filter((t) => t.status === status)}
            assigneeNames={assigneeNames}
          />
        ))}
      </Flex>
    </DndContext>
  );
}
