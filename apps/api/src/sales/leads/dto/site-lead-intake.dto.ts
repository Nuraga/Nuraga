import { IsDateString, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

// Fields a public website contact form can reasonably supply — no
// sourceId/responsibleUserId (LeadsService.siteIntake resolves those
// itself) and no confirmDuplicate (an anonymous submitter can't be shown
// another family's data to decide on).
export class SiteLeadIntakeDto {
  @IsUUID()
  branchId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  parentFullName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  parentPhone!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  parentEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  childFullName?: string;

  @IsOptional()
  @IsDateString()
  childBirthDate?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmMedium?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  utmCampaign?: string;
}
