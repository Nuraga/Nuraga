import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { TariffsService } from "./tariffs.service";
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

describe("TariffsService", () => {
  const branchId = "b1";
  const owner = user({ hasNetworkAccess: true, grants: [{ branchId, role: "OWNER" }] });
  const manager = user({ grants: [{ branchId, role: "BRANCH_MANAGER" }] });

  const validDto = {
    name: "Полный день",
    type: "MONTHLY_FULL" as const,
    baseAmountMinor: 15_000_00,
    recurrence: "MONTHLY" as const,
    validFrom: "2026-09-01",
  };

  let prisma: any;
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: TariffsService;

  beforeEach(() => {
    prisma = {
      tariff: {
        create: jest.fn((args: any) => Promise.resolve({ id: "t1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() => Promise.resolve({ id: "t1", name: "Old" })),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
      branch: { findUnique: jest.fn(() => Promise.resolve({ id: branchId })) },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new TariffsService(prisma, branchScope, audit as any);
  });

  it("rejects creation from a non-owner role", async () => {
    await expect(service.create(manager, validDto)).rejects.toThrow(ForbiddenException);
  });

  it("rejects an unknown branchId", async () => {
    prisma.branch.findUnique.mockResolvedValue(null);
    await expect(service.create(owner, { ...validDto, branchId: "missing" })).rejects.toThrow(
      BadRequestException,
    );
  });

  it("creates a network-wide tariff when branchId is omitted", async () => {
    const tariff = await service.create(owner, validDto);
    expect(tariff).toMatchObject({ name: "Полный день", baseAmountMinor: 15_000_00 });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "tariff" }));
  });

  it("raises NotFoundException when updating a missing tariff", async () => {
    prisma.tariff.findUnique.mockResolvedValue(null);
    await expect(service.update(owner, "missing", { name: "X" })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("update() cannot change baseAmountMinor/type/currency (not present on the DTO)", async () => {
    const result = await service.update(owner, "t1", { name: "Renamed" });
    expect(result).toMatchObject({ id: "t1", name: "Renamed" });
    expect(prisma.tariff.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining({ baseAmountMinor: expect.anything() }) }),
    );
  });

  it("archive() sets isActive to false", async () => {
    const result = await service.archive(owner, "t1");
    expect(result).toMatchObject({ isActive: false });
  });

  it("listForBranch returns both network-wide and branch tariffs", async () => {
    await service.listForBranch(manager, branchId);
    expect(prisma.tariff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ branchId: null }, { branchId }] } }),
    );
  });
});
