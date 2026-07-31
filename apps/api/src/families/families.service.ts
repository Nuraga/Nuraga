import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateFamilyDto } from "./dto/create-family.dto";
import { UpdateFamilyDto } from "./dto/update-family.dto";
import { CreateParentDto } from "./dto/create-parent.dto";
import { UpdateParentDto } from "./dto/update-parent.dto";
import { CreateTrustedPersonDto } from "./dto/create-trusted-person.dto";
import { UpdateTrustedPersonDto } from "./dto/update-trusted-person.dto";

// Family list/detail is a branch-office operation, not a teacher one — a
// teacher works through Children (own group), never by browsing families
// (TRD 2.2 has no "browse all families" grant for Воспитатель).
const FAMILY_READ_ROLES = ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT"] as const;
const FAMILY_WRITE_ROLES = ["OWNER", "BRANCH_MANAGER", "MANAGER"] as const;

@Injectable()
export class FamiliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
  ) {}

  async create(user: AuthenticatedUser, branchId: string, dto: CreateFamilyDto) {
    this.branchScope.assertRoleInBranch(user, [...FAMILY_WRITE_ROLES], branchId);

    const family = await this.prisma.family.create({ data: { ...dto, branchId } });
    await this.audit.record({
      entity: "family",
      entityId: family.id,
      action: "create",
      newValue: family,
      actorId: user.id,
    });
    return family;
  }

  async findAllForBranch(user: AuthenticatedUser, branchId: string, search?: string) {
    this.branchScope.assertRoleInBranch(user, [...FAMILY_READ_ROLES], branchId);

    return this.prisma.family.findMany({
      where: {
        branchId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { parents: { some: { phone: { contains: search } } } },
                { parents: { some: { fullName: { contains: search, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      include: { parents: true, children: true },
      orderBy: { name: "asc" },
    });
  }

  async findOne(user: AuthenticatedUser, branchId: string, id: string) {
    this.branchScope.assertRoleInBranch(user, [...FAMILY_READ_ROLES], branchId);
    await this.getOwnedOrThrow(branchId, id);

    // Re-fetched with relations — getOwnedOrThrow stays a lean ownership
    // check for the write paths that don't need them.
    return this.prisma.family.findUniqueOrThrow({
      where: { id },
      include: { parents: true, children: true, trustedPersons: true },
    });
  }

  async update(user: AuthenticatedUser, branchId: string, id: string, dto: UpdateFamilyDto) {
    this.branchScope.assertRoleInBranch(user, [...FAMILY_WRITE_ROLES], branchId);
    const existing = await this.getOwnedOrThrow(branchId, id);

    const family = await this.prisma.family.update({ where: { id }, data: dto });
    await this.audit.record({
      entity: "family",
      entityId: id,
      action: "update",
      oldValue: existing,
      newValue: family,
      actorId: user.id,
    });
    return family;
  }

  async addParent(
    user: AuthenticatedUser,
    branchId: string,
    familyId: string,
    dto: CreateParentDto,
  ) {
    this.branchScope.assertRoleInBranch(user, [...FAMILY_WRITE_ROLES], branchId);
    await this.getOwnedOrThrow(branchId, familyId);

    const parent = await this.prisma.parent.create({
      data: { ...dto, familyId, contactPriority: dto.contactPriority ?? 1 },
    });
    await this.audit.record({
      entity: "parent",
      entityId: parent.id,
      action: "create",
      newValue: parent,
      actorId: user.id,
    });
    return parent;
  }

  async updateParent(
    user: AuthenticatedUser,
    branchId: string,
    familyId: string,
    parentId: string,
    dto: UpdateParentDto,
  ) {
    this.branchScope.assertRoleInBranch(user, [...FAMILY_WRITE_ROLES], branchId);
    await this.getOwnedOrThrow(branchId, familyId);
    const existing = await this.getParentOrThrow(familyId, parentId);

    const parent = await this.prisma.parent.update({ where: { id: parentId }, data: dto });
    await this.audit.record({
      entity: "parent",
      entityId: parentId,
      action: "update",
      oldValue: existing,
      newValue: parent,
      actorId: user.id,
    });
    return parent;
  }

  async removeParent(user: AuthenticatedUser, branchId: string, familyId: string, parentId: string) {
    this.branchScope.assertRoleInBranch(user, [...FAMILY_WRITE_ROLES], branchId);
    await this.getOwnedOrThrow(branchId, familyId);
    const existing = await this.getParentOrThrow(familyId, parentId);

    await this.prisma.parent.delete({ where: { id: parentId } });
    await this.audit.record({
      entity: "parent",
      entityId: parentId,
      action: "delete",
      oldValue: existing,
      actorId: user.id,
    });
  }

  async addTrustedPerson(
    user: AuthenticatedUser,
    branchId: string,
    familyId: string,
    dto: CreateTrustedPersonDto,
  ) {
    this.branchScope.assertRoleInBranch(user, [...FAMILY_WRITE_ROLES], branchId);
    await this.getOwnedOrThrow(branchId, familyId);

    const person = await this.prisma.trustedPerson.create({
      data: {
        familyId,
        fullName: dto.fullName,
        documentInfo: dto.documentInfo,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
    await this.audit.record({
      entity: "trusted_person",
      entityId: person.id,
      action: "create",
      newValue: person,
      actorId: user.id,
    });
    return person;
  }

  async updateTrustedPerson(
    user: AuthenticatedUser,
    branchId: string,
    familyId: string,
    personId: string,
    dto: UpdateTrustedPersonDto,
  ) {
    this.branchScope.assertRoleInBranch(user, [...FAMILY_WRITE_ROLES], branchId);
    await this.getOwnedOrThrow(branchId, familyId);
    const existing = await this.getTrustedPersonOrThrow(familyId, personId);

    const person = await this.prisma.trustedPerson.update({
      where: { id: personId },
      data: {
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
    await this.audit.record({
      entity: "trusted_person",
      entityId: personId,
      action: "update",
      oldValue: existing,
      newValue: person,
      actorId: user.id,
    });
    return person;
  }

  async removeTrustedPerson(
    user: AuthenticatedUser,
    branchId: string,
    familyId: string,
    personId: string,
  ) {
    this.branchScope.assertRoleInBranch(user, [...FAMILY_WRITE_ROLES], branchId);
    await this.getOwnedOrThrow(branchId, familyId);
    const existing = await this.getTrustedPersonOrThrow(familyId, personId);

    await this.prisma.trustedPerson.delete({ where: { id: personId } });
    await this.audit.record({
      entity: "trusted_person",
      entityId: personId,
      action: "delete",
      oldValue: existing,
      actorId: user.id,
    });
  }

  /** Also serves as the IDOR guard: family must belong to the branch in the URL. */
  private async getOwnedOrThrow(branchId: string, familyId: string) {
    const family = await this.prisma.family.findUnique({ where: { id: familyId } });
    if (!family || family.branchId !== branchId) {
      throw new NotFoundException("Family not found");
    }
    return family;
  }

  private async getParentOrThrow(familyId: string, parentId: string) {
    const parent = await this.prisma.parent.findUnique({ where: { id: parentId } });
    if (!parent || parent.familyId !== familyId) {
      throw new NotFoundException("Parent not found");
    }
    return parent;
  }

  private async getTrustedPersonOrThrow(familyId: string, personId: string) {
    const person = await this.prisma.trustedPerson.findUnique({ where: { id: personId } });
    if (!person || person.familyId !== familyId) {
      throw new NotFoundException("Trusted person not found");
    }
    return person;
  }
}
