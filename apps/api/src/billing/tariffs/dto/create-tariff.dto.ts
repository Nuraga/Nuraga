import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";
import type { RecalcRule, RecurrencePeriod, TariffType } from "@prisma/client";

const TARIFF_TYPES = ["MONTHLY_FULL", "MONTHLY_HALF_DAY", "HOURLY", "PAY_AS_YOU_GO", "DUTY_GROUP"];
const RECURRENCE_PERIODS = ["MONTHLY", "ONE_TIME", "PER_VISIT"];
const RECALC_RULES = ["NONE", "MEALS_ONLY", "FULL_DAY_WITH_THRESHOLD"];

export class CreateTariffDto {
  // Omit for a network-wide tariff (сеть целиком); set for a branch-specific one.
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(TARIFF_TYPES)
  type!: TariffType;

  @IsInt()
  @Min(0)
  baseAmountMinor!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsIn(RECURRENCE_PERIODS)
  recurrence!: RecurrencePeriod;

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

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;
}
