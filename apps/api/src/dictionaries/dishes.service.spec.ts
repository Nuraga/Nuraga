import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { DishesService } from "./dishes.service";
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

describe("DishesService", () => {
  let prisma: { dish: Record<string, jest.Mock>; dishAllergen: Record<string, jest.Mock> };
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: DishesService;

  const manager = user({ grants: [{ branchId: "b1", role: "MANAGER" }] });
  const teacher = user({ grants: [{ branchId: "b1", role: "TEACHER" }] });

  beforeEach(() => {
    prisma = {
      dish: {
        create: jest.fn((args: any) => Promise.resolve({ id: "d1", ...args.data })),
        findMany: jest.fn(() => Promise.resolve([])),
        findUnique: jest.fn(() => Promise.resolve({ id: "d1", name: "Гречка" })),
        update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
      dishAllergen: {
        deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
      },
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new DishesService(prisma as any, branchScope, audit as any);
  });

  it("rejects creation from Teacher", async () => {
    await expect(service.create(teacher, { name: "Каша" })).rejects.toThrow(ForbiddenException);
  });

  it("allows Manager to create a dish (unlike other dictionaries, not Owner/Superadmin-only)", async () => {
    const dish = await service.create(manager, { name: "Каша", allergenIds: ["a1"] });
    expect(dish).toMatchObject({ name: "Каша" });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "dish", action: "create" }));
  });

  it("raises NotFoundException when updating a missing dish", async () => {
    prisma.dish.findUnique.mockResolvedValue(null);
    await expect(service.update(manager, "missing", { name: "X" })).rejects.toThrow(NotFoundException);
  });

  it("replaces allergen tags on update when allergenIds is provided", async () => {
    await service.update(manager, "d1", { allergenIds: ["a2"] });
    expect(prisma.dishAllergen.deleteMany).toHaveBeenCalledWith({ where: { dishId: "d1" } });
  });

  it("archive() sets isActive to false", async () => {
    const result = await service.archive(manager, "d1");
    expect(result).toMatchObject({ isActive: false });
  });
});
