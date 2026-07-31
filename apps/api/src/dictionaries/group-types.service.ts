import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateGroupTypeDto } from "./dto/create-group-type.dto";
import { UpdateGroupTypeDto } from "./dto/update-group-type.dto";

// Group types are a network-wide справочник (TRD 8: dictionaries are shared
// across all branches), so only Owner/Superadmin manage them — same rule as
// BranchesService.assertNetworkAdmin.
const NETWORK_ADMIN_ROLES = ["OWNER", "SUPERADMIN"] as const;

@Injectable()
export class GroupTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    return this.prisma.groupType.findMany({ orderBy: { minAgeMonths: "asc" } });
  }

  async create(user: AuthenticatedUser, dto: CreateGroupTypeDto) {
    this.assertNetworkAdmin(user);
    this.assertAgeOrdering(dto.minAgeMonths, dto.maxAgeMonths);

    const groupType = await this.prisma.groupType.create({ data: dto });
    await this.audit.record({
      entity: "group_type",
      entityId: groupType.id,
      action: "create",
      newValue: groupType,
      actorId: user.id,
    });
    return groupType;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateGroupTypeDto) {
    this.assertNetworkAdmin(user);

    const existing = await this.prisma.groupType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Group type not found");

    this.assertAgeOrdering(
      dto.minAgeMonths ?? existing.minAgeMonths,
      dto.maxAgeMonths ?? existing.maxAgeMonths,
    );

    const groupType = await this.prisma.groupType.update({ where: { id }, data: dto });
    await this.audit.record({
      entity: "group_type",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: groupType,
      actorId: user.id,
    });
    return groupType;
  }

  async archive(user: AuthenticatedUser, id: string) {
    return this.update(user, id, { isActive: false });
  }

  private assertAgeOrdering(minAgeMonths: number, maxAgeMonths: number): void {
    if (maxAgeMonths < minAgeMonths) {
      throw new BadRequestException("maxAgeMonths cannot be less than minAgeMonths");
    }
  }

  private assertNetworkAdmin(user: AuthenticatedUser): void {
    if (!this.branchScope.hasAnyRole(user, [...NETWORK_ADMIN_ROLES])) {
      throw new ForbiddenException("Only Owner/Superadmin may manage dictionaries");
    }
  }
}
