import { Module } from "@nestjs/common";
import { StaffAttendanceController } from "./staff-attendance.controller";
import { StaffCheckinService } from "./staff-checkin.service";
import { StaffAttendanceService } from "./staff-attendance.service";
import { AuthModule } from "../auth/auth.module";
import { DevicesModule } from "../devices/devices.module";

@Module({
  imports: [AuthModule, DevicesModule],
  controllers: [StaffAttendanceController],
  providers: [StaffCheckinService, StaffAttendanceService],
  exports: [StaffCheckinService, StaffAttendanceService],
})
export class StaffAttendanceModule {}
