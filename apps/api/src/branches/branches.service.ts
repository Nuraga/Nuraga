import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";

// Adding/editing branches is a network-level operation (TRD 1.3: multi-branch
// within one legal network) — only Owner/Superadmin may do it, regardless of
// which (if any) branch is in scope.
const NETWORK_ADMIN_ROLES = ["OWNER", "SUPERADMIN"] as const;

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateBranchDto) {
    this.assertNetworkAdmin(user);

    const branch = await this.prisma.branch.create({ data: dto });
    await this.audit.record({
      entity: "branch",
      entityId: branch.id,
      action: "create",
      newValue: dto,
      actorId: user.id,
    });
    return branch;
  }

  async findAllForUser(user: AuthenticatedUser) {
    // Branch is its own scope root (filters on `id`, not a `branchId` FK),
    // so it can't reuse BranchScopeService.branchFilter() as-is.
    const ids = this.branchScope.accessibleBranchIds(user);
    return this.prisma.branch.findMany({
      where: ids === "all" ? {} : { id: { in: ids } },
      orderBy: { name: "asc" },
    });
  }

  async findOneForUser(user: AuthenticatedUser, id: string) {
    this.branchScope.assertBranchAccess(user, id);
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateBranchDto) {
    this.assertNetworkAdmin(user);

    const existing = await this.prisma.branch.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Branch not found");

    const branch = await this.prisma.branch.update({ where: { id }, data: dto });
    await this.audit.record({
      entity: "branch",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: branch,
      actorId: user.id,
    });
    return branch;
  }

  async archive(user: AuthenticatedUser, id: string) {
    return this.update(user, id, { isActive: false });
  }

  private assertNetworkAdmin(user: AuthenticatedUser): void {
    if (!this.branchScope.hasAnyRole(user, [...NETWORK_ADMIN_ROLES])) {
      throw new ForbiddenException("Only Owner/Superadmin may manage branches");
    }
  }
}
