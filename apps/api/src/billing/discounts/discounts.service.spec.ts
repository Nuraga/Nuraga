import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { DiscountsService } from "./discounts.service";
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

describe("DiscountsService", () => {
  const branchId = "b1";
  const owner = user({ grants: [{ branchId, role: "OWNER" }] });
  const accountant = user({ grants: [{ branchId, role: "ACCOUNTANT" }] });
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });

  let prisma: any;
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: DiscountsService;

  beforeEach(() => {
    prisma = {
      discount: {
        create: jest.fn((args: any) => Promise.resolve({ id: "d1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() =>
          Promise.resolve({
            id: "d1",
            basis: "SECOND_CHILD",
            kind: "PERCENT",
            family: { branchId },
            child: null,
          }),
        ),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
      family: { findUnique: jest.fn(() => Promise.resolve({ id: "f1", branchId })) },
      child: { findUnique: jest.fn(() => Promise.resolve({ id: "c1", familyId: "f1" })) },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new DiscountsService(prisma, branchScope, audit as any);
  });

  const secondChildDto = {
    familyId: "f1",
    basis: "SECOND_CHILD" as const,
    kind: "PERCENT" as const,
    value: 10,
    validFrom: "2026-09-01",
  };

  it("rejects creation from a role without discount rights", async () => {
    await expect(service.create(manager, branchId, secondChildDto)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("rejects DIRECTOR_DECISION from Accountant (write-eligible but not director-tier)", async () => {
    await expect(
      service.create(accountant, branchId, {
        ...secondChildDto,
        basis: "DIRECTOR_DECISION",
        reason: "VIP client",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects DIRECTOR_DECISION without a reason", async () => {
    await expect(
      service.create(owner, branchId, { ...secondChildDto, basis: "DIRECTOR_DECISION" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects providing both familyId and childId", async () => {
    await expect(
      service.create(owner, branchId, { ...secondChildDto, childId: "c1" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects providing neither familyId nor childId", async () => {
    const withoutFamily = { ...secondChildDto, familyId: undefined };
    await expect(service.create(owner, branchId, withoutFamily as never)).rejects.toThrow(
      BadRequestException,
    );
  });

  it("rejects a PERCENT value above 100", async () => {
    await expect(
      service.create(owner, branchId, { ...secondChildDto, value: 150 }),
    ).rejects.toThrow(BadRequestException);
  });

  it("creates a discount, stamping approvedById from the caller", async () => {
    const discount = await service.create(owner, branchId, secondChildDto);
    expect(discount).toMatchObject({ familyId: "f1", basis: "SECOND_CHILD", approvedById: "u1" });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "discount" }));
  });

  it("404s when updating a discount belonging to a different branch", async () => {
    prisma.discount.findUnique.mockResolvedValue({
      id: "d1",
      basis: "SECOND_CHILD",
      kind: "PERCENT",
      family: { branchId: "other" },
      child: null,
    });
    await expect(service.update(owner, branchId, "d1", { value: 5 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("archive() sets isActive to false", async () => {
    const result = await service.archive(owner, branchId, "d1");
    expect(result).toMatchObject({ isActive: false });
  });
});
