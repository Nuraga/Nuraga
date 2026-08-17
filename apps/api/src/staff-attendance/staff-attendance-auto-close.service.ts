import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { DEFAULT_CHECK_OUT_TIME, LOCAL_UTC_OFFSET_MINUTES, toLocalHHMM } from "./staff-attendance.service";

// Staff who forget to scan out would otherwise leave a CHECK_IN dangling
// forever, and worked-hours pairing (computeDailySummaries) needs both ends
// of the pair. Nobody realistically stays in a kindergarten this late, so an
// open shift at 23:00 local is a missed scan, not a very long day.
//
// 18:00 UTC == 23:00 Asia/Almaty (UTC+5, no DST); the container runs in UTC
// (verified on the VPS: `date` reports UTC, TZ unset). If the network ever
// spans timezones this becomes per-branch, same as the other conversions in
// staff-attendance.service.ts.
const AUTO_CLOSE_CRON = "0 18 * * *";

@Injectable()
export class StaffAttendanceAutoCloseService {
  private readonly logger = new Logger(StaffAttendanceAutoCloseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(AUTO_CLOSE_CRON)
  async handleCron(): Promise<void> {
    const closed = await this.closeForgottenCheckOuts();
    if (closed > 0) this.logger.log(`Auto-closed ${closed} forgotten staff check-out(s)`);
  }

  /** Public so it's unit-testable and re-runnable by hand if a night is missed. */
  async closeForgottenCheckOuts(): Promise<number> {
    const now = new Date();
    const { start, end } = this.localDayRangeUTC(now);

    const events = await this.prisma.staffAttendanceEvent.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      orderBy: { occurredAt: "asc" },
      include: {
        staff: {
          select: {
            id: true,
            userId: true,
            branchId: true,
            expectedCheckOutTime: true,
            user: { select: { fullName: true } },
          },
        },
      },
    });

    // Last event of the day per person decides: still CHECK_IN => never scanned out.
    const lastByStaff = new Map<string, (typeof events)[number]>();
    for (const event of events) lastByStaff.set(event.staffId, event);
    const open = [...lastByStaff.values()].filter((e) => e.type === "CHECK_IN");

    let closed = 0;
    for (const checkIn of open) {
      const expected = checkIn.staff.expectedCheckOutTime ?? DEFAULT_CHECK_OUT_TIME;
      let occurredAt = this.localTimeToUTC(checkIn.occurredAt, expected);

      // An evening arrival (or an expected time earlier than the actual
      // check-in) would otherwise record a departure *before* the arrival and
      // produce negative worked minutes. Clamp to the check-in instead: a
      // zero-length shift is obviously anomalous and prompts a correction,
      // whereas negative time silently corrupts every total it feeds.
      if (occurredAt <= checkIn.occurredAt) {
        this.logger.warn(
          `Staff ${checkIn.staffId} checked in at ${toLocalHHMM(checkIn.occurredAt)}, after their expected check-out ${expected} — clamping auto-close to the check-in time`,
        );
        occurredAt = checkIn.occurredAt;
      }

      const event = await this.prisma.staffAttendanceEvent.create({
        data: {
          staffId: checkIn.staffId,
          branchId: checkIn.staff.branchId,
          type: "CHECK_OUT",
          source: "AUTO_CLOSE",
          occurredAt,
        },
      });

      await this.audit.record({
        entity: "staff_attendance_event",
        entityId: event.id,
        action: "create",
        newValue: {
          event: "auto_closed_check_out",
          staffId: checkIn.staffId,
          occurredAt,
          basedOnExpectedCheckOut: expected,
        },
        actorId: null,
      });

      // The person's own attendance record just changed without them doing
      // anything, so tell them — they're the one who can spot it's wrong.
      await this.notifications.create(
        checkIn.staff.userId,
        "STAFF_SHIFT_AUTO_CLOSED",
        `Вы не отметились об уходе — система записала уход в ${toLocalHHMM(occurredAt)}. Если это неверно, попросите заведующую скорректировать отметку.`,
      );

      closed += 1;
    }

    return closed;
  }

  /** The local calendar day containing `now`, expressed as a UTC half-open range. */
  private localDayRangeUTC(now: Date): { start: Date; end: Date } {
    const local = new Date(now.getTime() + LOCAL_UTC_OFFSET_MINUTES * 60_000);
    const localMidnightUTC = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    const start = new Date(localMidnightUTC - LOCAL_UTC_OFFSET_MINUTES * 60_000);
    return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  }

  /** "18:00" on the local calendar day of `sameDayAs`, as a UTC instant. */
  private localTimeToUTC(sameDayAs: Date, hhmm: string): Date {
    const local = new Date(sameDayAs.getTime() + LOCAL_UTC_OFFSET_MINUTES * 60_000);
    const [hours, minutes] = hhmm.split(":").map(Number);
    const localTarget = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      hours,
      minutes,
    );
    return new Date(localTarget - LOCAL_UTC_OFFSET_MINUTES * 60_000);
  }
}
