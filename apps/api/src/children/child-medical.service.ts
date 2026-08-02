import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Role } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { BranchScopeService } from "../common/access/branch-scope.service";
import { TeacherScopeService } from "../common/access/teacher-scope.service";
import { EncryptionService } from "../common/crypto/encryption.service";
import { AuditService } from "../common/audit/audit.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { UpsertChildMedicalDto } from "./dto/upsert-child-medical.dto";

// Stricter than the general child-card matrix: TRD 2.2 shows Accountant as
// "—" (no access at all) for medical data, unlike the child-card row where
// Accountant gets read access. Owner/Branch Manager/Manager get full read;
// in the TRD matrix only the parent (ПР, Stage 4) can *write* it, but since
// the parent portal doesn't exist yet in Stage 1, staff must be able to
// enter medical data collected on paper during enrollment — so write access
// is granted to the same three roles for now.
const MEDICAL_FULL_ROLES: Role[] = ["OWNER", "BRANCH_MANAGER", "MANAGER"];

export type ChildMedicalView =
  | { level: "full"; allergies: string | null; chronic: string | null; activityLimits: string | null; doctorContact: string | null; criticalInfo: string | null }
  | { level: "critical_only"; criticalInfo: string | null };

@Injectable()
export class ChildMedicalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchScope: BranchScopeService,
    private readonly teacherScope: TeacherScopeService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
  ) {}

  async getForUser(
    user: AuthenticatedUser,
    branchId: string,
    childId: string,
  ): Promise<ChildMedicalView> {
    const child = await this.getOwnedChildOrThrow(branchId, childId);
    const record = await this.prisma.childMedical.findUnique({ where: { childId } });

    if (this.branchScope.hasAnyRoleInBranch(user, MEDICAL_FULL_ROLES, branchId)) {
      return {
        level: "full",
        allergies: this.encryption.decryptNullable(record?.allergiesEnc),
        chronic: this.encryption.decryptNullable(record?.chronicEnc),
        activityLimits: this.encryption.decryptNullable(record?.activityLimitsEnc),
        doctorContact: this.encryption.decryptNullable(record?.doctorContactEnc),
        criticalInfo: record?.criticalInfo ?? null,
      };
    }

    if (this.branchScope.hasRoleInBranch(user, "TEACHER", branchId) && child.groupId) {
      const assigned = await this.teacherScope.isAssignedToGroup(user.id, branchId, child.groupId);
      if (assigned) {
        return { level: "critical_only", criticalInfo: record?.criticalInfo ?? null };
      }
    }

    throw new ForbiddenException("No access to this child's medical data");
  }

  async upsert(
    user: AuthenticatedUser,
    branchId: string,
    childId: string,
    dto: UpsertChildMedicalDto,
  ) {
    this.branchScope.assertRoleInBranch(user, MEDICAL_FULL_ROLES, branchId);
    await this.getOwnedChildOrThrow(branchId, childId);

    const record = await this.prisma.childMedical.upsert({
      where: { childId },
      create: {
        childId,
        allergiesEnc: this.encryption.encryptNullable(dto.allergies),
        chronicEnc: this.encryption.encryptNullable(dto.chronic),
        activityLimitsEnc: this.encryption.encryptNullable(dto.activityLimits),
        doctorContactEnc: this.encryption.encryptNullable(dto.doctorContact),
        criticalInfo: dto.criticalInfo,
      },
      update: {
        ...(dto.allergies !== undefined && { allergiesEnc: this.encryption.encryptNullable(dto.allergies) }),
        ...(dto.chronic !== undefined && { chronicEnc: this.encryption.encryptNullable(dto.chronic) }),
        ...(dto.activityLimits !== undefined && {
          activityLimitsEnc: this.encryption.encryptNullable(dto.activityLimits),
        }),
        ...(dto.doctorContact !== undefined && {
          doctorContactEnc: this.encryption.encryptNullable(dto.doctorContact),
        }),
        ...(dto.criticalInfo !== undefined && { criticalInfo: dto.criticalInfo }),
      },
    });

    // Never write medical plaintext into the audit log — record only that
    // an update happened and which fields changed.
    await this.audit.record({
      entity: "child_medical",
      entityId: childId,
      action: "update",
      newValue: { fieldsUpdated: Object.keys(dto) },
      actorId: user.id,
    });

    return record;
  }

  private async getOwnedChildOrThrow(branchId: string, childId: string) {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child) throw new NotFoundException("Child not found");

    const family = await this.prisma.family.findUnique({ where: { id: child.familyId } });
    if (!family || family.branchId !== branchId) {
      throw new NotFoundException("Child not found");
    }
    return child;
  }
}
