import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateDischargeReasonDto } from "./dto/create-discharge-reason.dto";
import { UpdateDischargeReasonDto } from "./dto/update-discharge-reason.dto";

const NETWORK_ADMIN_ROLES = ["OWNER", "SUPERADMIN"] as const;

@Injectable()
export class DischargeReasonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    return this.prisma.dischargeReason.findMany({ orderBy: { name: "asc" } });
  }

  async create(user: AuthenticatedUser, dto: CreateDischargeReasonDto) {
    this.assertNetworkAdmin(user);

    const reason = await this.prisma.dischargeReason.create({ data: dto });
    await this.audit.record({
      entity: "discharge_reason",
      entityId: reason.id,
      action: "create",
      newValue: reason,
      actorId: user.id,
    });
    return reason;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateDischargeReasonDto) {
    this.assertNetworkAdmin(user);

    const existing = await this.prisma.dischargeReason.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Discharge reason not found");

    const reason = await this.prisma.dischargeReason.update({ where: { id }, data: dto });
    await this.audit.record({
      entity: "discharge_reason",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: reason,
      actorId: user.id,
    });
    return reason;
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
