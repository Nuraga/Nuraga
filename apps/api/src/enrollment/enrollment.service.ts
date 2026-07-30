import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { ChildStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { ChildAccessService } from "../children/child-access.service";
import { GroupCapacityService } from "../groups/group-capacity.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { EnrollChildDto } from "./dto/enroll-child.dto";
import { TransferChildDto } from "./dto/transfer-child.dto";
import { SuspendChildDto } from "./dto/suspend-child.dto";
import { ResumeChildDto } from "./dto/resume-child.dto";
import { DischargeChildDto } from "./dto/discharge-child.dto";

// Stage 1 has no job scheduler (no Redis/BullMQ dependency for this yet), so
// lifecycle changes apply immediately rather than on a future effective
// date — the TRD's "не задним числом" requirement is honored (nothing is
// backdated past today), but a *future*-dated change would need a cron to
// actually apply itself later, which is out of scope for Stage 1. We still
// record whatever effectiveAt the caller supplies for the history entry.
function resolveEffectiveAt(effectiveAt?: string): Date {
  const date = effectiveAt ? new Date(effectiveAt) : new Date();
  if (date.getTime() > Date.now() + 60_000) {
    throw new BadRequestException(
      "Future-dated changes aren't supported yet — this Stage has no scheduler to apply them later",
    );
  }
  return date;
}

@Injectable()
export class EnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly childAccess: ChildAccessService,
    private readonly capacity: GroupCapacityService,
    private readonly audit: AuditService,
  ) {}

  async enroll(user: AuthenticatedUser, branchId: string, childId: string, dto: EnrollChildDto) {
    this.childAccess.assertWriteAccess(user, branchId);
    const child = await this.getChildInBranch(branchId, childId);
    this.assertStatus(child.status, ["WAITLIST"], "enroll");

    const group = await this.getGroupInBranch(branchId, dto.groupId);
    const effectiveAt = resolveEffectiveAt(dto.effectiveAt);

    await this.capacity.assertCanEnroll(user, branchId, group.id, dto.confirmOverride ?? false);

    const updated = await this.prisma.child.update({
      where: { id: childId },
      data: { status: "ENROLLED", groupId: group.id, enrolledAt: effectiveAt },
    });

    await this.prisma.waitlistEntry.deleteMany({ where: { childId } });

    await this.recordHistory(childId, "enroll", null, group.id, effectiveAt, user.id);
    await this.audit.record({
      entity: "child",
      entityId: childId,
      action: "update",
      newValue: { event: "enroll", groupId: group.id },
      actorId: user.id,
    });

    return updated;
  }

  async transfer(
    user: AuthenticatedUser,
    branchId: string,
    childId: string,
    dto: TransferChildDto,
  ) {
    this.childAccess.assertWriteAccess(user, branchId);
    const child = await this.getChildInBranch(branchId, childId);
    this.assertStatus(child.status, ["ENROLLED"], "transfer");

    const toGroup = await this.getGroupInBranch(branchId, dto.toGroupId);
    if (toGroup.id === child.groupId) {
      throw new BadRequestException("Child is already in this group");
    }
    const effectiveAt = resolveEffectiveAt(dto.effectiveAt);

    await this.capacity.assertCanEnroll(user, branchId, toGroup.id, dto.confirmOverride ?? false);

    const fromGroupId = child.groupId;
    const updated = await this.prisma.child.update({
      where: { id: childId },
      data: { groupId: toGroup.id },
    });

    await this.recordHistory(childId, "transfer", fromGroupId, toGroup.id, effectiveAt, user.id);
    await this.audit.record({
      entity: "child",
      entityId: childId,
      action: "update",
      oldValue: { groupId: fromGroupId },
      newValue: { event: "transfer", groupId: toGroup.id },
      actorId: user.id,
    });

    return updated;
  }

  async suspend(
    user: AuthenticatedUser,
    branchId: string,
    childId: string,
    dto: SuspendChildDto,
  ) {
    this.childAccess.assertWriteAccess(user, branchId);
    const child = await this.getChildInBranch(branchId, childId);
    this.assertStatus(child.status, ["ENROLLED"], "suspend");

    const effectiveAt = resolveEffectiveAt(dto.effectiveAt);
    const updated = await this.prisma.child.update({
      where: { id: childId },
      data: { status: "SUSPENDED", suspendedAt: effectiveAt },
    });

    await this.recordHistory(
      childId,
      "suspend",
      child.groupId,
      child.groupId,
      effectiveAt,
      user.id,
      dto.reason,
    );
    await this.audit.record({
      entity: "child",
      entityId: childId,
      action: "update",
      newValue: { event: "suspend" },
      actorId: user.id,
    });

    return updated;
  }

  async resume(user: AuthenticatedUser, branchId: string, childId: string, dto: ResumeChildDto) {
    this.childAccess.assertWriteAccess(user, branchId);
    const child = await this.getChildInBranch(branchId, childId);
    this.assertStatus(child.status, ["SUSPENDED"], "resume");

    if (!child.groupId) {
      throw new BadRequestException("Child has no group to resume into — use enroll instead");
    }
    const effectiveAt = resolveEffectiveAt(dto.effectiveAt);

    // The seat may have filled up while the child was suspended.
    await this.capacity.assertCanEnroll(user, branchId, child.groupId, dto.confirmOverride ?? false);

    const updated = await this.prisma.child.update({
      where: { id: childId },
      data: { status: "ENROLLED", suspendedAt: null },
    });

    await this.recordHistory(
      childId,
      "resume",
      child.groupId,
      child.groupId,
      effectiveAt,
      user.id,
    );
    await this.audit.record({
      entity: "child",
      entityId: childId,
      action: "update",
      newValue: { event: "resume" },
      actorId: user.id,
    });

    return updated;
  }

  async discharge(
    user: AuthenticatedUser,
    branchId: string,
    childId: string,
    dto: DischargeChildDto,
  ) {
    this.childAccess.assertWriteAccess(user, branchId);
    const child = await this.getChildInBranch(branchId, childId);
    this.assertStatus(child.status, ["WAITLIST", "ENROLLED", "SUSPENDED"], "discharge");

    const reason = await this.prisma.dischargeReason.findUnique({
      where: { id: dto.dischargeReasonId },
    });
    if (!reason) throw new BadRequestException("Unknown discharge reason");

    const effectiveAt = resolveEffectiveAt(dto.effectiveAt);
    const fromGroupId = child.groupId;

    const updated = await this.prisma.child.update({
      where: { id: childId },
      data: {
        status: "DISCHARGED",
        discharedAt: effectiveAt,
        dischargeReasonId: reason.id,
        groupId: null,
      },
    });

    await this.prisma.waitlistEntry.deleteMany({ where: { childId } });

    await this.recordHistory(
      childId,
      "discharge",
      fromGroupId,
      null,
      effectiveAt,
      user.id,
      reason.name,
    );
    await this.audit.record({
      entity: "child",
      entityId: childId,
      action: "update",
      newValue: { event: "discharge", reason: reason.name },
      actorId: user.id,
    });

    return updated;
  }

  private assertStatus(current: ChildStatus, allowed: ChildStatus[], op: string): void {
    if (!allowed.includes(current)) {
      throw new BadRequestException(
        `Cannot ${op} a child in status ${current} (expected one of: ${allowed.join(", ")})`,
      );
    }
  }

  private async getChildInBranch(branchId: string, childId: string) {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child) throw new NotFoundException("Child not found");

    const family = await this.prisma.family.findUnique({ where: { id: child.familyId } });
    if (!family || family.branchId !== branchId) {
      throw new NotFoundException("Child not found");
    }
    return child;
  }

  private async getGroupInBranch(branchId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.branchId !== branchId) {
      throw new NotFoundException("Group not found in this branch");
    }
    return group;
  }

  private async recordHistory(
    childId: string,
    type: string,
    fromGroupId: string | null,
    toGroupId: string | null,
    effectiveAt: Date,
    actorUserId: string,
    reason?: string,
  ) {
    await this.prisma.childHistoryEntry.create({
      data: { childId, type, fromGroupId, toGroupId, effectiveAt, actorUserId, reason },
    });
  }
}
