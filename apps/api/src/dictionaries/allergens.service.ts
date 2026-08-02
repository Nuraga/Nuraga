import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateAllergenDto } from "./dto/create-allergen.dto";
import { UpdateAllergenDto } from "./dto/update-allergen.dto";

const NETWORK_ADMIN_ROLES = ["OWNER", "SUPERADMIN"] as const;

@Injectable()
export class AllergensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    return this.prisma.allergen.findMany({ orderBy: { name: "asc" } });
  }

  async create(user: AuthenticatedUser, dto: CreateAllergenDto) {
    this.assertNetworkAdmin(user);

    const allergen = await this.prisma.allergen.create({ data: dto });
    await this.audit.record({
      entity: "allergen",
      entityId: allergen.id,
      action: "create",
      newValue: allergen,
      actorId: user.id,
    });
    return allergen;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateAllergenDto) {
    this.assertNetworkAdmin(user);

    const existing = await this.prisma.allergen.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Allergen not found");

    const allergen = await this.prisma.allergen.update({ where: { id }, data: dto });
    await this.audit.record({
      entity: "allergen",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: allergen,
      actorId: user.id,
    });
    return allergen;
  }

  async archive(user: AuthenticatedUser, id: string) {
    return this.update(user, id, { isActive: false });
  }

  private assertNetworkAdmin(user: AuthenticatedUser): void {
    if (!this.branchScope.hasAnyRole(user, [...NETWORK_ADMIN_ROLES])) {
      throw new ForbiddenException("Only Owner/Superadmin may manage dictionaries");
    }
  }
}
