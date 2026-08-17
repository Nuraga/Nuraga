import { Module } from "@nestjs/common";
import { StaffAttendanceController } from "./staff-attendance.controller";
import { StaffCheckinService } from "./staff-checkin.service";
import { StaffAttendanceService } from "./staff-attendance.service";
import { StaffAttendanceAutoCloseService } from "./staff-attendance-auto-close.service";
import { AuthModule } from "../auth/auth.module";
import { DevicesModule } from "../devices/devices.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [AuthModule, DevicesModule, NotificationsModule],
  controllers: [StaffAttendanceController],
  providers: [StaffCheckinService, StaffAttendanceService, StaffAttendanceAutoCloseService],
  exports: [StaffCheckinService, StaffAttendanceService],
})
export class StaffAttendanceModule {}
