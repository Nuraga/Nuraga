import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { StaffCheckinService } from "./staff-checkin.service";
import { StaffAttendanceService } from "./staff-attendance.service";
import { CorrectStaffAttendanceDto } from "./dto/correct-staff-attendance.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DeviceAuthGuard } from "../devices/device-auth.guard";
import { CurrentUser } from "../common/access/current-user.decorator";
import { CurrentDevice } from "../devices/current-device.decorator";
import type { AuthenticatedUser } from "../common/access/branch-access.types";
import type { AuthenticatedDevice } from "../devices/device.types";

@Controller("branches/:branchId")
export class StaffAttendanceController {
  constructor(
    private readonly checkin: StaffCheckinService,
    private readonly attendance: StaffAttendanceService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get("staff/me/checkin-token")
  issueCheckinToken(@CurrentUser() user: AuthenticatedUser, @Param("branchId") branchId: string) {
    return this.checkin.issueToken(user, branchId);
  }

  @UseGuards(DeviceAuthGuard)
  @Post("kiosk/scan")
  scan(
    @CurrentDevice() device: AuthenticatedDevice,
    @Param("branchId") branchId: string,
    @Body("token") token: string,
  ) {
    return this.attendance.recordScan(device, branchId, token);
  }

  @UseGuards(JwtAuthGuard)
  @Get("staff-attendance/present")
  whoIsPresent(@CurrentUser() user: AuthenticatedUser, @Param("branchId") branchId: string) {
    return this.attendance.whoIsPresent(user, branchId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("staff/:staffId/attendance-events")
  listForStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Param("staffId") staffId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.attendance.listForStaff(user, branchId, staffId, { from, to });
  }

  @UseGuards(JwtAuthGuard)
  @Post("staff-attendance/correct")
  correct(
    @CurrentUser() user: AuthenticatedUser,
    @Param("branchId") branchId: string,
    @Body() dto: CorrectStaffAttendanceDto,
  ) {
    return this.attendance.correctEvent(user, branchId, dto);
  }
}
