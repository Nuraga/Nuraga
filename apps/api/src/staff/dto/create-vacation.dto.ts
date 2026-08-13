import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateVacationDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
