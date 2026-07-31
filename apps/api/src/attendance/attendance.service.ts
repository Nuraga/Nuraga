import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { AttendanceAccessService } from "./attendance-access.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";

// Truncates to the calendar date only — Attendance.date is @db.Date, and the
// [childId, date] uniqueness must key off the date alone, not a timestamp.
function toDateOnly(value: string): Date {
  return new Date(value.slice(0, 10));
}

function periodOf(date: Date): { year: number; month: number } {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AttendanceAccessService,
    private readonly audit: AuditService,
  ) {}

  async mark(user: AuthenticatedUser, branchId: string, childId: string, dto: MarkAttendanceDto) {
    const child = await this.getEnrolledChildInBranch(branchId, childId);
    await this.access.assertMarkAccess(user, branchId, child.groupId!);

    const date = toDateOnly(dto.date);
    await this.assertPeriodOpen(branchId, date);

    const data = {
      status: dto.status,
      checkInAt: dto.checkInAt ? new Date(dto.checkInAt) : undefined,
      checkOutAt: dto.checkOutAt ? new Date(dto.checkOutAt) : undefined,
      pickedUpById: dto.pickedUpById,
      pickedUpByType: dto.pickedUpByType,
      markedById: user.id,
    };

    const attendance = await this.prisma.attendance.upsert({
      where: { childId_date: { childId, date } },
      create: { childId, groupId: child.groupId!, date, ...data },
      update: data,
    });

    await this.audit.record({
      entity: "attendance",
      entityId: attendance.id,
      action: "update",
      newValue: { childId, date: dto.date, status: dto.status },
      actorId: user.id,
    });

    return attendance;
  }

  /** Roster for a group/date: every enrolled child, with their attendance row if marked. */
  async getGroupRoster(user: AuthenticatedUser, branchId: string, groupId: string, dateStr: string) {
    await this.access.assertReadAccess(user, branchId, groupId);
    await this.getGroupInBranch(branchId, groupId);

    const date = toDateOnly(dateStr);
    const [children, attendances] = await Promise.all([
      this.prisma.child.findMany({ where: { groupId, status: "ENROLLED" } }),
      this.prisma.attendance.findMany({ where: { groupId, date } }),
    ]);

    const byChildId = new Map(attendances.map((a) => [a.childId, a]));
    return children.map((child) => ({
      child,
      attendance: byChildId.get(child.id) ?? null,
    }));
  }

  async getChildHistory(
    user: AuthenticatedUser,
    branchId: string,
    childId: string,
    from?: string,
    to?: string,
  ) {
    const child = await this.getChildInBranch(branchId, childId);
    if (child.groupId) {
      await this.access.assertReadAccess(user, branchId, child.groupId);
    }

    return this.prisma.attendance.findMany({
      where: {
        childId,
        date: {
          gte: from ? toDateOnly(from) : undefined,
          lte: to ? toDateOnly(to) : undefined,
        },
      },
      orderBy: { date: "asc" },
    });
  }

  private async assertPeriodOpen(branchId: string, date: Date): Promise<void> {
    const { year, month } = periodOf(date);
    const period = await this.prisma.timesheetPeriod.findUnique({
      where: { branchId_year_month: { branchId, year, month } },
    });
    if (period?.status === "CLOSED") {
      throw new ConflictException(
        "Timesheet period is closed — use a correction to edit attendance for this date",
      );
    }
  }

  private async getChildInBranch(branchId: string, childId: string) {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child) throw new NotFoundException("Child not found");

    const family = await this.prisma.family.findUnique({ where: { id: child.familyId } });
    if (!family || family.branchId !== branchId) {
      throw new NotFoundException("Child not found");
    }
    return child;
  }

  private async getEnrolledChildInBranch(branchId: string, childId: string) {
    const child = await this.getChildInBranch(branchId, childId);
    if (child.status !== "ENROLLED" || !child.groupId) {
      throw new ConflictException("Attendance can only be marked for an enrolled child");
    }
    return child;
  }

  private async getGroupInBranch(branchId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.branchId !== branchId) {
      throw new NotFoundException("Group not found in this branch");
    }
    return group;
  }
}
