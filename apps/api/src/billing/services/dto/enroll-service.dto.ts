import { IsDateString, IsOptional } from "class-validator";

export class EnrollServiceDto {
  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
