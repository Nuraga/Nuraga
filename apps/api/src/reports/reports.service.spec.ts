import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { ReportsService } from "./reports.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import type { GroupCapacityService } from "../groups/group-capacity.service";

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

describe("ReportsService", () => {
  const branchId = "b1";
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });
  const teacher = user({ grants: [{ branchId, role: "TEACHER" }] });

  let prisma: any;
  let capacity: { getOccupancy: jest.Mock };
  let branchScope: BranchScopeService;
  let service: ReportsService;

  beforeEach(() => {
    prisma = {
      group: {
        findMany: jest.fn(() =>
          Promise.resolve([
            { id: "g1", name: "Младшая", isActive: true },
            { id: "g2", name: "Старшая", isActive: true },
          ]),
        ),
        findUnique: jest.fn((args: any) => Promise.resolve({ id: args.where.id, branchId })),
      },
      attendance: { findMany: jest.fn(() => Promise.resolve([])) },
      child: { findMany: jest.fn(() => Promise.resolve([])) },
      waitlistEntry: { groupBy: jest.fn(() => Promise.resolve([])) },
      family: { findMany: jest.fn(() => Promise.resolve([])) },
      payment: { aggregate: jest.fn(() => Promise.resolve({ _sum: { amountMinor: 0 } })) },
      invoice: {
        aggregate: jest.fn(() => Promise.resolve({ _sum: { totalMinor: 0 } })),
        findFirst: jest.fn(() => Promise.resolve(null)),
      },
    };
    capacity = {
      getOccupancy: jest.fn((groupId: string) =>
        Promise.resolve({
          groupId,
          enrolled: groupId === "g1" ? 8 : 5,
          plannedCapacity: 10,
          maxCapacity: 12,
          isOverPlanned: false,
          isOverMax: false,
        }),
      ),
    };
    branchScope = new BranchScopeService();
    service = new ReportsService(prisma, branchScope, capacity as unknown as GroupCapacityService);
  });

  describe("occupancy", () => {
    it("rejects a role without child-read access", async () => {
      await expect(service.occupancy(teacher, branchId)).rejects.toThrow(ForbiddenException);
    });

    it("aggregates per-group occupancy into totals", async () => {
      const report = await service.occupancy(manager, branchId);

      expect(report.groups).toHaveLength(2);
      expect(report.totals).toEqual({ enrolled: 13, plannedCapacity: 20, maxCapacity: 24 });
    });
  });

  describe("attendanceSummary", () => {
    it("rejects an out-of-range month", async () => {
      await expect(service.attendanceSummary(manager, branchId, 2026, 13)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("404s when groupId doesn't belong to the branch", async () => {
      prisma.group.findUnique.mockResolvedValue({ id: "g1", branchId: "other-branch" });
      await expect(
        service.attendanceSummary(manager, branchId, 2026, 7, "g1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("aggregates attendance status counts per child, sorted by name", async () => {
      prisma.attendance.findMany.mockResolvedValue([
        { childId: "c1", status: "PRESENT" },
        { childId: "c1", status: "PRESENT" },
        { childId: "c1", status: "ABSENT_SICK" },
        { childId: "c2", status: "PRESENT" },
      ]);
      prisma.child.findMany.mockResolvedValue([
        { id: "c1", fullName: "Борисов Борис" },
        { id: "c2", fullName: "Антонов Антон" },
      ]);

      const report = await service.attendanceSummary(manager, branchId, 2026, 7);

      expect(report.children).toEqual([
        expect.objectContaining({ childId: "c2", fullName: "Антонов Антон", PRESENT: 1 }),
        expect.objectContaining({ childId: "c1", fullName: "Борисов Борис", PRESENT: 2, ABSENT_SICK: 1 }),
      ]);
    });
  });

  describe("waitlistSummary", () => {
    it("maps groupBy counts onto every group in the branch, defaulting to zero", async () => {
      prisma.waitlistEntry.groupBy.mockResolvedValue([{ groupId: "g1", _count: { _all: 3 } }]);

      const report = await service.waitlistSummary(manager, branchId);

      expect(report.groups).toEqual([
        { groupId: "g1", groupName: "Младшая", waitlisted: 3 },
        { groupId: "g2", groupName: "Старшая", waitlisted: 0 },
      ]);
      expect(report.total).toBe(3);
    });
  });

  describe("debtRegistry", () => {
    it("lists only families with a negative balance, sorted by debt descending", async () => {
      prisma.family.findMany.mockResolvedValue([
        { id: "f1", name: "Ивановы" },
        { id: "f2", name: "Петровы" },
        { id: "f3", name: "Сидоровы" },
      ]);
      prisma.payment.aggregate.mockImplementation(({ where }: any) => {
        const sums: Record<string, number> = { f1: 100_00, f2: 500_00, f3: 300_00 };
        return Promise.resolve({ _sum: { amountMinor: sums[where.familyId] } });
      });
      prisma.invoice.aggregate.mockImplementation(({ where }: any) => {
        const sums: Record<string, number> = { f1: 400_00, f2: 500_00, f3: 250_00 };
        return Promise.resolve({ _sum: { totalMinor: sums[where.familyId] } });
      });

      const report = await service.debtRegistry(manager, branchId);

      expect(report.families).toEqual([
        expect.objectContaining({ familyId: "f1", debtMinor: 300_00 }),
      ]);
      expect(report.totalDebtMinor).toBe(300_00);
    });
  });
});
