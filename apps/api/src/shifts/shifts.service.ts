import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Role } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateShiftDto } from "./dto/create-shift.dto";

// ТЗ §8 M6: managing the shift schedule is a заведующий responsibility, not
// a sales one — MANAGER is deliberately excluded here, mirroring the
// staff-tasks-kanban lesson (don't default to the broadest existing role
// list just because it's the nearest *_ROLES constant).
export const SHIFT_WRITE_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER"];

function toDateOnly(value: string): Date {
  return new Date(value.slice(0, 10));
}

export interface ShiftView {
  id: string;
  staffId: string;
  staffFullName: string;
  position: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string | null;
}

interface StoredShift {
  id: string;
  staffId: string;
  date: Date;
  startTime: string;
  endTime: string;
  note: string | null;
  staff: { position: string; user: { fullName: string } };
}

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  /** Not secret — any staff member with branch access can see who's on shift when, including a TEACHER. */
  async list(user: AuthenticatedUser, branchId: string, from: string, to: string): Promise<ShiftView[]> {
    this.branchScope.assertBranchAccess(user, branchId);

    const shifts = await this.prisma.shift.findMany({
      where: { branchId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
      include: { staff: { include: { user: { select: { fullName: true } } } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return shifts.map((s) => this.toView(s));
  }

  async create(user: AuthenticatedUser, branchId: string, dto: CreateShiftDto): Promise<ShiftView> {
    this.branchScope.assertRoleInBranch(user, SHIFT_WRITE_ROLES, branchId);

    if (dto.endTime <= dto.startTime) {
      throw new BadRequestException("endTime must be after startTime");
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: dto.staffId },
      include: { user: { select: { fullName: true } } },
    });
    if (!staff || staff.branchId !== branchId) {
      throw new NotFoundException("Staff not found in this branch");
    }

    const shift = await this.prisma.shift.create({
      data: {
        branchId,
        staffId: dto.staffId,
        date: toDateOnly(dto.date),
        startTime: dto.startTime,
        endTime: dto.endTime,
        note: dto.note,
        createdById: user.id,
      },
    });

    await this.audit.record({
      entity: "shift",
      entityId: shift.id,
      action: "create",
      newValue: { staffId: shift.staffId, date: dto.date, startTime: dto.startTime, endTime: dto.endTime },
      actorId: user.id,
    });

    return this.toView({ ...shift, staff });
  }

  async remove(user: AuthenticatedUser, branchId: string, id: string): Promise<void> {
    this.branchScope.assertRoleInBranch(user, SHIFT_WRITE_ROLES, branchId);

    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift || shift.branchId !== branchId) {
      throw new NotFoundException("Shift not found");
    }

    await this.prisma.shift.delete({ where: { id } });
    await this.audit.record({
      entity: "shift",
      entityId: id,
      action: "delete",
      oldValue: { staffId: shift.staffId, date: shift.date },
      actorId: user.id,
    });
  }

  private toView(shift: StoredShift): ShiftView {
    return {
      id: shift.id,
      staffId: shift.staffId,
      staffFullName: shift.staff.user.fullName,
      position: shift.staff.position,
      date: shift.date.toISOString().slice(0, 10),
      startTime: shift.startTime,
      endTime: shift.endTime,
      note: shift.note,
    };
  }
}
