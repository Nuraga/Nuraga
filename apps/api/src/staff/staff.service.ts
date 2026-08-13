import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { AuditService } from "../common/audit/audit.service";
import { PasswordService } from "../auth/password.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { TerminateStaffDto } from "./dto/terminate-staff.dto";

const STAFF_MANAGER_ROLES = ["OWNER", "BRANCH_MANAGER"] as const;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly audit: AuditService,
    private readonly password: PasswordService,
  ) {}

  async create(user: AuthenticatedUser, branchId: string, dto: CreateStaffDto) {
    this.branchScope.assertRoleInBranch(user, [...STAFF_MANAGER_ROLES], branchId);

    const staff = dto.userId
      ? await this.createForExistingUser(branchId, dto)
      : await this.createWithNewUser(branchId, dto);

    await this.audit.record({
      entity: "staff",
      entityId: staff.id,
      action: "create",
      newValue: staff,
      actorId: user.id,
    });
    return staff;
  }

  /** Links an already-existing account (e.g. a parent) to a new Staff record. */
  private async createForExistingUser(branchId: string, dto: CreateStaffDto) {
    const existing = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!existing) throw new NotFoundException("User not found");

    return this.prisma.staff.create({
      data: {
        userId: dto.userId!,
        branchId,
        position: dto.position,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined,
      },
    });
  }

  /**
   * Provisions a brand new account + branch role grant + Staff record
   * together — there is no other endpoint that creates staff user accounts.
   */
  private async createWithNewUser(branchId: string, dto: CreateStaffDto) {
    if (!dto.fullName || !dto.password || !dto.role) {
      throw new BadRequestException(
        "fullName, password, and role are required when userId is not provided",
      );
    }

    // Normalize "" to undefined — email/phone are @unique in schema.prisma,
    // and Postgres treats "" as a real (colliding) value, unlike NULL
    // (multiple NULLs are allowed under a unique constraint). Storing a
    // literal "" here would make every subsequent blank-email/-phone signup
    // fail with a unique-constraint error against the first one, which is
    // exactly what happened before this fix.
    const email = dto.email || undefined;
    const phone = dto.phone || undefined;

    if (!email && !phone) {
      throw new BadRequestException("email or phone is required to create a new account");
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

    return this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          fullName: dto.fullName!,
          email,
          phone,
          passwordHash,
        },
      });

      await tx.userBranchRole.create({
        data: { userId: newUser.id, branchId, role: dto.role! },
      });

      return tx.staff.create({
        data: {
          userId: newUser.id,
          branchId,
          position: dto.position,
          hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined,
        },
        include: { user: { select: { id: true, fullName: true, email: true } } },
      });
    });
  }

  async findAllForBranch(user: AuthenticatedUser, branchId: string, includeTerminated = false) {
    this.branchScope.assertBranchAccess(user, branchId);
    return this.prisma.staff.findMany({
      where: { branchId, ...(includeTerminated ? {} : { terminatedAt: null }) },
      include: { groups: true, user: { select: { id: true, fullName: true, email: true } } },
    });
  }

  /**
   * Dismissal — a soft delete (terminatedAt), never a hard delete, so
   * attendance/shift/audit history referencing this Staff row stays intact.
   * Also revokes this branch's role grant(s) so the account immediately
   * loses CRM access here; the User row itself (and any grants on other
   * branches, or a parent profile) is left untouched.
   */
  async terminate(user: AuthenticatedUser, branchId: string, staffId: string, dto: TerminateStaffDto) {
    this.branchScope.assertRoleInBranch(user, [...STAFF_MANAGER_ROLES], branchId);

    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.branchId !== branchId) {
      throw new NotFoundException("Staff member not found in this branch");
    }
    if (staff.terminatedAt) {
      throw new ConflictException("This staff member is already terminated");
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.staff.update({ where: { id: staffId }, data: { terminatedAt: new Date() } }),
      this.prisma.userBranchRole.deleteMany({ where: { userId: staff.userId, branchId } }),
    ]);

    await this.audit.record({
      entity: "staff",
      entityId: staffId,
      action: "update",
      newValue: { event: "terminated", reason: dto.reason ?? null },
      actorId: user.id,
    });

    return updated;
  }

  async assignGroup(user: AuthenticatedUser, branchId: string, staffId: string, groupId: string) {
    this.branchScope.assertRoleInBranch(user, [...STAFF_MANAGER_ROLES], branchId);
    await this.assertStaffInBranch(branchId, staffId);

    await this.prisma.staffGroup.upsert({
      where: { staffId_groupId: { staffId, groupId } },
      update: {},
      create: { staffId, groupId },
    });

    await this.audit.record({
      entity: "staff_group",
      entityId: `${staffId}:${groupId}`,
      action: "create",
      newValue: { staffId, groupId },
      actorId: user.id,
    });
  }

  async unassignGroup(
    user: AuthenticatedUser,
    branchId: string,
    staffId: string,
    groupId: string,
  ) {
    this.branchScope.assertRoleInBranch(user, [...STAFF_MANAGER_ROLES], branchId);
    await this.assertStaffInBranch(branchId, staffId);

    await this.prisma.staffGroup.deleteMany({ where: { staffId, groupId } });
    await this.audit.record({
      entity: "staff_group",
      entityId: `${staffId}:${groupId}`,
      action: "delete",
      actorId: user.id,
    });
  }

  private async assertStaffInBranch(branchId: string, staffId: string): Promise<void> {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.branchId !== branchId) {
      throw new NotFoundException("Staff member not found in this branch");
    }
  }
}
