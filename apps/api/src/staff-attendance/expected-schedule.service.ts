import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { DEFAULT_CHECK_IN_TIME, DEFAULT_CHECK_OUT_TIME, toLocalDateOnly } from "./staff-attendance.service";

export interface ExpectedTimes {
  checkIn: string;
  checkOut: string;
  /** True when a scheduled shift decided these, false when they came from the staff card / network defaults. */
  fromShift: boolean;
}

export interface ShiftWindow {
  start: string;
  end: string;
}

/**
 * Single source of truth for "when was this person due today".
 *
 * The schedule (График смен) and the per-staff expected times overlap but
 * aren't duplicates: the card is a standing rule that needs no upkeep, the
 * schedule is a per-day plan someone has to fill in. So they're a fallback
 * chain rather than an either/or — shift wins where one exists, card fills
 * every other day, network defaults cover staff with neither. That way
 * nobody has to enter the same information twice, and lateness detection
 * keeps working during weeks when the schedule wasn't filled in at all.
 */
@Injectable()
export class ExpectedScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  static key(staffId: string, localDay: Date): string {
    return `${staffId}|${localDay.toISOString().slice(0, 10)}`;
  }

  /**
   * Shift windows keyed by staff+local day, for every day in the (inclusive)
   * range that has one. A day with several shifts (split shift: morning +
   * evening) collapses to the earliest start and the latest end — arriving
   * for the first one shouldn't read as late, and leaving after the last
   * shouldn't be cut short.
   */
  async shiftWindows(staffIds: string[], fromLocalDay: Date, toLocalDay: Date): Promise<Map<string, ShiftWindow>> {
    const windows = new Map<string, ShiftWindow>();
    if (staffIds.length === 0) return windows;

    const shifts = await this.prisma.shift.findMany({
      where: { staffId: { in: [...new Set(staffIds)] }, date: { gte: fromLocalDay, lte: toLocalDay } },
      select: { staffId: true, date: true, startTime: true, endTime: true },
    });

    for (const shift of shifts) {
      const key = ExpectedScheduleService.key(shift.staffId, shift.date);
      const current = windows.get(key);
      windows.set(key, {
        // HH:MM strings are zero-padded 24h, so string comparison is ordering.
        start: current && current.start < shift.startTime ? current.start : shift.startTime,
        end: current && current.end > shift.endTime ? current.end : shift.endTime,
      });
    }

    return windows;
  }

  /** Convenience for the single-staff, single-instant paths (a kiosk scan). */
  async forInstant(
    staff: { id: string; expectedCheckInTime: string | null; expectedCheckOutTime: string | null },
    occurredAt: Date,
  ): Promise<ExpectedTimes> {
    const day = toLocalDateOnly(occurredAt);
    const windows = await this.shiftWindows([staff.id], day, day);
    return resolveExpected(windows.get(ExpectedScheduleService.key(staff.id, day)), staff);
  }
}

/** Pure fallback chain: scheduled shift -> staff card -> network default. */
export function resolveExpected(
  shift: ShiftWindow | undefined,
  staff: { expectedCheckInTime: string | null; expectedCheckOutTime: string | null },
): ExpectedTimes {
  if (shift) {
    return { checkIn: shift.start, checkOut: shift.end, fromShift: true };
  }
  return {
    checkIn: staff.expectedCheckInTime ?? DEFAULT_CHECK_IN_TIME,
    checkOut: staff.expectedCheckOutTime ?? DEFAULT_CHECK_OUT_TIME,
    fromShift: false,
  };
}
