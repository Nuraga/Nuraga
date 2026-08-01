import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Role } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { BranchScopeService } from "../../common/access/branch-scope.service";
import { AuditService } from "../../common/audit/audit.service";
import type { AuthenticatedUser } from "../../common/access/branch-access.types";
import { CreateDiscountDto } from "./dto/create-discount.dto";
import { UpdateDiscountDto } from "./dto/update-discount.dto";

const DISCOUNT_READ_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT"];
const DISCOUNT_WRITE_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "ACCOUNTANT"];
// "по решению директора" — flagged in ТЗ §6.3 as a typical leak point, so it
// gets a narrower gate than ordinary discounts.
const DIRECTOR_DECISION_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER"];
const MAX_PERCENT_VALUE = 100;

@Injectable()
export class DiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async listForFamily(user: AuthenticatedUser, branchId: string, familyId: string) {
    this.branchScope.assertRoleInBranch(user, DISCOUNT_READ_ROLES, branchId);
    await this.assertFamilyInBranch(branchId, familyId);

    return this.prisma.discount.findMany({
      where: { OR: [{ familyId }, { child: { familyId } }] },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(user: AuthenticatedUser, branchId: string, dto: CreateDiscountDto) {
    this.branchScope.assertRoleInBranch(user, DISCOUNT_WRITE_ROLES, branchId);

    if (dto.basis === "DIRECTOR_DECISION") {
      this.branchScope.assertRoleInBranch(user, DIRECTOR_DECISION_ROLES, branchId);
      if (!dto.reason) {
        throw new BadRequestException("A reason is required for a director-decision discount");
      }
    }

    const hasFamily = Boolean(dto.familyId);
    const hasChild = Boolean(dto.childId);
    if (hasFamily === hasChild) {
      throw new BadRequestException("Provide exactly one of familyId or childId");
    }
    if (dto.kind === "PERCENT" && dto.value > MAX_PERCENT_VALUE) {
      throw new BadRequestException("A percentage discount cannot exceed 100");
    }

    if (dto.familyId) await this.assertFamilyInBranch(branchId, dto.familyId);
    if (dto.childId) await this.assertChildInBranch(branchId, dto.childId);

    const discount = await this.prisma.discount.create({
      data: {
        familyId: dto.familyId,
        childId: dto.childId,
        basis: dto.basis,
        kind: dto.kind,
        value: dto.value,
        reason: dto.reason,
        validFrom: new Date(dto.validFrom),
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
        approvedById: user.id,
      },
    });

    await this.audit.record({
      entity: "discount",
      entityId: discount.id,
      action: "create",
      newValue: discount,
      actorId: user.id,
    });
    return discount;
  }

  async update(user: AuthenticatedUser, branchId: string, id: string, dto: UpdateDiscountDto) {
    this.branchScope.assertRoleInBranch(user, DISCOUNT_WRITE_ROLES, branchId);
    const existing = await this.getInBranch(branchId, id);

    if (existing.basis === "DIRECTOR_DECISION") {
      this.branchScope.assertRoleInBranch(user, DIRECTOR_DECISION_ROLES, branchId);
    }
    if (existing.kind === "PERCENT" && dto.value !== undefined && dto.value > MAX_PERCENT_VALUE) {
      throw new BadRequestException("A percentage discount cannot exceed 100");
    }

    const discount = await this.prisma.discount.update({
      where: { id },
      data: { ...dto, validTo: dto.validTo ? new Date(dto.validTo) : undefined },
    });
    await this.audit.record({
      entity: "discount",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: discount,
      actorId: user.id,
    });
    return discount;
  }

  async archive(user: AuthenticatedUser, branchId: string, id: string) {
    return this.update(user, branchId, id, { isActive: false });
  }

  private async getInBranch(branchId: string, id: string) {
    const discount = await this.prisma.discount.findUnique({
      where: { id },
      include: { family: true, child: { include: { family: true } } },
    });
    if (!discount) throw new NotFoundException("Discount not found");

    const discountBranchId = discount.family?.branchId ?? discount.child?.family.branchId;
    if (discountBranchId !== branchId) throw new NotFoundException("Discount not found");
    return discount;
  }

  private async assertFamilyInBranch(branchId: string, familyId: string): Promise<void> {
    const family = await this.prisma.family.findUnique({ where: { id: familyId } });
    if (!family || family.branchId !== branchId) {
      throw new NotFoundException("Family not found in this branch");
    }
  }

  private async assertChildInBranch(branchId: string, childId: string): Promise<void> {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child) throw new NotFoundException("Child not found");
    const family = await this.prisma.family.findUnique({ where: { id: child.familyId } });
    if (!family || family.branchId !== branchId) {
      throw new NotFoundException("Child not found in this branch");
    }
  }
}
