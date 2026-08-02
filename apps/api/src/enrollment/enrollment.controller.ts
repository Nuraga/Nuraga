import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { EnrollmentService } from "./enrollment.service";
import { PromotionService } from "./promotion.service";
import { EnrollChildDto } from "./dto/enroll-child.dto";
import { TransferChildDto } from "./dto/transfer-child.dto";
import { SuspendChildDto } from "./dto/suspend-child.dto";
import { ResumeChildDto } from "./dto/resume-child.dto";
import { DischargeChildDto } from "./dto/discharge-child.dto";
import { PromoteGroupDto } from "./dto/promote-group.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId")
export class EnrollmentController {
  constructor(
    private readonly enrollment: EnrollmentService,
    private readonly promotion: PromotionService,
  ) {}

  @Post("children/:id/enroll")
  enroll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: EnrollChildDto,
  ) {
    return this.enrollment.enroll(user, branchId, id, dto);
  }

  @Post("children/:id/transfer")
  transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: TransferChildDto,
  ) {
    return this.enrollment.transfer(user, branchId, id, dto);
  }

  @Post("children/:id/suspend")
  suspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: SuspendChildDto,
  ) {
    return this.enrollment.suspend(user, branchId, id, dto);
  }

  @Post("children/:id/resume")
  resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: ResumeChildDto,
  ) {
    return this.enrollment.resume(user, branchId, id, dto);
  }

  @Post("children/:id/discharge")
  discharge(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: DischargeChildDto,
  ) {
    return this.enrollment.discharge(user, branchId, id, dto);
  }

  @Post("groups/:groupId/promote")
  promote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("groupId") groupId: string,
    @Body() dto: PromoteGroupDto,
  ) {
    return this.promotion.promoteGroup(user, branchId, groupId, dto);
  }
}
