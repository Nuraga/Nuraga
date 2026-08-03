import { IsDateString, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateShiftDto {
  @IsUUID()
  staffId!: string;

  @IsDateString()
  date!: string;

  @Matches(TIME_PATTERN, { message: "startTime must be in HH:MM format" })
  startTime!: string;

  @Matches(TIME_PATTERN, { message: "endTime must be in HH:MM format" })
  endTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
