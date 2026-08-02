import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min } from "class-validator";

export class UpdateDiscountDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
