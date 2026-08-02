import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AllergensService } from "./allergens.service";
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

describe("AllergensService", () => {
  let prisma: { allergen: Record<string, jest.Mock> };
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: AllergensService;

  const owner = user({ hasNetworkAccess: true, grants: [{ branchId: "b1", role: "OWNER" }] });
  const manager = user({ grants: [{ branchId: "b1", role: "BRANCH_MANAGER" }] });

  beforeEach(() => {
    prisma = {
      allergen: {
        create: jest.fn((args: any) => Promise.resolve({ id: "a1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() => Promise.resolve({ id: "a1", name: "Орехи" })),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new AllergensService(prisma as any, branchScope, audit as any);
  });

  it("rejects creation from Branch Manager — allergens are network-admin only", async () => {
    await expect(service.create(manager, { name: "Молоко" })).rejects.toThrow(ForbiddenException);
  });

  it("allows Owner to create an allergen and records an audit entry", async () => {
    const allergen = await service.create(owner, { name: "Молоко" });
    expect(allergen).toMatchObject({ name: "Молоко" });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "allergen", action: "create" }));
  });

  it("raises NotFoundException when updating a missing allergen", async () => {
    prisma.allergen.findUnique.mockResolvedValue(null);
    await expect(service.update(owner, "missing", { name: "X" })).rejects.toThrow(NotFoundException);
  });

  it("archive() sets isActive to false", async () => {
    const result = await service.archive(owner, "a1");
    expect(result).toMatchObject({ isActive: false });
  });
});
