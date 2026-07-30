import { IsOptional, IsString } from "class-validator";

export class UpsertChildMedicalDto {
  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  chronic?: string;

  @IsOptional()
  @IsString()
  activityLimits?: string;

  @IsOptional()
  @IsString()
  doctorContact?: string;

  // Plain-text summary shown to teachers (allergies/diet only) — not encrypted.
  @IsOptional()
  @IsString()
  criticalInfo?: string;
}
