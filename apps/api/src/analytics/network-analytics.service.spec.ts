import { ForbiddenException } from "@nestjs/common";
import { NetworkAnalyticsService } from "./network-analytics.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "u1",
    email: "u1@example.com",
    phone: null,
    fullName: "Test",
    grants: [],
    hasNetworkAccess: false,
    ...overrides,
  };
}

describe("NetworkAnalyticsService", () => {
  const owner = user({ hasNetworkAccess: true, grants: [{ branchId: "b1", role: "OWNER" }] });
  const branchManager = user({ grants: [{ branchId: "b1", role: "BRANCH_MANAGER" }] });

  let prisma: any;
  let service: NetworkAnalyticsService;

  beforeEach(() => {
    prisma = {
      branch: {
        findMany: jest.fn(() =>
          Promise.resolve([
            { id: "b1", name: "Айналайын" },
            { id: "b2", name: "Балафун2" },
          ]),
        ),
      },
      child: {
        count: jest.fn(() => Promise.resolve(0)),
      },
      group: {
        findMany: jest.fn(() => Promise.resolve([])),
      },
      invoice: {
        aggregate: jest.fn(() => Promise.resolve({ _sum: { totalMinor: null } })),
      },
      payment: {
        aggregate: jest.fn(() => Promise.resolve({ _sum: { amountMinor: null } })),
      },
      lead: {
        count: jest.fn(() => Promise.resolve(0)),
      },
      attendance: {
        count: jest.fn(() => Promise.resolve(0)),
      },
    };
    service = new NetworkAnalyticsService(prisma);
  });

  it("rejects a branch-scoped role — this is the owner-only network view", async () => {
    await expect(service.dashboard(branchManager)).rejects.toThrow(ForbiddenException);
  });

  it("sums per-branch occupancy into network totals", async () => {
    prisma.child.count.mockImplementation(({ where }: any) =>
      Promise.resolve(where.family?.branchId === "b1" ? 8 : 5),
    );
    prisma.group.findMany.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where.branchId === "b1"
          ? [{ plannedCapacity: 10, maxCapacity: 12 }]
          : [{ plannedCapacity: 15, maxCapacity: 18 }],
      ),
    );

    const result = await service.dashboard(owner);

    expect(result.occupancy).toEqual([
      { branchId: "b1", branchName: "Айналайын", enrolled: 8, plannedCapacity: 10, maxCapacity: 12 },
      { branchId: "b2", branchName: "Балафун2", enrolled: 5, plannedCapacity: 15, maxCapacity: 18 },
    ]);
    expect(result.occupancyTotals).toEqual({ enrolled: 13, plannedCapacity: 25, maxCapacity: 30 });
  });

  it("returns exactly 12 months, oldest first, ending on the current month", async () => {
    const result = await service.dashboard(owner);
    expect(result.monthly).toHaveLength(12);

    const now = new Date();
    const last = result.monthly[result.monthly.length - 1];
    expect(last).toMatchObject({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 });
  });

  it("computes conversion rate and null attendance rate when a month has no data", async () => {
    const result = await service.dashboard(owner);
    const anyMonth = result.monthly[0];
    expect(anyMonth.conversionRate).toBe(0);
    expect(anyMonth.avgAttendanceRate).toBeNull();
    expect(anyMonth.invoicedMinor).toBe(0);
    expect(anyMonth.paidMinor).toBe(0);
  });

  it("computes non-zero conversion and attendance rates from aggregated data", async () => {
    prisma.lead.count.mockImplementation(({ where }: any) =>
      Promise.resolve(where.stage === "ENROLLED" ? 2 : 8),
    );
    prisma.attendance.count.mockImplementation(({ where }: any) =>
      Promise.resolve(where.status === "PRESENT" ? 90 : 100),
    );

    const result = await service.dashboard(owner);

    for (const m of result.monthly) {
      expect(m.conversionRate).toBeCloseTo(0.25);
      expect(m.avgAttendanceRate).toBeCloseTo(0.9);
    }
  });
});
