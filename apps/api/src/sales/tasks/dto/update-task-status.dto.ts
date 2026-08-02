import { IsIn } from "class-validator";

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export type TaskStatusValue = (typeof TASK_STATUSES)[number];

export class UpdateTaskStatusDto {
  @IsIn(TASK_STATUSES)
  status!: TaskStatusValue;
}
