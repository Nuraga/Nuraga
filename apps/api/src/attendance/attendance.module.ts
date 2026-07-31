import { Module } from "@nestjs/common";
import { AttendanceController } from "./attendance.controller";
import { TimesheetController } from "./timesheet.controller";
import { AttendanceService } from "./attendance.service";
import { TimesheetService } from "./timesheet.service";
import { AttendanceAccessService } from "./attendance-access.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [AttendanceController, TimesheetController],
  providers: [AttendanceService, TimesheetService, AttendanceAccessService],
  exports: [AttendanceService, TimesheetService],
})
export class AttendanceModule {}
