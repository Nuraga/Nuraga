import { IsDateString, IsIn, IsNotEmpty, IsString, IsUUID } from "class-validator";

export const STAFF_ATTENDANCE_EVENT_TYPES = ["CHECK_IN", "CHECK_OUT"] as const;
export type StaffAttendanceEventTypeValue = (typeof STAFF_ATTENDANCE_EVENT_TYPES)[number];

export class CorrectStaffAttendanceDto {
  @IsUUID()
  staffId!: string;

  @IsIn(STAFF_ATTENDANCE_EVENT_TYPES)
  type!: StaffAttendanceEventTypeValue;

  @IsDateString()
  occurredAt!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
