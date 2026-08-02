import { IsDateString, IsEmail, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  parentFullName?: string;

  @IsOptional()
  @IsString()
  parentPhone?: string;

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

  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @IsOptional()
  @IsString()
  utmSource?: string;

  @IsOptional()
  @IsString()
  utmMedium?: string;

  @IsOptional()
  @IsString()
  utmCampaign?: string;
}
