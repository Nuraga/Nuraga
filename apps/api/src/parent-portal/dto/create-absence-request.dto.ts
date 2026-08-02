import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateAbsenceRequestDto {
  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
