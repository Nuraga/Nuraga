import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from "class-validator";
import { AttendanceStatus } from "@prisma/client";

export type PickedUpByType = "parent" | "trusted_person";

export class MarkAttendanceDto {
  @IsDateString()
  date!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

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
}
