import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { NotificationType, Role, Task, TaskStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { AuditService } from "../../common/audit/audit.service";
import { FileUrlService } from "../../common/storage/file-url.service";
import { OBJECT_STORAGE, type ObjectStorage } from "../../common/storage/object-storage.interface";
import { NotificationsService } from "../../notifications/notifications.service";
import { parseLocalDateTime } from "../../common/time/local-time";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";
import { CreateTaskDto } from "./dto/create-task.dto";

// ТЗ §2.2 has no dedicated "Задачи" row — reusing the "Лиды" row's roles for
// lead/family-linked tasks (MANAGER = менеджер по продажам, needs this for
// their own follow-ups). Tasks with neither leadId nor familyId are general
// staff assignments (заведующий/методист -> воспитатель/няня) — MANAGER
// deliberately has NO access to these; only OWNER/BRANCH_MANAGER/METHODIST
// (SUPERADMIN bypasses via hasNetworkAccess) may assign or manage them. Any
// staff member can always read/update the status of a task assigned to them
// regardless of role.
const SALES_TASK_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER"];
const STAFF_TASK_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "METHODIST"];

// How long a submitted report file (photo/document proof of completed
// work) survives before TaskReportCleanupService's daily cron deletes it.
// Exported so the cleanup service's cutoff math and this service's naming
// stay obviously in sync.
export const REPORT_RETENTION_DAYS = 30;

// How long a finished task stays on the board before it's archived to the
// Telegram channel and purged from the DB (agreed with the user: "через
// месяц он удаляется насовсем, архивом будет служить телеграм канал").
// Counted from completedAt, not creation. Only DONE tasks are ever purged —
// an open task lives forever no matter how old.
export const COMPLETED_TASK_RETENTION_DAYS = 30;

export interface TaskFilters {
  leadId?: string;
  familyId?: string;
  assignedToId?: string;
  onlyOpen?: boolean;
  /** "staff" restricts to general staff assignments (no lead/family link) — used by the kanban board. */
  scope?: "staff";
}

export interface TaskView extends Omit<Task, "reportFileKey" | "reportMimeType"> {
  reportDownloadUrl: string | null;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
    private readonly fileUrls: FileUrlService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthenticatedUser, branchId: string, filters: TaskFilters): Promise<TaskView[]> {
    const isOwnTasksOnly = Boolean(filters.assignedToId) && filters.assignedToId === user.id;
    if (isOwnTasksOnly) {
      this.branchScope.assertBranchAccess(user, branchId);
    } else {
      const roles = filters.scope === "staff" ? STAFF_TASK_ROLES : SALES_TASK_ROLES;
      this.branchScope.assertRoleInBranch(user, roles, branchId);
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        branchId,
        ...(filters.scope === "staff" ? { leadId: null, familyId: null } : {}),
        ...(filters.leadId ? { leadId: filters.leadId } : {}),
        ...(filters.familyId ? { familyId: filters.familyId } : {}),
        ...(filters.assignedToId ? { assignedToId: filters.assignedToId } : {}),
        ...(filters.onlyOpen ? { completedAt: null } : {}),
      },
      orderBy: { dueAt: "asc" },
    });

    return Promise.all(tasks.map((t) => this.toView(t)));
  }

  async create(user: AuthenticatedUser, branchId: string, dto: CreateTaskDto): Promise<TaskView> {
    if (dto.leadId && dto.familyId) {
      throw new BadRequestException("A task cannot be linked to both a lead and a family");
    }

    const roles = dto.leadId || dto.familyId ? SALES_TASK_ROLES : STAFF_TASK_ROLES;
    this.branchScope.assertRoleInBranch(user, roles, branchId);

    if (dto.leadId) await this.assertLeadInBranch(branchId, dto.leadId);
    if (dto.familyId) await this.assertFamilyInBranch(branchId, dto.familyId);

    const task = await this.prisma.task.create({
      data: {
        branchId,
        leadId: dto.leadId,
        familyId: dto.familyId,
        description: dto.description,
        // Same naive-wall-clock input as the attendance correction form.
        dueAt: parseLocalDateTime(dto.dueAt),
        assignedToId: dto.assignedToId,
        createdById: user.id,
      },
    });
    await this.audit.record({
      entity: "task",
      entityId: task.id,
      action: "create",
      newValue: task,
      actorId: user.id,
    });

    await this.notifyAssignee(task);

    return this.toView(task);
  }

  async complete(user: AuthenticatedUser, branchId: string, id: string): Promise<TaskView> {
    return this.updateStatus(user, branchId, id, "DONE");
  }

  async updateStatus(user: AuthenticatedUser, branchId: string, id: string, status: TaskStatus): Promise<TaskView> {
    const existing = await this.getInBranch(user, branchId, id);
    this.assertCanActOnTask(user, branchId, existing);

    const task = await this.prisma.task.update({
      where: { id },
      data: { status, completedAt: status === "DONE" ? new Date() : null },
    });
    await this.audit.record({
      entity: "task",
      entityId: id,
      action: "update",
      oldValue: { status: existing.status },
      newValue: { status },
      actorId: user.id,
    });

    // Only on the TODO/IN_PROGRESS -> DONE edge: dragging an already-DONE
    // card around the board must not re-notify.
    if (status === "DONE" && existing.status !== "DONE") {
      await this.notifyCreator(
        existing,
        user,
        "TASK_COMPLETED",
        `${user.fullName} выполнил(а) задачу: ${existing.description}`,
      );
    }

    return this.toView(task);
  }

  /**
   * The assignee (or a manager for this task's category) submits proof of
   * completed work — a photo or document. Replaces any previously attached
   * report. Auto-deleted after REPORT_RETENTION_DAYS by
   * TaskReportCleanupService, not kept indefinitely.
   */
  async attachReport(
    user: AuthenticatedUser,
    branchId: string,
    id: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ): Promise<TaskView> {
    const existing = await this.getInBranch(user, branchId, id);
    this.assertCanActOnTask(user, branchId, existing);

    if (existing.reportFileKey) {
      await this.storage.delete(existing.reportFileKey);
    }

    const key = `task-reports/${branchId}/${id}/${randomUUID()}-${this.sanitizeFileName(file.originalname)}`;
    await this.storage.save(key, file.buffer, file.mimetype);

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        reportFileKey: key,
        reportFileName: file.originalname,
        reportMimeType: file.mimetype,
        reportUploadedAt: new Date(),
      },
    });

    await this.audit.record({
      entity: "task",
      entityId: id,
      action: "update",
      newValue: { event: "report_attached", fileName: file.originalname },
      actorId: user.id,
    });

    await this.notifyCreator(
      existing,
      user,
      "TASK_REPORT_SUBMITTED",
      `${user.fullName} прикрепил(а) отчёт к задаче: ${existing.description}`,
    );

    return this.toView(task);
  }

  async removeReport(user: AuthenticatedUser, branchId: string, id: string): Promise<TaskView> {
    const existing = await this.getInBranch(user, branchId, id);
    this.assertCanActOnTask(user, branchId, existing);

    if (!existing.reportFileKey) {
      return this.toView(existing);
    }

    await this.storage.delete(existing.reportFileKey);
    const task = await this.prisma.task.update({
      where: { id },
      data: { reportFileKey: null, reportFileName: null, reportMimeType: null, reportUploadedAt: null },
    });

    await this.audit.record({
      entity: "task",
      entityId: id,
      action: "update",
      newValue: { event: "report_removed" },
      actorId: user.id,
    });

    return this.toView(task);
  }

  /** Tells the assignee work has landed on them. Skipped when someone assigns a task to themselves. */
  private async notifyAssignee(task: Task): Promise<void> {
    if (task.assignedToId === task.createdById) return;

    const due = task.dueAt.toLocaleDateString("ru-RU");
    await this.notifications.create(
      task.assignedToId,
      "TASK_ASSIGNED",
      `Вам назначена задача: ${task.description} (срок: ${due})`,
    );
  }

  /**
   * Reports back to whoever assigned the task. No-op for tasks created
   * before createdById existed, and when the actor *is* the creator (a
   * manager closing out their own task shouldn't notify themselves).
   */
  private async notifyCreator(
    task: Task,
    actor: AuthenticatedUser,
    type: NotificationType,
    message: string,
  ): Promise<void> {
    if (!task.createdById || task.createdById === actor.id) return;

    await this.notifications.create(task.createdById, type, message);
  }

  private assertCanActOnTask(user: AuthenticatedUser, branchId: string, task: Task): void {
    const roles = task.leadId || task.familyId ? SALES_TASK_ROLES : STAFF_TASK_ROLES;
    if (!this.branchScope.hasAnyRoleInBranch(user, roles, branchId) && task.assignedToId !== user.id) {
      throw new ForbiddenException("You can only act on tasks assigned to you");
    }
  }

  private async getInBranch(user: AuthenticatedUser, branchId: string, id: string) {
    this.branchScope.assertBranchAccess(user, branchId);

    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task || task.branchId !== branchId) throw new NotFoundException("Task not found");
    return task;
  }

  private async assertLeadInBranch(branchId: string, leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.branchId !== branchId) {
      throw new BadRequestException("Lead does not belong to this branch");
    }
  }

  private async assertFamilyInBranch(branchId: string, familyId: string): Promise<void> {
    const family = await this.prisma.family.findUnique({ where: { id: familyId } });
    if (!family || family.branchId !== branchId) {
      throw new BadRequestException("Family does not belong to this branch");
    }
  }

  private async toView(task: Task): Promise<TaskView> {
    const { reportFileKey, reportMimeType, ...rest } = task;
    const reportDownloadUrl =
      reportFileKey && reportMimeType
        ? `/api/files/${await this.fileUrls.sign({
            key: reportFileKey,
            contentType: reportMimeType,
            fileName: task.reportFileName ?? "report",
          })}`
        : null;
    return { ...rest, reportDownloadUrl };
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  }
}
