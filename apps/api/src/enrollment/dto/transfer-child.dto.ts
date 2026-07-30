import { IsBoolean, IsDateString, IsOptional, IsUUID } from "class-validator";

export class TransferChildDto {
  @IsUUID()
  toGroupId!: string;

  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @IsOptional()
  @IsBoolean()
  confirmOverride?: boolean;
}
