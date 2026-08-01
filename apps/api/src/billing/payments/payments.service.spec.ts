import { ForbiddenException } from "@nestjs/common";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { PaymentsService } from "./payments.service";
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

describe("PaymentsService", () => {
  const branchId = "b1";
  const familyId = "f1";
  const accountant = user({ grants: [{ branchId, role: "ACCOUNTANT" }] });
  const teacher = user({ grants: [{ branchId, role: "TEACHER" }] });

  let prisma: any;
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: PaymentsService;

  beforeEach(() => {
    prisma = {
      payment: {
        create: jest.fn((args: any) => Promise.resolve({ id: "pay1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        aggregate: jest.fn(() => Promise.resolve({ _sum: { amountMinor: 0 } })),
      },
      invoice: {
        findMany: jest.fn(() => Promise.resolve([])),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
        aggregate: jest.fn(() => Promise.resolve({ _sum: { totalMinor: 0 } })),
      },
      paymentAllocation: {
        create: jest.fn((args: any) => Promise.resolve({ id: "alloc1", ...args.data })),
      },
      family: { findUnique: jest.fn(() => Promise.resolve({ id: familyId, branchId })) },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new PaymentsService(prisma, branchScope, audit as any);
  });

  it("rejects recording a payment from Teacher", async () => {
    await expect(
      service.recordPayment(teacher, branchId, familyId, {
        amountMinor: 1000,
        method: "CASH",
        paidAt: "2026-09-01",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("allocates a payment FIFO across open invoices, oldest first", async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: "inv1", year: 2026, month: 8, totalMinor: 300_00, allocations: [] },
      { id: "inv2", year: 2026, month: 9, totalMinor: 300_00, allocations: [] },
    ]);

    await service.recordPayment(accountant, branchId, familyId, {
      amountMinor: 400_00,
      method: "CASH",
      paidAt: "2026-09-05",
    });

    expect(prisma.paymentAllocation.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ invoiceId: "inv1", amountMinor: 300_00 }) }),
    );
    expect(prisma.paymentAllocation.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ invoiceId: "inv2", amountMinor: 100_00 }) }),
    );
    expect(prisma.invoice.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: "inv1" }, data: { status: "PAID" } }),
    );
    expect(prisma.invoice.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: "inv2" }, data: { status: "PARTIALLY_PAID" } }),
    );
  });

  it("skips an invoice that's already fully covered by prior allocations", async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: "inv1", year: 2026, month: 8, totalMinor: 300_00, allocations: [{ amountMinor: 300_00 }] },
      { id: "inv2", year: 2026, month: 9, totalMinor: 200_00, allocations: [] },
    ]);

    await service.recordPayment(accountant, branchId, familyId, {
      amountMinor: 200_00,
      method: "CASH",
      paidAt: "2026-09-05",
    });

    expect(prisma.paymentAllocation.create).toHaveBeenCalledTimes(1);
    expect(prisma.paymentAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ invoiceId: "inv2", amountMinor: 200_00 }) }),
    );
  });

  it("leaves the remainder unallocated once all open invoices are covered", async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: "inv1", year: 2026, month: 8, totalMinor: 100_00, allocations: [] },
    ]);

    await service.recordPayment(accountant, branchId, familyId, {
      amountMinor: 500_00,
      method: "CASH",
      paidAt: "2026-09-05",
    });

    expect(prisma.paymentAllocation.create).toHaveBeenCalledTimes(1);
    expect(prisma.paymentAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountMinor: 100_00 }) }),
    );
  });

  it("computes family balance as paid minus invoiced", async () => {
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amountMinor: 500_00 } });
    prisma.invoice.aggregate.mockResolvedValue({ _sum: { totalMinor: 300_00 } });

    const balance = await service.getFamilyBalance(accountant, branchId, familyId);
    expect(balance).toEqual({ totalPaidMinor: 500_00, totalInvoicedMinor: 300_00, balanceMinor: 200_00 });
  });
});
