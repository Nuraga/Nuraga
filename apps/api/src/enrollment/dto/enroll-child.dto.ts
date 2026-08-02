import { IsBoolean, IsDateString, IsOptional, IsUUID } from "class-validator";

export class EnrollChildDto {
  @IsUUID()
  groupId!: string;

  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @IsOptional()
  @IsBoolean()
  confirmOverride?: boolean;
}
