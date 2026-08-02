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
      child: { findMany: jest.fn(() => Promise.resolve([])), groupBy: jest.fn(() => Promise.resolve([])) },
      waitlistEntry: { groupBy: jest.fn(() => Promise.resolve([])) },
      family: { findMany: jest.fn(() => Promise.resolve([])) },
      payment: {
        aggregate: jest.fn(() => Promise.resolve({ _sum: { amountMinor: 0 } })),
        findMany: jest.fn(() => Promise.resolve([])),
      },
      invoice: {
        aggregate: jest.fn(() => Promise.resolve({ _sum: { totalMinor: 0 } })),
        findFirst: jest.fn(() => Promise.resolve(null)),
        findMany: jest.fn(() => Promise.resolve([])),
      },
      discount: { findMany: jest.fn(() => Promise.resolve([])) },
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

  describe("invoicesRegistry", () => {
    it("rejects an out-of-range month", async () => {
      await expect(service.invoicesRegistry(manager, branchId, 2026, 13)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("sums invoice totals for the period", async () => {
      prisma.invoice.findMany.mockResolvedValue([
        { id: "i1", familyId: "f1", family: { name: "Ивановы" }, status: "APPROVED", totalMinor: 300_00 },
        { id: "i2", familyId: "f2", family: { name: "Петровы" }, status: "DRAFT", totalMinor: 200_00 },
      ]);

      const report = await service.invoicesRegistry(manager, branchId, 2026, 8);

      expect(report.invoices).toHaveLength(2);
      expect(report.totalMinor).toBe(500_00);
    });
  });

  describe("paymentsRegistry", () => {
    it("rejects an out-of-range month", async () => {
      await expect(service.paymentsRegistry(manager, branchId, 2026, 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("sums payments and groups totals by method", async () => {
      prisma.payment.findMany.mockResolvedValue([
        { id: "p1", familyId: "f1", family: { name: "Ивановы" }, amountMinor: 300_00, method: "CASH", paidAt: new Date() },
        { id: "p2", familyId: "f2", family: { name: "Петровы" }, amountMinor: 200_00, method: "CASH", paidAt: new Date() },
        { id: "p3", familyId: "f3", family: { name: "Сидоровы" }, amountMinor: 100_00, method: "BANK_TRANSFER", paidAt: new Date() },
      ]);

      const report = await service.paymentsRegistry(manager, branchId, 2026, 8);

      expect(report.totalMinor).toBe(600_00);
      expect(report.byMethod).toEqual({ CASH: 500_00, BANK_TRANSFER: 100_00 });
    });
  });

  describe("discountsRegistry", () => {
    it("defaults to active discounts only and resolves family name via child when needed", async () => {
      prisma.discount.findMany.mockResolvedValue([
        {
          id: "d1",
          basis: "SECOND_CHILD",
          kind: "PERCENT",
          value: 10,
          reason: null,
          validFrom: new Date(),
          validTo: null,
          isActive: true,
          family: { name: "Ивановы" },
          child: null,
        },
        {
          id: "d2",
          basis: "SOCIAL",
          kind: "FIXED_AMOUNT",
          value: 5000,
          reason: "льгота",
          validFrom: new Date(),
          validTo: null,
          isActive: true,
          family: null,
          child: { fullName: "Петров Пётр", family: { name: "Петровы" } },
        },
      ]);

      const report = await service.discountsRegistry(manager, branchId);

      expect(report.total).toBe(2);
      expect(report.discounts[1]).toEqual(
        expect.objectContaining({ familyName: "Петровы", childName: "Петров Пётр" }),
      );
      expect(prisma.discount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
    });
  });

  describe("portionsToday", () => {
    it("rejects a Teacher — same audience as the other reports", async () => {
      await expect(service.portionsToday(teacher, branchId, "2026-08-03")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("counts enrolled children minus known absences for that date, per group", async () => {
      prisma.child.groupBy.mockResolvedValue([
        { groupId: "g1", _count: { _all: 8 } },
        { groupId: "g2", _count: { _all: 5 } },
      ]);
      prisma.attendance.findMany.mockResolvedValue([
        { groupId: "g1" },
        { groupId: "g1" },
      ]);

      const report = await service.portionsToday(manager, branchId, "2026-08-03");

      expect(report.groups).toEqual([
        { groupId: "g1", groupName: "Младшая", portionsNeeded: 6 },
        { groupId: "g2", groupName: "Старшая", portionsNeeded: 5 },
      ]);
      expect(report.total).toBe(11);
    });

    it("still counts enrolled children when no Attendance rows exist yet for that date", async () => {
      prisma.child.groupBy.mockResolvedValue([{ groupId: "g1", _count: { _all: 8 } }]);
      prisma.attendance.findMany.mockResolvedValue([]);

      const report = await service.portionsToday(manager, branchId, "2026-08-03");

      expect(report.groups.find((g: any) => g.groupId === "g1")?.portionsNeeded).toBe(8);
    });
  });
});
