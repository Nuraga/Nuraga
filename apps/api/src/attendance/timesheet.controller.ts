import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { TimesheetService } from "./timesheet.service";
import { CorrectAttendanceDto } from "./dto/correct-attendance.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";

@UseGuards(JwtAuthGuard)
@Controller("branches/:branchId")
export class TimesheetController {
  constructor(private readonly timesheet: TimesheetService) {}

  @Get("timesheet-periods")
  list(@CurrentUser() user: AuthenticatedUser, @Param("branchId") branchId: string) {
    return this.timesheet.listPeriods(user, branchId);
  }

  @Post("timesheet-periods/:year/:month/close")
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("year") year: string,
    @Param("month") month: string,
  ) {
    return this.timesheet.closePeriod(user, branchId, Number(year), Number(month));
  }

  @Post("attendance/:attendanceId/correct")
  correct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("attendanceId") attendanceId: string,
    @Body() dto: CorrectAttendanceDto,
  ) {
    return this.timesheet.correctAttendance(user, branchId, attendanceId, dto);
  }
}
