import { BadRequestException, Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId/reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("occupancy")
  occupancy(@CurrentUser() user: AuthenticatedUser, @Param("branchId") branchId: string) {
    return this.reports.occupancy(user, branchId);
  }

  @Get("attendance-summary")
  attendanceSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("year") year?: string,
    @Query("month") month?: string,
    @Query("groupId") groupId?: string,
  ) {
    if (!year || !month) {
      throw new BadRequestException("year and month query params are required");
    }
    return this.reports.attendanceSummary(user, branchId, Number(year), Number(month), groupId);
  }

  @Get("waitlist")
  waitlist(@CurrentUser() user: AuthenticatedUser, @Param("branchId") branchId: string) {
    return this.reports.waitlistSummary(user, branchId);
  }
}
