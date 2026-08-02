import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateDishDto } from "./dto/create-dish.dto";
import { UpdateDishDto } from "./dto/update-dish.dto";

// Deliberately NOT NETWORK_ADMIN_ROLES like the other dictionaries — dishes
// are operational menu-authoring content, edited far more often than a
// "discharge reason", so they're gated the same as publishing a menu.
const MENU_WRITE_ROLES = ["OWNER", "BRANCH_MANAGER", "MANAGER"] as const;

const WITH_ALLERGENS = {
  allergens: { include: { allergen: { select: { id: true, name: true } } } },
} as const;

@Injectable()
export class DishesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    return this.prisma.dish.findMany({ orderBy: { name: "asc" }, include: WITH_ALLERGENS });
  }

  async create(user: AuthenticatedUser, dto: CreateDishDto) {
    this.assertMenuWriter(user);

    const dish = await this.prisma.dish.create({
      data: {
        name: dto.name,
        allergens: dto.allergenIds
          ? { create: dto.allergenIds.map((allergenId) => ({ allergenId })) }
          : undefined,
      },
      include: WITH_ALLERGENS,
    });
    await this.audit.record({
      entity: "dish",
      entityId: dish.id,
      action: "create",
      newValue: dish,
      actorId: user.id,
    });
    return dish;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateDishDto) {
    this.assertMenuWriter(user);

    const existing = await this.prisma.dish.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Dish not found");

    if (dto.allergenIds) {
      await this.prisma.dishAllergen.deleteMany({ where: { dishId: id } });
    }

    const dish = await this.prisma.dish.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.allergenIds && {
          allergens: { create: dto.allergenIds.map((allergenId) => ({ allergenId })) },
        }),
      },
      include: WITH_ALLERGENS,
    });
    await this.audit.record({
      entity: "dish",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: dish,
      actorId: user.id,
    });
    return dish;
  }

  async archive(user: AuthenticatedUser, id: string) {
    return this.update(user, id, { isActive: false });
  }

  private assertMenuWriter(user: AuthenticatedUser): void {
    if (!this.branchScope.hasAnyRole(user, [...MENU_WRITE_ROLES])) {
      throw new ForbiddenException("Only Owner/Branch Manager/Manager may manage dishes");
    }
  }
}
