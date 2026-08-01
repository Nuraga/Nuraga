import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AttendanceStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { GroupCapacityService } from "../groups/group-capacity.service";
import { CHILD_READ_ROLES } from "../children/child-access.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "PRESENT",
  "ABSENT_SICK",
  "ABSENT_EXCUSED",
  "VACATION",
  "LATE",
  "UNMARKED",
];

function emptyStatusCounts(): Record<AttendanceStatus, number> {
  return Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0])) as Record<
    AttendanceStatus,
    number
  >;
}

// Management-level roll-ups over data other modules already own (groups,
// attendance, waitlist) — read-only, same audience as CHILD_READ_ROLES
// (Owner/Branch Manager/Manager/Accountant; not a raw Teacher grant).
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly capacity: GroupCapacityService,
  ) {}

  async occupancy(user: AuthenticatedUser, branchId: string) {
    this.branchScope.assertRoleInBranch(user, [...CHILD_READ_ROLES], branchId);

    const groups = await this.prisma.group.findMany({
      where: { branchId },
      orderBy: { name: "asc" },
    });

    const rows = await Promise.all(
      groups.map(async (group) => {
        const occupancy = await this.capacity.getOccupancy(group.id);
        return { groupName: group.name, isActive: group.isActive, ...occupancy };
      }),
    );

    const totals = rows.reduce(
      (acc, r) => ({
        enrolled: acc.enrolled + r.enrolled,
        plannedCapacity: acc.plannedCapacity + r.plannedCapacity,
        maxCapacity: acc.maxCapacity + r.maxCapacity,
      }),
      { enrolled: 0, plannedCapacity: 0, maxCapacity: 0 },
    );

    return { branchId, groups: rows, totals };
  }

  async attendanceSummary(
    user: AuthenticatedUser,
    branchId: string,
    year: number,
    month: number,
    groupId?: string,
  ) {
    this.branchScope.assertRoleInBranch(user, [...CHILD_READ_ROLES], branchId);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException("month must be an integer between 1 and 12");
    }

    if (groupId) {
      const group = await this.prisma.group.findUnique({ where: { id: groupId } });
      if (!group || group.branchId !== branchId) {
        throw new NotFoundException("Group not found in this branch");
      }
    }

    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));

    const attendances = await this.prisma.attendance.findMany({
      where: {
        date: { gte: from, lt: to },
        group: { branchId, ...(groupId ? { id: groupId } : {}) },
      },
      select: { childId: true, status: true },
    });

    const childIds = [...new Set(attendances.map((a) => a.childId))];
    const children = await this.prisma.child.findMany({
      where: { id: { in: childIds } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(children.map((c) => [c.id, c.fullName]));

    const byChild = new Map<string, Record<AttendanceStatus, number>>();
    for (const a of attendances) {
      const counts = byChild.get(a.childId) ?? emptyStatusCounts();
      counts[a.status] += 1;
      byChild.set(a.childId, counts);
    }

    const rows = [...byChild.entries()]
      .map(([childId, counts]) => ({
        childId,
        fullName: nameById.get(childId) ?? "—",
        ...counts,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    return { branchId, groupId: groupId ?? null, year, month, children: rows };
  }

  async waitlistSummary(user: AuthenticatedUser, branchId: string) {
    this.branchScope.assertRoleInBranch(user, [...CHILD_READ_ROLES], branchId);

    const groups = await this.prisma.group.findMany({
      where: { branchId },
      orderBy: { name: "asc" },
    });
    const counts = await this.prisma.waitlistEntry.groupBy({
      by: ["groupId"],
      where: { branchId },
      _count: { _all: true },
    });
    const countByGroup = new Map(counts.map((c) => [c.groupId, c._count._all]));

    const rows = groups.map((g) => ({
      groupId: g.id,
      groupName: g.name,
      waitlisted: countByGroup.get(g.id) ?? 0,
    }));

    return { branchId, groups: rows, total: rows.reduce((sum, r) => sum + r.waitlisted, 0) };
  }

  /** Families whose balance (paid − invoiced, ТЗ §11.3 invariant #2) is negative. */
  async debtRegistry(user: AuthenticatedUser, branchId: string) {
    this.branchScope.assertRoleInBranch(user, [...CHILD_READ_ROLES], branchId);

    const families = await this.prisma.family.findMany({
      where: { branchId },
      select: { id: true, name: true },
    });

    const rows = (
      await Promise.all(
        families.map(async (family) => {
          const [paid, invoiced, oldestOpenInvoice] = await Promise.all([
            this.prisma.payment.aggregate({
              where: { familyId: family.id },
              _sum: { amountMinor: true },
            }),
            this.prisma.invoice.aggregate({
              where: { familyId: family.id, status: { in: ["APPROVED", "PARTIALLY_PAID", "PAID"] } },
              _sum: { totalMinor: true },
            }),
            this.prisma.invoice.findFirst({
              where: { familyId: family.id, status: { in: ["APPROVED", "PARTIALLY_PAID"] } },
              orderBy: [{ year: "asc" }, { month: "asc" }],
            }),
          ]);

          const balanceMinor = (paid._sum.amountMinor ?? 0) - (invoiced._sum.totalMinor ?? 0);
          return {
            familyId: family.id,
            familyName: family.name,
            debtMinor: -balanceMinor,
            oldestUnpaidPeriod: oldestOpenInvoice
              ? { year: oldestOpenInvoice.year, month: oldestOpenInvoice.month }
              : null,
          };
        }),
      )
    )
      .filter((r) => r.debtMinor > 0)
      .sort((a, b) => b.debtMinor - a.debtMinor);

    return { branchId, families: rows, totalDebtMinor: rows.reduce((sum, r) => sum + r.debtMinor, 0) };
  }
}
