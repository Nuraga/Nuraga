import { useRef } from "react";
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
import { App, Button, Card, Flex, Skeleton, Space, Typography } from "antd";
import { PaperClipOutlined, CloseOutlined, UploadOutlined } from "@ant-design/icons";
import { tasksApi } from "../api/tasks";
import { ApiError } from "../api/client";
import { TASK_BOARD_STATUSES, TASK_BOARD_STATUS_LABELS, type Task, type TaskBoardStatus } from "../api/types";

const MAX_REPORT_MB = 15;

function TaskReportAttachment({ branchId, task }: { branchId: string; task: Task }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["tasks", branchId] });

  const attach = useMutation({
    mutationFn: (file: File) => tasksApi.attachReport(branchId, task.id, file),
    onSuccess: invalidate,
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Не удалось загрузить отчёт"),
  });
  const remove = useMutation({
    mutationFn: () => tasksApi.removeReport(branchId, task.id),
    onSuccess: invalidate,
    onError: (err) => message.error(err instanceof ApiError ? err.message : "Не удалось удалить отчёт"),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;
    if (file.size > MAX_REPORT_MB * 1024 * 1024) {
      message.error(`Файл больше ${MAX_REPORT_MB} МБ`);
      return;
    }
    attach.mutate(file);
  }

  // Bare mousedown/click (no movement) still reaches nested elements under
  // dnd-kit's PointerSensor (activationConstraint requires 5px of drag
  // distance before it takes over) — stopPropagation just avoids any
  // ambiguity with the card's own drag listeners on the button itself.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  if (task.reportDownloadUrl) {
    return (
      <div onPointerDown={stop} style={{ marginTop: 4 }}>
        <Space size={4}>
          <a href={task.reportDownloadUrl} target="_blank" rel="noreferrer">
            <PaperClipOutlined /> {task.reportFileName}
          </a>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined style={{ fontSize: 10 }} />}
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          />
        </Space>
      </div>
    );
  }

  return (
    <div onPointerDown={stop} style={{ marginTop: 4 }}>
      <input ref={inputRef} type="file" hidden onChange={handleFileChange} />
      <Button
        type="text"
        size="small"
        icon={<UploadOutlined />}
        loading={attach.isPending}
        onClick={() => inputRef.current?.click()}
      >
        Отчёт о работе
      </Button>
    </div>
  );
}

function TaskCard({ branchId, task, assigneeName }: { branchId: string; task: Task; assigneeName: string }) {
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
        <TaskReportAttachment branchId={branchId} task={task} />
      </Card>
    </div>
  );
}

function Column({
  branchId,
  status,
  tasks,
  assigneeNames,
}: {
  branchId: string;
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
          <TaskCard
            key={task.id}
            branchId={branchId}
            task={task}
            assigneeName={assigneeNames.get(task.assignedToId) ?? "—"}
          />
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
            branchId={branchId}
            status={status}
            tasks={tasks.filter((t) => t.status === status)}
            assigneeNames={assigneeNames}
          />
        ))}
      </Flex>
    </DndContext>
  );
}
