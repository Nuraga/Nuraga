import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class DischargeChildDto {
  @IsUUID()
  dischargeReasonId!: string;

  @IsOptional()
  @IsDateString()
  effectiveAt?: string;
}
