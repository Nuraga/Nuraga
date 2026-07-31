import { IsDateString, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { AttendanceStatus } from "@prisma/client";
import type { PickedUpByType } from "./mark-attendance.dto";

export class CorrectAttendanceDto {
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

  @IsOptional()
  @IsUUID()
  pickedUpById?: string;

  @IsOptional()
  @IsIn(["parent", "trusted_person"])
  pickedUpByType?: PickedUpByType;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
