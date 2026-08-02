import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ParentAccessService } from "../common/access/parent-access.service";
import { ParentPortalService } from "./parent-portal.service";
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

describe("ParentPortalService", () => {
  const parent = user({ parentProfile: { id: "par1", familyId: "f1" } });
  const staff = user({ grants: [{ branchId: "b1", role: "MANAGER" }] });

  let prisma: any;
  let audit: { record: jest.Mock };
  let service: ParentPortalService;

  beforeEach(() => {
    prisma = {
      family: {
        findUniqueOrThrow: jest.fn(() => Promise.resolve({ id: "f1", name: "Ивановы", parents: [], children: [] })),
      },
      invoice: {
        findMany: jest.fn(() => Promise.resolve([])),
        aggregate: jest.fn(() => Promise.resolve({ _sum: { totalMinor: 0 } })),
      },
      payment: {
        findMany: jest.fn(() => Promise.resolve([])),
        aggregate: jest.fn(() => Promise.resolve({ _sum: { amountMinor: 0 } })),
      },
      child: {
        findUnique: jest.fn(() => Promise.resolve({ id: "c1", familyId: "f1" })),
      },
      attendance: {
        findMany: jest.fn(() => Promise.resolve([])),
      },
      absenceRequest: {
        create: jest.fn((args: any) => Promise.resolve({ id: "ar1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    service = new ParentPortalService(prisma, new ParentAccessService(), audit as any);
  });

  it("rejects every method for a staff user with no parent profile", async () => {
    await expect(service.getMe(staff)).rejects.toThrow(ForbiddenException);
    await expect(service.listInvoices(staff)).rejects.toThrow(ForbiddenException);
    await expect(service.getBalance(staff)).rejects.toThrow(ForbiddenException);
  });

  it("getMe returns the parent's own family", async () => {
    const family = await service.getMe(parent);
    expect(prisma.family.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "f1" } }),
    );
    expect(family).toMatchObject({ id: "f1" });
  });

  it("listInvoices excludes DRAFT invoices (ТЗ §6.4: parent can't see unapproved invoices)", async () => {
    await service.listInvoices(parent);
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { familyId: "f1", status: { not: "DRAFT" } } }),
    );
  });

  it("getBalance computes paid minus invoiced", async () => {
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amountMinor: 500_00 } });
    prisma.invoice.aggregate.mockResolvedValue({ _sum: { totalMinor: 300_00 } });

    const balance = await service.getBalance(parent);
    expect(balance).toEqual({ totalPaidMinor: 500_00, totalInvoicedMinor: 300_00, balanceMinor: 200_00 });
  });

  it("404s attendance/absence-request access for a child outside the parent's family", async () => {
    prisma.child.findUnique.mockResolvedValue({ id: "c1", familyId: "other-family" });
    await expect(service.getChildAttendance(parent, "c1")).rejects.toThrow(NotFoundException);
    await expect(
      service.createAbsenceRequest(parent, "c1", { dateFrom: "2026-09-01", dateTo: "2026-09-03" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("createAbsenceRequest submits under the caller's own parent id", async () => {
    const request = await service.createAbsenceRequest(parent, "c1", {
      dateFrom: "2026-09-01",
      dateTo: "2026-09-03",
      reason: "Отпуск",
    });
    expect(prisma.absenceRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ childId: "c1", submittedByParentId: "par1" }) }),
    );
    expect(request).toMatchObject({ childId: "c1", submittedByParentId: "par1" });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "absence_request" }));
  });

  it("rejects an absence request where dateTo precedes dateFrom", async () => {
    await expect(
      service.createAbsenceRequest(parent, "c1", { dateFrom: "2026-09-10", dateTo: "2026-09-01" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects an absence request spanning more than 60 days", async () => {
    await expect(
      service.createAbsenceRequest(parent, "c1", { dateFrom: "2026-01-01", dateTo: "2026-06-01" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("listAbsenceRequests scopes by the parent's family via the child relation", async () => {
    await service.listAbsenceRequests(parent);
    expect(prisma.absenceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { child: { familyId: "f1" } } }),
    );
  });
});
