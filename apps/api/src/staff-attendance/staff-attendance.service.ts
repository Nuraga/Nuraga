import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Role, StaffAttendanceEventType } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import { TokenService } from "../auth/token.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import type { AuthenticatedDevice } from "../devices/device.types";
import { CorrectStaffAttendanceDto } from "./dto/correct-staff-attendance.dto";

// Deliberately its own list, not a reuse of TIMESHEET_CLOSE_ROLES — that
// const also gates closing the monthly payroll period and correcting CHILD
// attendance (attendance/timesheet.service.ts), which a METHODIST has no
// business doing. Viewing/correcting STAFF kiosk attendance ("следить за
// посещениями воспитателей и нянь") is METHODIST's whole job, so it's added
// here alongside the usual branch-management roles.
const STAFF_ATTENDANCE_MANAGE_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "ACCOUNTANT", "METHODIST"];

// A repeat valid scan of the same person this soon after the last one is
// almost certainly a double-read of the same QR frame, not a real second
// entry/exit — return the existing event instead of toggling again.
const SCAN_DEBOUNCE_MS = 2 * 60_000;

interface RawEvent {
  type: StaffAttendanceEventType;
  occurredAt: Date;
}

function todayRangeUTC(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function periodOf(date: Date): { year: number; month: number } {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

/** Pairs consecutive CHECK_IN/CHECK_OUT events per calendar day and sums the minutes between each pair. */
export function computeDailySummaries(
  events: RawEvent[],
): Array<{ date: string; workedMinutes: number }> {
  const byDate = new Map<string, RawEvent[]>();
  for (const event of events) {
    const dateKey = event.occurredAt.toISOString().slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(event);
  }

  const summaries: Array<{ date: string; workedMinutes: number }> = [];
  for (const [date, dayEvents] of byDate) {
    const sorted = [...dayEvents].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    let minutes = 0;
    let pendingCheckIn: Date | null = null;
    for (const event of sorted) {
      if (event.type === "CHECK_IN") {
        pendingCheckIn = event.occurredAt;
      } else if (event.type === "CHECK_OUT" && pendingCheckIn) {
        minutes += (event.occurredAt.getTime() - pendingCheckIn.getTime()) / 60_000;
        pendingCheckIn = null;
      }
    }
    summaries.push({ date, workedMinutes: Math.round(minutes) });
  }
  return summaries.sort((a, b) => a.date.localeCompare(b.date));
}

@Injectable()
export class StaffAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
    private readonly tokens: TokenService,
  ) {}

  /** Called by the kiosk (DeviceAuthGuard) with the token scanned off a staff member's phone. */
  async recordScan(device: AuthenticatedDevice, branchId: string, token: string) {
    if (device.branchId !== branchId) {
      throw new ForbiddenException("This device is not registered to this branch");
    }

    let payload: { staffId: string; branchId: string };
    try {
      payload = await this.tokens.verifyCheckinToken(token);
    } catch {
      throw new BadRequestException("QR-код истёк или недействителен — попросите сотрудника открыть «Мой QR» заново");
    }
    if (payload.branchId !== device.branchId) {
      throw new ForbiddenException("Этот QR-код относится к другому филиалу");
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.staffId },
      include: { user: { select: { fullName: true } } },
    });
    if (!staff || staff.branchId !== device.branchId) {
      throw new NotFoundException("Staff not found in this branch");
    }

    await this.assertPeriodOpen(device.branchId, new Date());

    const lastEvent = await this.prisma.staffAttendanceEvent.findFirst({
      where: { staffId: staff.id },
      orderBy: { occurredAt: "desc" },
    });

    const now = new Date();
    if (lastEvent && now.getTime() - lastEvent.occurredAt.getTime() < SCAN_DEBOUNCE_MS) {
      return this.toScanResult(staff.user.fullName, lastEvent.type, lastEvent.occurredAt);
    }

    const type: StaffAttendanceEventType = lastEvent?.type === "CHECK_IN" ? "CHECK_OUT" : "CHECK_IN";
    const event = await this.prisma.staffAttendanceEvent.create({
      data: { staffId: staff.id, branchId: device.branchId, type, source: "QR", occurredAt: now, deviceId: device.id },
    });

    await this.audit.record({
      entity: "staff_attendance_event",
      entityId: event.id,
      action: "create",
      newValue: { staffId: staff.id, type },
      actorId: null,
    });

    return this.toScanResult(staff.user.fullName, type, event.occurredAt);
  }

  async whoIsPresent(user: AuthenticatedUser, branchId: string) {
    this.branchScope.assertRoleInBranch(user, STAFF_ATTENDANCE_MANAGE_ROLES, branchId);

    const { start, end } = todayRangeUTC();
    const events = await this.prisma.staffAttendanceEvent.findMany({
      where: { branchId, occurredAt: { gte: start, lt: end } },
      orderBy: { occurredAt: "asc" },
      include: { staff: { include: { user: { select: { id: true, fullName: true } } } } },
    });

    const lastByStaff = new Map<string, (typeof events)[number]>();
    for (const event of events) lastByStaff.set(event.staffId, event);

    return [...lastByStaff.values()]
      .filter((event) => event.type === "CHECK_IN")
      .map((event) => ({
        staffId: event.staffId,
        fullName: event.staff.user.fullName,
        checkedInAt: event.occurredAt,
      }));
  }

  async listForStaff(
    user: AuthenticatedUser,
    branchId: string,
    staffId: string,
    filters: { from?: string; to?: string },
  ) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.branchId !== branchId) throw new NotFoundException("Staff not found in this branch");

    if (staff.userId === user.id) {
      this.branchScope.assertBranchAccess(user, branchId);
    } else {
      this.branchScope.assertRoleInBranch(user, STAFF_ATTENDANCE_MANAGE_ROLES, branchId);
    }

    const events = await this.prisma.staffAttendanceEvent.findMany({
      where: {
        staffId,
        ...(filters.from ? { occurredAt: { gte: new Date(filters.from) } } : {}),
        ...(filters.to ? { occurredAt: { lt: new Date(new Date(filters.to).getTime() + 86_400_000) } } : {}),
      },
      orderBy: { occurredAt: "asc" },
    });

    return { events, dailySummaries: computeDailySummaries(events) };
  }

  /**
   * Deliberately available regardless of whether the period is open or
   * closed — unlike child attendance, a staff member's normal write path
   * (recordScan) isn't human-invocable at all, so managers need a same-day
   * way to fix a missed scan, not just a post-close-period one. The reason
   * is always required (DTO-level), giving every manual entry an audit
   * trail even when the period is still open.
   */
  async correctEvent(user: AuthenticatedUser, branchId: string, dto: CorrectStaffAttendanceDto) {
    this.branchScope.assertRoleInBranch(user, STAFF_ATTENDANCE_MANAGE_ROLES, branchId);

    const staff = await this.prisma.staff.findUnique({ where: { id: dto.staffId } });
    if (!staff || staff.branchId !== branchId) throw new NotFoundException("Staff not found in this branch");

    const event = await this.prisma.staffAttendanceEvent.create({
      data: {
        staffId: dto.staffId,
        branchId,
        type: dto.type,
        source: "MANUAL_CORRECTION",
        occurredAt: new Date(dto.occurredAt),
        correctionReason: dto.reason,
        correctionById: user.id,
      },
    });

    await this.audit.record({
      entity: "staff_attendance_event",
      entityId: event.id,
      action: "create",
      newValue: { staffId: dto.staffId, type: dto.type, correctionReason: dto.reason },
      actorId: user.id,
    });

    return event;
  }

  private toScanResult(staffFullName: string, type: StaffAttendanceEventType, occurredAt: Date) {
    return { staffFullName, type, occurredAt };
  }

  private async assertPeriodOpen(branchId: string, date: Date): Promise<void> {
    const { year, month } = periodOf(date);
    const period = await this.prisma.timesheetPeriod.findUnique({
      where: { branchId_year_month: { branchId, year, month } },
    });
    if (period?.status === "CLOSED") {
      throw new ConflictException("This timesheet period is closed — use a manual correction instead");
    }
  }
}
