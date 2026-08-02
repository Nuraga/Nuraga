import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import type { DiscountBasis, DiscountKind } from "@prisma/client";

const DISCOUNT_BASES = [
  "SECOND_CHILD",
  "PREPAYMENT",
  "CORPORATE",
  "STAFF",
  "SOCIAL",
  "DIRECTOR_DECISION",
];
const DISCOUNT_KINDS = ["PERCENT", "FIXED_AMOUNT"];

// Exactly one of familyId (whole-family discount) or childId (single child)
// must be set, and PERCENT values must be <= 100 — both are cross-field
// rules checked in the service, not here.
export class CreateDiscountDto {
  @IsOptional()
  @IsUUID()
  familyId?: string;

  @IsOptional()
  @IsUUID()
  childId?: string;

  @IsIn(DISCOUNT_BASES)
  basis!: DiscountBasis;

  @IsIn(DISCOUNT_KINDS)
  kind!: DiscountKind;

  @IsInt()
  @Min(0)
  value!: number;

  // Required when basis is DIRECTOR_DECISION (ТЗ §6.3).
  @IsOptional()
  @IsString()
  reason?: string;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;
}
