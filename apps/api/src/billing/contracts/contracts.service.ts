import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Role } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { AuditService } from "../../common/audit/audit.service";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";
import { CreateContractDto } from "./dto/create-contract.dto";
import { UpdateContractDto } from "./dto/update-contract.dto";
import { ChangeTariffDto } from "./dto/change-tariff.dto";

// Matches ТЗ §2.2's "Договоры" row: Owner ПСРУ, Branch Manager/Accountant
// ПСР (no delete), Manager ПС (create/view only, no edit).
const CONTRACT_READ_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT"];
const CONTRACT_CREATE_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT"];
const CONTRACT_EDIT_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "ACCOUNTANT"];
const CONTRACT_TERMINATE_ROLES: Role[] = ["OWNER"];

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async listForFamily(user: AuthenticatedUser, branchId: string, familyId: string) {
    this.branchScope.assertRoleInBranch(user, CONTRACT_READ_ROLES, branchId);
    await this.assertFamilyInBranch(branchId, familyId);

    return this.prisma.contract.findMany({
      where: { familyId },
      include: { tariff: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(user: AuthenticatedUser, branchId: string, dto: CreateContractDto) {
    this.branchScope.assertRoleInBranch(user, CONTRACT_CREATE_ROLES, branchId);
    await this.assertFamilyInBranch(branchId, dto.familyId);
    await this.assertChildInFamily(dto.familyId, dto.childId);
    await this.assertTariffUsableInBranch(branchId, dto.tariffId);

    const contract = await this.prisma.contract.create({
      data: {
        familyId: dto.familyId,
        childId: dto.childId,
        tariffId: dto.tariffId,
        number: dto.number,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: "ACTIVE",
      },
    });

    await this.audit.record({
      entity: "contract",
      entityId: contract.id,
      action: "create",
      newValue: contract,
      actorId: user.id,
    });
    return contract;
  }

  async update(user: AuthenticatedUser, branchId: string, id: string, dto: UpdateContractDto) {
    this.branchScope.assertRoleInBranch(user, CONTRACT_EDIT_ROLES, branchId);
    const existing = await this.getInBranch(branchId, id);

    const contract = await this.prisma.contract.update({
      where: { id },
      data: { ...dto, endDate: dto.endDate ? new Date(dto.endDate) : undefined },
    });
    await this.audit.record({
      entity: "contract",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: contract,
      actorId: user.id,
    });
    return contract;
  }

  async changeTariff(user: AuthenticatedUser, branchId: string, id: string, dto: ChangeTariffDto) {
    this.branchScope.assertRoleInBranch(user, CONTRACT_EDIT_ROLES, branchId);
    const existing = await this.getInBranch(branchId, id);
    await this.assertTariffUsableInBranch(branchId, dto.tariffId);

    const contract = await this.prisma.contract.update({
      where: { id },
      data: { tariffId: dto.tariffId },
    });
    await this.audit.record({
      entity: "contract",
      entityId: id,
      action: "update",
      oldValue: { tariffId: existing.tariffId },
      newValue: { event: "tariff_change", tariffId: dto.tariffId },
      actorId: user.id,
    });
    return contract;
  }

  async terminate(user: AuthenticatedUser, branchId: string, id: string) {
    this.branchScope.assertRoleInBranch(user, CONTRACT_TERMINATE_ROLES, branchId);
    const existing = await this.getInBranch(branchId, id);

    const contract = await this.prisma.contract.update({
      where: { id },
      data: { status: "TERMINATED" },
    });
    await this.audit.record({
      entity: "contract",
      entityId: id,
      action: "update",
      oldValue: { status: existing.status },
      newValue: { event: "terminate" },
      actorId: user.id,
    });
    return contract;
  }

  private async getInBranch(branchId: string, id: string) {
    const contract = await this.prisma.contract.findUnique({ where: { id } });
    if (!contract) throw new NotFoundException("Contract not found");
    await this.assertFamilyInBranch(branchId, contract.familyId);
    return contract;
  }

  private async assertFamilyInBranch(branchId: string, familyId: string): Promise<void> {
    const family = await this.prisma.family.findUnique({ where: { id: familyId } });
    if (!family || family.branchId !== branchId) {
      throw new NotFoundException("Family not found in this branch");
    }
  }

  private async assertChildInFamily(familyId: string, childId: string): Promise<void> {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child || child.familyId !== familyId) {
      throw new BadRequestException("Child does not belong to this family");
    }
  }

  private async assertTariffUsableInBranch(branchId: string, tariffId: string): Promise<void> {
    const tariff = await this.prisma.tariff.findUnique({ where: { id: tariffId } });
    if (!tariff || (tariff.branchId !== null && tariff.branchId !== branchId)) {
      throw new BadRequestException("Tariff is not available in this branch");
    }
    if (!tariff.isActive) throw new BadRequestException("This tariff is archived");
  }
}
