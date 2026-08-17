import { Injectable, Inject, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { OBJECT_STORAGE, type ObjectStorage } from "../../common/storage/object-storage.interface";
import { TelegramService } from "../../common/telegram/telegram.service";
import { COMPLETED_TASK_RETENTION_DAYS, REPORT_RETENTION_DAYS } from "./tasks.service";

// Nightly retention for the task board, in two independent stages:
//   1. cleanupExpiredReports — drops the attachment REPORT_RETENTION_DAYS
//      after upload, leaving the task row itself intact.
//   2. purgeCompletedTasks — deletes the whole task
//      COMPLETED_TASK_RETENTION_DAYS after it was finished, so "Выполнено"
//      can't grow without bound.
// Both mirror the data into the Telegram backup channel first, but with a
// crucial difference in how failure is treated — see purgeCompletedTasks.
@Injectable()
export class TaskReportCleanupService {
  private readonly logger = new Logger(TaskReportCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly telegram: TelegramService,
  ) {}

  // Same slot as the Postgres backup cron (scripts/backup.sh, 03:00) —
  // quiet hours, and easy to reason about "what runs when" in one place.
  @Cron("0 3 * * *")
  async handleCron(): Promise<void> {
    const deleted = await this.cleanupExpiredReports();
    if (deleted > 0) this.logger.log(`Deleted ${deleted} expired task report attachment(s)`);

    // Runs second on purpose: stage 1 has already archived+dropped any
    // attachment old enough to go, so stage 1 handles the common case and
    // this only deals with whatever is still attached.
    const purged = await this.purgeCompletedTasks();
    if (purged > 0) this.logger.log(`Purged ${purged} completed task(s) to the Telegram archive`);
  }

  /** Public (not just cron-triggered) so it's directly unit-testable and callable from an admin/ops path if ever needed. */
  async cleanupExpiredReports(): Promise<number> {
    const cutoff = new Date(Date.now() - REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const expired = await this.prisma.task.findMany({
      where: { reportFileKey: { not: null }, reportUploadedAt: { lt: cutoff } },
      select: { id: true, reportFileKey: true, reportFileName: true, reportMimeType: true },
    });

    for (const task of expired) {
      // Archive to the Telegram backup channel before the file is gone for
      // good — best-effort (never blocks deletion): a missed backup is
      // recoverable, an unbounded disk is not.
      let archived = false;
      try {
        const data = await this.storage.read(task.reportFileKey!);
        archived = await this.telegram.archiveFile({
          data,
          fileName: task.reportFileName ?? task.reportFileKey!,
          mimeType: task.reportMimeType ?? "application/octet-stream",
          caption: `Отчёт по задаче ${task.id} (${task.reportFileName}) — автоудаление через ${REPORT_RETENTION_DAYS} дн.`,
        });
      } catch (err) {
        this.logger.warn(`Failed to archive report file for task ${task.id} to Telegram: ${err}`);
      }

      // Best-effort: if the file is already gone (e.g. a prior run crashed
      // after storage.delete but before the DB update), still clear the
      // now-dangling DB pointer rather than retrying forever.
      try {
        await this.storage.delete(task.reportFileKey!);
      } catch (err) {
        this.logger.warn(`Failed to delete report file for task ${task.id}: ${err}`);
      }

      await this.prisma.task.update({
        where: { id: task.id },
        data: { reportFileKey: null, reportFileName: null, reportMimeType: null, reportUploadedAt: null },
      });

      await this.audit.record({
        entity: "task",
        entityId: task.id,
        action: "update",
        newValue: { event: "report_expired", fileName: task.reportFileName, archivedToTelegram: archived },
        actorId: null,
      });
    }

    return expired.length;
  }

  /**
   * Archives finished tasks to the Telegram channel and deletes them, so the
   * "Выполнено" column stays bounded.
   *
   * Unlike the attachment cleanup above, archiving here is NOT best-effort:
   * once the row is gone the channel message is the only remaining record,
   * so a task whose archive call fails is left in place and retried on the
   * next run. Better a slightly long board than silently lost history.
   */
  async purgeCompletedTasks(): Promise<number> {
    const cutoff = new Date(Date.now() - COMPLETED_TASK_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const expired = await this.prisma.task.findMany({
      where: { status: "DONE", completedAt: { lt: cutoff } },
      select: {
        id: true,
        branchId: true,
        description: true,
        assignedToId: true,
        createdById: true,
        dueAt: true,
        completedAt: true,
        createdAt: true,
        reportFileKey: true,
        reportFileName: true,
        reportMimeType: true,
      },
    });
    if (expired.length === 0) return 0;

    const names = await this.resolveUserNames(
      expired.flatMap((t) => [t.assignedToId, t.createdById].filter((id): id is string => Boolean(id))),
    );

    let purged = 0;
    for (const task of expired) {
      // Any attachment still here is younger than REPORT_RETENTION_DAYS, so
      // stage 1 hasn't archived it yet — send it now, or it would be orphaned
      // in storage with no copy anywhere once the row is deleted.
      if (task.reportFileKey) {
        let fileArchived = false;
        try {
          const data = await this.storage.read(task.reportFileKey);
          fileArchived = await this.telegram.archiveFile({
            data,
            fileName: task.reportFileName ?? task.reportFileKey,
            mimeType: task.reportMimeType ?? "application/octet-stream",
            caption: `Отчёт по задаче ${task.id} (${task.reportFileName}) — задача удаляется из CRM`,
          });
        } catch (err) {
          this.logger.warn(`Failed to archive attachment of task ${task.id} before purge: ${err}`);
        }
        if (!fileArchived) {
          this.logger.warn(`Keeping task ${task.id}: its attachment could not be archived`);
          continue;
        }
      }

      const archived = await this.telegram.archiveMessage(this.formatTaskRecord(task, names));
      if (!archived) {
        this.logger.warn(`Keeping task ${task.id}: Telegram archive failed, will retry next run`);
        continue;
      }

      if (task.reportFileKey) {
        try {
          await this.storage.delete(task.reportFileKey);
        } catch (err) {
          this.logger.warn(`Failed to delete report file of purged task ${task.id}: ${err}`);
        }
      }

      await this.prisma.task.delete({ where: { id: task.id } });

      // Audit rows outlive the task on purpose — they're the in-CRM trace
      // that the record existed and where it went.
      await this.audit.record({
        entity: "task",
        entityId: task.id,
        action: "delete",
        oldValue: { description: task.description, completedAt: task.completedAt },
        newValue: { event: "completed_task_purged", archivedToTelegram: true },
        actorId: null,
      });
      purged += 1;
    }

    return purged;
  }

  private async resolveUserNames(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();

    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, fullName: true },
    });
    return new Map(users.map((u) => [u.id, u.fullName]));
  }

  /** The channel message *is* the archive, so it carries every field the deleted row had. */
  private formatTaskRecord(
    task: {
      id: string;
      branchId: string;
      description: string;
      assignedToId: string;
      createdById: string | null;
      dueAt: Date;
      completedAt: Date | null;
      createdAt: Date;
      reportFileName: string | null;
    },
    names: Map<string, string>,
  ): string {
    const date = (d: Date | null) => (d ? d.toLocaleDateString("ru-RU") : "—");
    return [
      "🗂 Архив выполненной задачи",
      `Описание: ${task.description}`,
      `Исполнитель: ${names.get(task.assignedToId) ?? task.assignedToId}`,
      `Выдал(а): ${task.createdById ? (names.get(task.createdById) ?? task.createdById) : "—"}`,
      `Создана: ${date(task.createdAt)}`,
      `Срок: ${date(task.dueAt)}`,
      `Выполнена: ${date(task.completedAt)}`,
      `Отчёт: ${task.reportFileName ?? "не прикреплялся"}`,
      `ID: ${task.id} · филиал ${task.branchId}`,
    ].join("\n");
  }
}
