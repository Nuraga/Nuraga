import { IsOptional, Matches } from "class-validator";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Omitted/null resets that side back to the network-wide default (see
// DEFAULT_CHECK_IN_TIME/DEFAULT_CHECK_OUT_TIME in staff-attendance.service.ts).
export class UpdateStaffScheduleDto {
  @IsOptional()
  @Matches(TIME_PATTERN, { message: "checkInTime must be in HH:MM format" })
  checkInTime?: string | null;

  @IsOptional()
  @Matches(TIME_PATTERN, { message: "checkOutTime must be in HH:MM format" })
  checkOutTime?: string | null;
}
