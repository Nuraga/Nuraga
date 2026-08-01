import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { InvoicingService } from "./invoicing.service";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";

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

describe("InvoicingService", () => {
  const branchId = "b1";
  const accountant = user({ grants: [{ branchId, role: "ACCOUNTANT" }] });
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });

  const tariff = {
    id: "t1",
    name: "Полный день",
    baseAmountMinor: 300_00,
    recalcRule: "NONE",
    recalcThresholdDays: null,
  };
  const contract = { id: "ct1", familyId: "f1", childId: "c1", tariffId: "t1", tariff };

  let prisma: any;
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: InvoicingService;

  beforeEach(() => {
    prisma = {
      timesheetPeriod: {
        findUnique: jest.fn(() => Promise.resolve({ status: "CLOSED" })),
      },
      contract: {
        findMany: jest.fn(() => Promise.resolve([contract])),
      },
      invoice: {
        findUnique: jest.fn(() => Promise.resolve(null)),
        create: jest.fn((args: any) => Promise.resolve({ id: "inv1", ...args.data })),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        aggregate: jest.fn(() => Promise.resolve({ _sum: { totalMinor: 0 } })),
      },
      invoiceLine: {
        deleteMany: jest.fn(() => Promise.resolve()),
        create: jest.fn((args: any) => Promise.resolve({ id: "line1", ...args.data })),
      },
      attendance: {
        count: jest.fn(() => Promise.resolve(0)),
      },
      serviceEnrollment: {
        findMany: jest.fn(() => Promise.resolve([])),
      },
      discount: {
        findMany: jest.fn(() => Promise.resolve([])),
      },
      payment: {
        aggregate: jest.fn(() => Promise.resolve({ _sum: { amountMinor: 0 } })),
      },
      family: {
        findUnique: jest.fn(() => Promise.resolve({ id: "f1", branchId })),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new InvoicingService(prisma, branchScope, audit as any);
  });

  const genDto = { year: 2026, month: 9 };

  describe("generateForBranch", () => {
    it("rejects a role without invoice-write rights", async () => {
      await expect(service.generateForBranch(manager, branchId, genDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("rejects when the timesheet period isn't closed", async () => {
      prisma.timesheetPeriod.findUnique.mockResolvedValue({ status: "OPEN" });
      await expect(service.generateForBranch(accountant, branchId, genDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("generates a draft with just the base tariff line when nothing else applies", async () => {
      const result = await service.generateForBranch(accountant, branchId, genDto);
      expect(result.results[0]).toMatchObject({ familyId: "f1", status: "draft_generated", totalMinor: 300_00 });
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalMinor: 300_00,
            lines: { create: expect.arrayContaining([expect.objectContaining({ type: "TARIFF" })]) },
          }),
        }),
      );
    });

    it("adds a RECALC line once sick days reach the threshold", async () => {
      prisma.contract.findMany.mockResolvedValue([
        { ...contract, tariff: { ...tariff, recalcRule: "FULL_DAY_WITH_THRESHOLD", recalcThresholdDays: 3 } },
      ]);
      prisma.attendance.count.mockResolvedValue(5);

      const result = await service.generateForBranch(accountant, branchId, genDto);
      const dailyRate = Math.round(300_00 / 30);
      expect(result.results[0].totalMinor).toBe(300_00 - dailyRate * 5);
    });

    it("omits the RECALC line when sick days are below the threshold", async () => {
      prisma.contract.findMany.mockResolvedValue([
        { ...contract, tariff: { ...tariff, recalcRule: "FULL_DAY_WITH_THRESHOLD", recalcThresholdDays: 3 } },
      ]);
      prisma.attendance.count.mockResolvedValue(1);

      const result = await service.generateForBranch(accountant, branchId, genDto);
      expect(result.results[0].totalMinor).toBe(300_00);
    });

    it("adds a SERVICE line for an active enrollment", async () => {
      prisma.serviceEnrollment.findMany.mockResolvedValue([
        { serviceId: "sv1", service: { id: "sv1", name: "Английский", priceMinor: 50_00 } },
      ]);
      const result = await service.generateForBranch(accountant, branchId, genDto);
      expect(result.results[0].totalMinor).toBe(300_00 + 50_00);
    });

    it("applies a PERCENT discount against the positive-line subtotal", async () => {
      prisma.discount.findMany.mockResolvedValue([
        { id: "d1", childId: null, basis: "SECOND_CHILD", kind: "PERCENT", value: 10 },
      ]);
      const result = await service.generateForBranch(accountant, branchId, genDto);
      expect(result.results[0].totalMinor).toBe(300_00 - Math.round(300_00 * 0.1));
    });

    it("offsets the invoice with any unallocated advance credit", async () => {
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amountMinor: 500_00 } });
      const result = await service.generateForBranch(accountant, branchId, genDto);
      // advance (500) exceeds the tariff line (300), so it's capped at the subtotal
      expect(result.results[0].totalMinor).toBe(0);
    });

    it("skips a family whose invoice for this period is already approved", async () => {
      prisma.invoice.findUnique.mockResolvedValue({ id: "inv1", status: "APPROVED" });
      const result = await service.generateForBranch(accountant, branchId, genDto);
      expect(result.results[0]).toMatchObject({ familyId: "f1", status: "skipped_already_finalized" });
      expect(prisma.invoice.update).not.toHaveBeenCalled();
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });

    it("regenerates an existing DRAFT invoice by replacing its lines", async () => {
      prisma.invoice.findUnique.mockResolvedValue({ id: "inv1", status: "DRAFT" });
      await service.generateForBranch(accountant, branchId, genDto);
      expect(prisma.invoiceLine.deleteMany).toHaveBeenCalledWith({ where: { invoiceId: "inv1" } });
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "inv1" } }),
      );
    });
  });

  describe("addAdjustment", () => {
    it("rejects adjusting a non-draft invoice", async () => {
      prisma.invoice.findUnique.mockResolvedValue({ id: "inv1", branchId, status: "APPROVED", totalMinor: 300_00 });
      await expect(
        service.addAdjustment(accountant, branchId, "inv1", {
          description: "Скидка вручную",
          amountMinor: -1000,
          comment: "тест",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("adds a line and updates the invoice total", async () => {
      prisma.invoice.findUnique.mockResolvedValue({ id: "inv1", branchId, status: "DRAFT", totalMinor: 300_00 });
      const result = await service.addAdjustment(accountant, branchId, "inv1", {
        description: "Ручная корректировка",
        amountMinor: -1000,
        comment: "Скидка за жалобу",
      });
      expect(result.totalMinor).toBe(300_00 - 1000);
      expect(prisma.invoiceLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "MANUAL_ADJUSTMENT", amountMinor: -1000 }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ newValue: expect.objectContaining({ comment: "Скидка за жалобу" }) }),
      );
    });
  });

  describe("approve", () => {
    it("rejects approving a non-draft invoice", async () => {
      prisma.invoice.findUnique.mockResolvedValue({ id: "inv1", branchId, status: "APPROVED" });
      await expect(service.approve(accountant, branchId, "inv1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("locks a draft invoice as APPROVED", async () => {
      prisma.invoice.findUnique.mockResolvedValue({ id: "inv1", branchId, status: "DRAFT" });
      const result = await service.approve(accountant, branchId, "inv1");
      expect(result).toMatchObject({ status: "APPROVED", approvedById: "u1" });
    });
  });
});
