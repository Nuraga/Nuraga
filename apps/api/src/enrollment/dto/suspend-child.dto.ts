import { IsDateString, IsOptional, IsString } from "class-validator";

export class SuspendChildDto {
  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
