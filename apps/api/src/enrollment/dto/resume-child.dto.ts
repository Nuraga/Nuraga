import { IsBoolean, IsDateString, IsOptional } from "class-validator";

export class ResumeChildDto {
  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @IsOptional()
  @IsBoolean()
  confirmOverride?: boolean;
}
