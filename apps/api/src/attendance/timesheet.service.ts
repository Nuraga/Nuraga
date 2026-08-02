import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Role } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CorrectAttendanceDto } from "./dto/correct-attendance.dto";

// Closing a period is the payroll cutover, so it's the same set of roles
// that can later amend a closed period via correction (TRD 11.3, invariant
// #4: attendance is immutable once its period is closed, except through a
// reasoned, audited correction).
export const TIMESHEET_CLOSE_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "ACCOUNTANT"];

@Injectable()
export class TimesheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async listPeriods(user: AuthenticatedUser, branchId: string) {
    this.branchScope.assertBranchAccess(user, branchId);
    return this.prisma.timesheetPeriod.findMany({
      where: { branchId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
  }

  async closePeriod(user: AuthenticatedUser, branchId: string, year: number, month: number) {
    this.branchScope.assertRoleInBranch(user, TIMESHEET_CLOSE_ROLES, branchId);

    const existing = await this.prisma.timesheetPeriod.findUnique({
      where: { branchId_year_month: { branchId, year, month } },
    });
    if (existing?.status === "CLOSED") {
      throw new ConflictException("This timesheet period is already closed");
    }

    const period = await this.prisma.timesheetPeriod.upsert({
      where: { branchId_year_month: { branchId, year, month } },
      create: { branchId, year, month, status: "CLOSED", closedById: user.id, closedAt: new Date() },
      update: { status: "CLOSED", closedById: user.id, closedAt: new Date() },
    });

    await this.audit.record({
      entity: "timesheet_period",
      entityId: period.id,
      action: "update",
      newValue: { event: "close", year, month },
      actorId: user.id,
    });

    return period;
  }

  /** Amends attendance already locked by a closed period, per invariant #4. */
  async correctAttendance(
    user: AuthenticatedUser,
    branchId: string,
    attendanceId: string,
    dto: CorrectAttendanceDto,
  ) {
    this.branchScope.assertRoleInBranch(user, TIMESHEET_CLOSE_ROLES, branchId);

    const attendance = await this.prisma.attendance.findUnique({ where: { id: attendanceId } });
    if (!attendance) throw new NotFoundException("Attendance record not found");

    const group = await this.prisma.group.findUnique({ where: { id: attendance.groupId } });
    if (!group || group.branchId !== branchId) {
      throw new NotFoundException("Attendance record not found");
    }

    const year = attendance.date.getUTCFullYear();
    const month = attendance.date.getUTCMonth() + 1;
    const period = await this.prisma.timesheetPeriod.findUnique({
      where: { branchId_year_month: { branchId, year, month } },
    });
    if (period?.status !== "CLOSED") {
      throw new BadRequestException(
        "This attendance record's period is still open — edit it directly instead of correcting it",
      );
    }

    const oldValue = { ...attendance };
    const updated = await this.prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        status: dto.status,
        checkInAt: dto.checkInAt ? new Date(dto.checkInAt) : undefined,
        checkOutAt: dto.checkOutAt ? new Date(dto.checkOutAt) : undefined,
        pickedUpById: dto.pickedUpById,
        pickedUpByType: dto.pickedUpByType,
      },
    });

    await this.prisma.timesheetCorrection.create({
      data: {
        periodId: period.id,
        attendanceId,
        reason: dto.reason,
        actorUserId: user.id,
      },
    });

    await this.audit.record({
      entity: "attendance",
      entityId: attendanceId,
      action: "update",
      oldValue,
      newValue: { ...updated, correctionReason: dto.reason },
      actorId: user.id,
    });

    return updated;
  }
}
