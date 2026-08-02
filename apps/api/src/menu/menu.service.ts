import { Injectable } from "@nestjs/common";
import type { Role } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import type { MenuDayItemDto } from "./dto/publish-menu-day.dto";

// Same audience as attendance marking — publishing a menu is a managerial
// act, not something a TEACHER does day to day in this codebase's role model.
export const MENU_WRITE_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER"];

// Truncates to the calendar date only — MenuItem.date is @db.Date.
function toDateOnly(value: string): Date {
  return new Date(value.slice(0, 10));
}

export interface MenuConflict {
  childId: string;
  fullName: string;
  allergenNames: string[];
}

export interface MenuItemView {
  id: string;
  date: string;
  mealType: string;
  dishId: string;
  dishName: string;
  allergenNames: string[];
  conflicts: MenuConflict[];
}

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  /** Full replace of a single day's menu — simpler and more predictable for a "edit the day, save" UI than point patches. */
  async publishDay(
    user: AuthenticatedUser,
    branchId: string,
    date: string,
    items: MenuDayItemDto[],
  ): Promise<MenuItemView[]> {
    this.branchScope.assertRoleInBranch(user, MENU_WRITE_ROLES, branchId);
    const day = toDateOnly(date);

    await this.prisma.$transaction([
      this.prisma.menuItem.deleteMany({ where: { branchId, date: day } }),
      ...items.map((item) =>
        this.prisma.menuItem.create({
          data: { branchId, date: day, mealType: item.mealType, dishId: item.dishId },
        }),
      ),
    ]);

    await this.audit.record({
      entity: "menu_item",
      entityId: `${branchId}:${date}`,
      action: "update",
      newValue: { date, items },
      actorId: user.id,
    });

    return this.getRange(user, branchId, date, date);
  }

  /** Menu is not secret — any staff member with access to the branch can read it, including a TEACHER. */
  async getRange(user: AuthenticatedUser, branchId: string, from: string, to: string): Promise<MenuItemView[]> {
    this.branchScope.assertBranchAccess(user, branchId);

    const items = await this.prisma.menuItem.findMany({
      where: { branchId, date: { gte: toDateOnly(from), lte: toDateOnly(to) } },
      include: { dish: { include: { allergens: { include: { allergen: true } } } } },
      orderBy: [{ date: "asc" }, { mealType: "asc" }],
    });

    const dishAllergenRows = items.flatMap((item) =>
      item.dish.allergens.map((da) => ({ dishId: item.dishId, allergenId: da.allergenId })),
    );
    const conflictsByDish = await this.computeConflicts(branchId, dishAllergenRows);

    return items.map((item) => ({
      id: item.id,
      date: item.date.toISOString().slice(0, 10),
      mealType: item.mealType,
      dishId: item.dishId,
      dishName: item.dish.name,
      allergenNames: item.dish.allergens.map((da) => da.allergen.name),
      conflicts: conflictsByDish.get(item.dishId) ?? [],
    }));
  }

  /** For each (dish, allergen) pair in scope, finds enrolled children in this branch carrying that allergen. */
  private async computeConflicts(
    branchId: string,
    dishAllergenRows: { dishId: string; allergenId: string }[],
  ): Promise<Map<string, MenuConflict[]>> {
    const conflicts = new Map<string, MenuConflict[]>();
    const allergenIds = [...new Set(dishAllergenRows.map((row) => row.allergenId))];
    if (allergenIds.length === 0) return conflicts;

    const childAllergens = await this.prisma.childAllergen.findMany({
      where: {
        allergenId: { in: allergenIds },
        child: { status: "ENROLLED", family: { branchId } },
      },
      include: {
        child: { select: { id: true, fullName: true } },
        allergen: { select: { name: true } },
      },
    });

    for (const { dishId, allergenId } of dishAllergenRows) {
      const matches = childAllergens.filter((ca) => ca.allergenId === allergenId);
      if (matches.length === 0) continue;

      const list = conflicts.get(dishId) ?? [];
      for (const ca of matches) {
        let entry = list.find((c) => c.childId === ca.child.id);
        if (!entry) {
          entry = { childId: ca.child.id, fullName: ca.child.fullName, allergenNames: [] };
          list.push(entry);
        }
        if (!entry.allergenNames.includes(ca.allergen.name)) entry.allergenNames.push(ca.allergen.name);
      }
      conflicts.set(dishId, list);
    }

    return conflicts;
  }
}
