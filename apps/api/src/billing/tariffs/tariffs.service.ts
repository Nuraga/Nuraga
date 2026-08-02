import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { AuditService } from "../../common/audit/audit.service";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";
import { CreateTariffDto } from "./dto/create-tariff.dto";
import { UpdateTariffDto } from "./dto/update-tariff.dto";

// Matches the ТЗ §2.2 access matrix exactly: "Тарифы и цены" is ПСРУ for
// Владелец only — Управляющий/Менеджер/Бухгалтер get read-only (П).
const NETWORK_ADMIN_ROLES = ["OWNER", "SUPERADMIN"] as const;

@Injectable()
export class TariffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  /** Tariffs visible from a branch: network-wide ones plus that branch's own. */
  async listForBranch(user: AuthenticatedUser, branchId: string) {
    this.branchScope.assertBranchAccess(user, branchId);
    return this.prisma.tariff.findMany({
      where: { OR: [{ branchId: null }, { branchId }] },
      orderBy: { name: "asc" },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateTariffDto) {
    this.assertNetworkAdmin(user);
    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch) throw new BadRequestException("Unknown branch");
    }

    const tariff = await this.prisma.tariff.create({
      data: {
        ...dto,
        validFrom: new Date(dto.validFrom),
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
      },
    });

    await this.audit.record({
      entity: "tariff",
      entityId: tariff.id,
      action: "create",
      newValue: tariff,
      actorId: user.id,
    });
    return tariff;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateTariffDto) {
    this.assertNetworkAdmin(user);
    const existing = await this.prisma.tariff.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Tariff not found");

    const tariff = await this.prisma.tariff.update({
      where: { id },
      data: { ...dto, validTo: dto.validTo ? new Date(dto.validTo) : undefined },
    });
    await this.audit.record({
      entity: "tariff",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: tariff,
      actorId: user.id,
    });
    return tariff;
  }

  async archive(user: AuthenticatedUser, id: string) {
    return this.update(user, id, { isActive: false });
  }

  private assertNetworkAdmin(user: AuthenticatedUser): void {
    if (!this.branchScope.hasAnyRole(user, [...NETWORK_ADMIN_ROLES])) {
      throw new ForbiddenException("Only Owner/Superadmin may manage tariffs");
    }
  }
}
