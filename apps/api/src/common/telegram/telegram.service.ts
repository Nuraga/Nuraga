import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

// Thin wrapper around the Telegram Bot API (no SDK needed — Node 20's
// built-in fetch/FormData/Blob cover sendDocument/sendPhoto entirely).
// Used today to archive task report attachments to a private channel
// before TaskReportCleanupService deletes them from disk (see ТЗ chat:
// "перед тем как удалит из сайта должны сохраниться в телеграм канале").
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly config: ConfigService) {}

  private get botToken(): string | undefined {
    return this.config.get<string>("TELEGRAM_BOT_TOKEN");
  }

  private get backupChannelId(): string | undefined {
    return this.config.get<string>("TELEGRAM_BACKUP_CHANNEL_ID");
  }

  /** True only when both secrets are configured — callers should treat archiving as best-effort and skip it otherwise. */
  isConfigured(): boolean {
    return Boolean(this.botToken && this.backupChannelId);
  }

  /**
   * Archives a file to the backup channel. Uses sendPhoto for images (so
   * they render inline) and sendDocument for everything else. Best-effort:
   * failures are logged, never thrown — a missed backup must not block the
   * cleanup cron from freeing disk space.
   */
  async archiveFile(params: {
    data: Buffer;
    fileName: string;
    mimeType: string;
    caption: string;
  }): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn("Telegram archiving skipped: TELEGRAM_BOT_TOKEN / TELEGRAM_BACKUP_CHANNEL_ID not configured");
      return false;
    }

    const isImage = params.mimeType.startsWith("image/");
    const method = isImage ? "sendPhoto" : "sendDocument";
    const field = isImage ? "photo" : "document";

    const form = new FormData();
    form.set("chat_id", this.backupChannelId!);
    form.set("caption", params.caption.slice(0, 1024)); // Telegram caption limit
    form.set(field, new Blob([params.data], { type: params.mimeType }), params.fileName);

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/${method}`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        this.logger.warn(`Telegram ${method} failed: ${res.status} ${body}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`Telegram ${method} threw: ${err}`);
      return false;
    }
  }

  /**
   * Archives a plain-text record to the backup channel. Unlike archiveFile,
   * callers use this where the channel copy is the *only* remaining copy
   * (task records being purged) — so they must check the return value and
   * skip the delete when it's false, rather than treating it as best-effort.
   */
  async archiveMessage(text: string): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn("Telegram archiving skipped: TELEGRAM_BOT_TOKEN / TELEGRAM_BACKUP_CHANNEL_ID not configured");
      return false;
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.backupChannelId,
          text: text.slice(0, 4096), // Telegram message limit
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        this.logger.warn(`Telegram sendMessage failed: ${res.status} ${body}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`Telegram sendMessage threw: ${err}`);
      return false;
    }
  }
}
