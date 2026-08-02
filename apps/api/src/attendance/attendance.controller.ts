import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { AbsenceRequestStatus } from "@prisma/client";
import { AttendanceService } from "./attendance.service";
import { AbsenceRequestsService } from "./absence-requests.service";
import { MarkAttendanceDto } from "./dto/mark-attendance.dto";
import { RejectAbsenceRequestDto } from "./dto/reject-absence-request.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId")
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly absenceRequests: AbsenceRequestsService,
  ) {}

  @Post("children/:childId/attendance")
  mark(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("childId") childId: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.attendance.mark(user, branchId, childId, dto);
  }

  @Get("groups/:groupId/attendance")
  roster(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("groupId") groupId: string,
    @Query("date") date: string,
  ) {
    return this.attendance.getGroupRoster(user, branchId, groupId, date);
  }

  @Get("children/:childId/attendance")
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("childId") childId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.attendance.getChildHistory(user, branchId, childId, from, to);
  }

  @Get("absence-requests")
  listAbsenceRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Query("status") status?: AbsenceRequestStatus,
  ) {
    return this.absenceRequests.listForBranch(user, branchId, status);
  }

  @Post("absence-requests/:id/approve")
  approveAbsenceRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
  ) {
    return this.absenceRequests.approve(user, branchId, id);
  }

  @Post("absence-requests/:id/reject")
  rejectAbsenceRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("id") id: string,
    @Body() dto: RejectAbsenceRequestDto,
  ) {
    return this.absenceRequests.reject(user, branchId, id, dto);
  }
}
