import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { ChildAccessService } from "../children/child-access.service";
import { EnrollmentService } from "./enrollment.service";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import { PromoteGroupDto } from "./dto/promote-group.dto";

export interface PromotionResult {
  total: number;
  succeeded: string[];
  failed: { childId: string; error: string }[];
}

// TRD 4.3: annual mass promotion — "a wizard that moves groups up a level
// with a single confirmation, and discharges graduates with reason
// 'выпуск'". The confirmation *is* this endpoint call; each child is still
// processed (and capacity-checked) individually through EnrollmentService
// so the per-child invariants and audit trail stay identical to a manual
// transfer/discharge — a batch just doesn't get a second confirmation click
// per child.
@Injectable()
export class PromotionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly childAccess: ChildAccessService,
    private readonly enrollment: EnrollmentService,
  ) {}

  async promoteGroup(
    user: AuthenticatedUser,
    branchId: string,
    fromGroupId: string,
    dto: PromoteGroupDto,
  ): Promise<PromotionResult> {
    this.childAccess.assertWriteAccess(user, branchId);

    const hasTarget = Boolean(dto.toGroupId);
    const hasReason = Boolean(dto.dischargeReasonId);
    if (hasTarget === hasReason) {
      throw new BadRequestException(
        "Provide exactly one of toGroupId (promote) or dischargeReasonId (graduate)",
      );
    }

    const fromGroup = await this.prisma.group.findUnique({ where: { id: fromGroupId } });
    if (!fromGroup || fromGroup.branchId !== branchId) {
      throw new NotFoundException("Group not found in this branch");
    }

    const children = await this.prisma.child.findMany({
      where: { groupId: fromGroupId, status: "ENROLLED" },
    });

    const result: PromotionResult = { total: children.length, succeeded: [], failed: [] };

    for (const child of children) {
      try {
        if (dto.toGroupId) {
          await this.enrollment.transfer(user, branchId, child.id, {
            toGroupId: dto.toGroupId,
            confirmOverride: true,
          });
        } else {
          await this.enrollment.discharge(user, branchId, child.id, {
            dischargeReasonId: dto.dischargeReasonId!,
          });
        }
        result.succeeded.push(child.id);
      } catch (err) {
        result.failed.push({ childId: child.id, error: (err as Error).message });
      }
    }

    return result;
  }
}
