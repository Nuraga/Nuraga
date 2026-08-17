import { Injectable, Inject, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { OBJECT_STORAGE, type ObjectStorage } from "../../common/storage/object-storage.interface";
import { TelegramService } from "../../common/telegram/telegram.service";
import { REPORT_RETENTION_DAYS } from "./tasks.service";

// Task report attachments (photo/document proof of completed work) are
// deliberately not kept forever — deletes the file + clears the DB
// pointers REPORT_RETENTION_DAYS after upload. The task itself (status,
// description, completedAt) is untouched; only the attachment goes away.
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
}
