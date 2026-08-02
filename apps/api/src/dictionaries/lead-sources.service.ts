import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateLeadSourceDto } from "./dto/create-lead-source.dto";
import { UpdateLeadSourceDto } from "./dto/update-lead-source.dto";

const NETWORK_ADMIN_ROLES = ["OWNER", "SUPERADMIN"] as const;

@Injectable()
export class LeadSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    return this.prisma.leadSource.findMany({ orderBy: { name: "asc" } });
  }

  async create(user: AuthenticatedUser, dto: CreateLeadSourceDto) {
    this.assertNetworkAdmin(user);

    const source = await this.prisma.leadSource.create({ data: dto });
    await this.audit.record({
      entity: "lead_source",
      entityId: source.id,
      action: "create",
      newValue: source,
      actorId: user.id,
    });
    return source;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateLeadSourceDto) {
    this.assertNetworkAdmin(user);

    const existing = await this.prisma.leadSource.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Lead source not found");

    const source = await this.prisma.leadSource.update({ where: { id }, data: dto });
    await this.audit.record({
      entity: "lead_source",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: source,
      actorId: user.id,
    });
    return source;
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
