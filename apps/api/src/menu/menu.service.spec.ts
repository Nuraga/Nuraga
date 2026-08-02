import { ForbiddenException } from "@nestjs/common";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { MenuService } from "./menu.service";
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

describe("MenuService", () => {
  const branchId = "b1";
  const manager = user({ grants: [{ branchId, role: "MANAGER" }] });
  const teacher = user({ grants: [{ branchId, role: "TEACHER" }] });

  const nutsDish = {
    id: "d1",
    name: "Печенье с орехами",
    allergens: [{ dishId: "d1", allergenId: "nuts", allergen: { id: "nuts", name: "Орехи" } }],
  };
  const plainDish = { id: "d2", name: "Рис", allergens: [] };

  let prisma: any;
  let audit: { record: jest.Mock };
  let branchScope: BranchScopeService;
  let service: MenuService;

  beforeEach(() => {
    prisma = {
      menuItem: {
        deleteMany: jest.fn(() => Promise.resolve({ count: 0 })),
        create: jest.fn((args: any) => Promise.resolve({ id: "mi1", ...args.data })),
        findMany: jest.fn(() =>
          Promise.resolve([
            { id: "mi1", date: new Date("2026-08-03"), mealType: "BREAKFAST", dishId: "d1", dish: nutsDish },
            { id: "mi2", date: new Date("2026-08-03"), mealType: "LUNCH", dishId: "d2", dish: plainDish },
          ]),
        ),
      },
      childAllergen: {
        findMany: jest.fn(() =>
          Promise.resolve([
            {
              childId: "c1",
              allergenId: "nuts",
              child: { id: "c1", fullName: "Иванов Иван" },
              allergen: { name: "Орехи" },
            },
          ]),
        ),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    audit = { record: jest.fn(() => Promise.resolve()) };
    branchScope = new BranchScopeService();
    service = new MenuService(prisma, branchScope, audit as any);
  });

  describe("publishDay", () => {
    it("rejects a Teacher publishing a menu", async () => {
      await expect(
        service.publishDay(teacher, branchId, "2026-08-03", [{ mealType: "BREAKFAST", dishId: "d1" }]),
      ).rejects.toThrow(ForbiddenException);
    });

    it("replaces the day: deletes existing items, then creates the new list", async () => {
      await service.publishDay(manager, branchId, "2026-08-03", [
        { mealType: "BREAKFAST", dishId: "d1" },
        { mealType: "LUNCH", dishId: "d2" },
      ]);

      expect(prisma.menuItem.deleteMany).toHaveBeenCalledWith({
        where: { branchId, date: new Date("2026-08-03") },
      });
      expect(prisma.menuItem.create).toHaveBeenCalledTimes(2);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ entity: "menu_item", action: "update" }));
    });
  });

  describe("getRange", () => {
    it("allows a Teacher to read the menu — it's not secret", async () => {
      await expect(service.getRange(teacher, branchId, "2026-08-03", "2026-08-03")).resolves.toBeDefined();
    });

    it("flags a dish as conflicting for an enrolled child carrying the matching allergen", async () => {
      const items = await service.getRange(manager, branchId, "2026-08-03", "2026-08-03");
      const nutsItem = items.find((i) => i.dishId === "d1")!;
      expect(nutsItem.conflicts).toEqual([{ childId: "c1", fullName: "Иванов Иван", allergenNames: ["Орехи"] }]);
    });

    it("reports no conflicts for a dish with no allergens", async () => {
      const items = await service.getRange(manager, branchId, "2026-08-03", "2026-08-03");
      const plainItem = items.find((i) => i.dishId === "d2")!;
      expect(plainItem.conflicts).toEqual([]);
    });

    it("skips the allergen-matching query entirely when no dish in range has allergens", async () => {
      prisma.menuItem.findMany.mockResolvedValue([
        { id: "mi2", date: new Date("2026-08-03"), mealType: "LUNCH", dishId: "d2", dish: plainDish },
      ]);
      await service.getRange(manager, branchId, "2026-08-03", "2026-08-03");
      expect(prisma.childAllergen.findMany).not.toHaveBeenCalled();
    });
  });
});
