import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";
import type { RecalcRule } from "@prisma/client";

const RECALC_RULES = ["NONE", "MEALS_ONLY", "FULL_DAY_WITH_THRESHOLD"];

// Deliberately excludes baseAmountMinor/currency/type — once a Contract
// references a tariff version, its financial terms are frozen (ТЗ §6.1).
// Create a new Tariff row for a new version instead.
export class UpdateTariffDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(RECALC_RULES)
  recalcRule?: RecalcRule;

  @IsOptional()
  @IsInt()
  @Min(1)
  recalcThresholdDays?: number;

  @IsOptional()
  @IsString()
  includesDescription?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
