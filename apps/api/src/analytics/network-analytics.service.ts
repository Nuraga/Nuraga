import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

const INVOICED_STATUSES = ["APPROVED", "PARTIALLY_PAID", "PAID"] as const;
const TREND_MONTHS = 12;

export interface BranchOccupancyRow {
  branchId: string;
  branchName: string;
  enrolled: number;
  plannedCapacity: number;
  maxCapacity: number;
}

export interface NetworkMonthRow {
  year: number;
  month: number;
  enrolledCount: number;
  dischargedCount: number;
  invoicedMinor: number;
  paidMinor: number;
  newLeads: number;
  enrolledLeads: number;
  conversionRate: number;
  avgAttendanceRate: number | null;
}

export interface NetworkDashboard {
  occupancy: BranchOccupancyRow[];
  occupancyTotals: { enrolled: number; plannedCapacity: number; maxCapacity: number };
  monthly: NetworkMonthRow[];
}

/**
 * ТЗ §9.1 "Дашборд владельца сети" — the Этап 5 flagship analytics view.
 * Network-wide by definition (no branchId param) — gated to
 * AuthenticatedUser.hasNetworkAccess (OWNER/SUPERADMIN), matching §2.2's
 * "Отчёты по сети: Владелец — П" row.
 *
 * Occupancy is a current snapshot broken down per branch. The 12-month
 * trend covers revenue/child-movement/funnel/attendance — the sub-metrics
 * that have real per-month source data. A 12-month *occupancy* trend
 * would need reconstructing capacity-over-time from ChildHistoryEntry;
 * out of scope for this pass. Ad-spend / cost-per-lead (ТЗ §3.5) needs a
 * manual ad-spend entry UI that doesn't exist yet either — also out of
 * scope; the funnel columns here stop at lead counts and conversion.
 */
@Injectable()
export class NetworkAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: AuthenticatedUser): Promise<NetworkDashboard> {
    if (!user.hasNetworkAccess) {
      throw new ForbiddenException("Network-wide analytics is limited to the network owner");
    }

    const [occupancy, monthly] = await Promise.all([this.branchOccupancy(), this.monthlyTrend()]);

    const occupancyTotals = occupancy.reduce(
      (acc, b) => ({
        enrolled: acc.enrolled + b.enrolled,
        plannedCapacity: acc.plannedCapacity + b.plannedCapacity,
        maxCapacity: acc.maxCapacity + b.maxCapacity,
      }),
      { enrolled: 0, plannedCapacity: 0, maxCapacity: 0 },
    );

    return { occupancy, occupancyTotals, monthly };
  }

  private async branchOccupancy(): Promise<BranchOccupancyRow[]> {
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    return Promise.all(
      branches.map(async (branch) => {
        const [enrolled, groups] = await Promise.all([
          this.prisma.child.count({ where: { status: "ENROLLED", family: { branchId: branch.id } } }),
          this.prisma.group.findMany({
            where: { branchId: branch.id },
            select: { plannedCapacity: true, maxCapacity: true },
          }),
        ]);
        return {
          branchId: branch.id,
          branchName: branch.name,
          enrolled,
          plannedCapacity: groups.reduce((sum, g) => sum + g.plannedCapacity, 0),
          maxCapacity: groups.reduce((sum, g) => sum + g.maxCapacity, 0),
        };
      }),
    );
  }

  private async monthlyTrend(): Promise<NetworkMonthRow[]> {
    const now = new Date();
    const months = Array.from({ length: TREND_MONTHS }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (TREND_MONTHS - 1 - i), 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
    });

    return Promise.all(months.map(({ year, month }) => this.monthRow(year, month)));
  }

  private async monthRow(year: number, month: number): Promise<NetworkMonthRow> {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));

    const [enrolledCount, dischargedCount, invoiced, paid, newLeads, enrolledLeads, presentCount, markedCount] =
      await Promise.all([
        this.prisma.child.count({ where: { enrolledAt: { gte: from, lt: to } } }),
        this.prisma.child.count({ where: { discharedAt: { gte: from, lt: to } } }),
        this.prisma.invoice.aggregate({
          where: { year, month, status: { in: [...INVOICED_STATUSES] } },
          _sum: { totalMinor: true },
        }),
        this.prisma.payment.aggregate({
          where: { paidAt: { gte: from, lt: to } },
          _sum: { amountMinor: true },
        }),
        this.prisma.lead.count({ where: { createdAt: { gte: from, lt: to } } }),
        this.prisma.lead.count({ where: { createdAt: { gte: from, lt: to }, stage: "ENROLLED" } }),
        this.prisma.attendance.count({ where: { date: { gte: from, lt: to }, status: "PRESENT" } }),
        this.prisma.attendance.count({ where: { date: { gte: from, lt: to } } }),
      ]);

    return {
      year,
      month,
      enrolledCount,
      dischargedCount,
      invoicedMinor: invoiced._sum.totalMinor ?? 0,
      paidMinor: paid._sum.amountMinor ?? 0,
      newLeads,
      enrolledLeads,
      conversionRate: newLeads === 0 ? 0 : enrolledLeads / newLeads,
      avgAttendanceRate: markedCount === 0 ? null : presentCount / markedCount,
    };
  }
}
