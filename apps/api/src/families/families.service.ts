import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import { PasswordService } from "../auth/password.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateFamilyDto } from "./dto/create-family.dto";
import { UpdateFamilyDto } from "./dto/update-family.dto";
import { CreateParentDto } from "./dto/create-parent.dto";
import { UpdateParentDto } from "./dto/update-parent.dto";
import { CreateTrustedPersonDto } from "./dto/create-trusted-person.dto";
import { UpdateTrustedPersonDto } from "./dto/update-trusted-person.dto";
import { CreateParentAccountDto } from "./dto/create-parent-account.dto";

// Family list/detail is a branch-office operation, not a teacher one — a
// teacher works through Children (own group), never by browsing families
// (TRD 2.2 has no "browse all families" grant for Воспитатель). METHODIST
// was added here on explicit owner request (2026-08-25, not in TRD 2.2/16.3)
// so a методист can register new families/parents at intake, same bracket
// as MANAGER — read + create/edit, no delete.
const FAMILY_READ_ROLES = ["OWNER", "BRANCH_MANAGER", "MANAGER", "ACCOUNTANT", "METHODIST"] as const;
const FAMILY_WRITE_ROLES = ["OWNER", "BRANCH_MANAGER", "MANAGER", "METHODIST"] as const;
// Archiving (soft delete) a family that already has children, contracts,
// invoices or payments attached is a bigger call than plain data entry —
// same distinction the TRD matrix draws between MANAGER's ПСР and
// OWNER/BRANCH_MANAGER's У. A METHODIST (and MANAGER) can only archive an
// empty family (e.g. one created by mistake); restoring is always
// OWNER/BRANCH_MANAGER, same as the force-archive path.
const FAMILY_ARCHIVE_FORCE_ROLES = ["OWNER", "BRANCH_MANAGER"] as const;

@Injectable()
export class FamiliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
    private readonly password: PasswordService,
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

  async findAllForBranch(
    user: AuthenticatedUser,
    branchId: string,
    search?: string,
    archived?: boolean,
  ) {
    this.branchScope.assertRoleInBranch(user, [...FAMILY_READ_ROLES], branchId);

    return this.prisma.family.findMany({
      where: {
        branchId,
        // Default view is "active only" — archived families stay out of
        // the way of everyday search/list unless explicitly requested.
        archivedAt: archived ? { not: null } : null,
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

  /**
   * Soft-deletes a family. Archiving one that already has children,
   * contracts, invoices or payments requires OWNER/BRANCH_MANAGER — a
   * METHODIST/MANAGER can only clean up an empty family (e.g. a duplicate
   * or a mis-entered one), never one with real history attached.
   */
  async archive(user: AuthenticatedUser, branchId: string, id: string) {
    this.branchScope.assertRoleInBranch(user, [...FAMILY_WRITE_ROLES], branchId);
    const existing = await this.getOwnedOrThrow(branchId, id);
    if (existing.archivedAt) throw new ConflictException("Family is already archived");

    const [childCount, contractCount, invoiceCount, paymentCount] = await Promise.all([
      this.prisma.child.count({ where: { familyId: id } }),
      this.prisma.contract.count({ where: { familyId: id } }),
      this.prisma.invoice.count({ where: { familyId: id } }),
      this.prisma.payment.count({ where: { familyId: id } }),
    ]);
    const hasHistory = childCount + contractCount + invoiceCount + paymentCount > 0;

    if (hasHistory && !this.branchScope.hasAnyRoleInBranch(user, [...FAMILY_ARCHIVE_FORCE_ROLES], branchId)) {
      throw new ForbiddenException(
        "This family has children, contracts, invoices or payments — only OWNER/BRANCH_MANAGER can archive it",
      );
    }

    const family = await this.prisma.family.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    await this.audit.record({
      entity: "family",
      entityId: id,
      action: "update",
      oldValue: { archivedAt: null },
      newValue: { event: "archive", archivedAt: family.archivedAt },
      actorId: user.id,
    });
    return family;
  }

  async restore(user: AuthenticatedUser, branchId: string, id: string) {
    this.branchScope.assertRoleInBranch(user, [...FAMILY_ARCHIVE_FORCE_ROLES], branchId);
    const existing = await this.getOwnedOrThrow(branchId, id);
    if (!existing.archivedAt) throw new ConflictException("Family is not archived");

    const family = await this.prisma.family.update({
      where: { id },
      data: { archivedAt: null },
    });
    await this.audit.record({
      entity: "family",
      entityId: id,
      action: "update",
      oldValue: { archivedAt: existing.archivedAt },
      newValue: { event: "restore", archivedAt: null },
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
    const family = await this.getOwnedOrThrow(branchId, familyId);
    if (family.archivedAt) throw new ConflictException("Family is archived — restore it first");

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

  /**
   * Provisions a login for an existing Parent row (родитель gets access to
   * the parent portal). Unlike StaffService's equivalent, this never grants
   * a UserBranchRole — parents are scoped to their family via Parent.userId,
   * not a branch role (see ParentAccessService).
   */
  async provisionParentAccount(
    user: AuthenticatedUser,
    branchId: string,
    familyId: string,
    parentId: string,
    dto: CreateParentAccountDto,
  ) {
    this.branchScope.assertRoleInBranch(user, [...FAMILY_WRITE_ROLES], branchId);
    await this.getOwnedOrThrow(branchId, familyId);
    const parent = await this.getParentOrThrow(familyId, parentId);

    if (parent.userId) {
      throw new ConflictException("This parent already has an account");
    }

    // `||` (not `??`) deliberately — an explicit "" from an untouched form
    // field must also fall through to the parent's contact info, same
    // reasoning as the email/phone normalization in StaffService.
    const email = dto.email || parent.email || undefined;
    const phone = dto.phone || parent.phone || undefined;
    if (!email && !phone) {
      throw new BadRequestException(
        "email or phone is required — provide one or add it to the parent's contact info first",
      );
    }

    if (email) {
      const emailTaken = await this.prisma.user.findUnique({ where: { email } });
      if (emailTaken) throw new ConflictException("A user with this email already exists");
    }
    if (phone) {
      const phoneTaken = await this.prisma.user.findUnique({ where: { phone } });
      if (phoneTaken) throw new ConflictException("A user with this phone already exists");
    }

    const passwordHash = await this.password.hash(dto.password);

    const updatedParent = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { fullName: parent.fullName, email, phone, passwordHash },
      });
      return tx.parent.update({
        where: { id: parentId },
        data: { userId: newUser.id },
        include: { user: { select: { id: true, email: true, phone: true } } },
      });
    });

    await this.audit.record({
      entity: "parent",
      entityId: parentId,
      action: "update",
      oldValue: { userId: null },
      newValue: { event: "provision_account", userId: updatedParent.userId },
      actorId: user.id,
    });
    return updatedParent;
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
