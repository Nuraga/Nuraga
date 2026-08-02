import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

export class CreateLeadDto {
  @IsString()
  @MinLength(1)
  parentFullName!: string;

  @IsString()
  @MinLength(1)
  parentPhone!: string;

  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @IsOptional()
  @IsString()
  childFullName?: string;

  @IsOptional()
  @IsDateString()
  childBirthDate?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsUUID()
  sourceId?: string;

  @IsUUID()
  responsibleUserId!: string;

  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmMedium?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;

  // Set true to bypass the cross-branch phone-duplicate safety check (ТЗ
  // §3.1) after the caller has already shown the user the duplicate(s) via
  // GET /leads/duplicates and they chose to create a new lead anyway.
  @IsOptional()
  @IsBoolean()
  confirmDuplicate?: boolean;
}
