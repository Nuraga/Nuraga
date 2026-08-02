import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

// One CSV row = one Lead in stage NEW. Column contract (comma-delimited,
// UTF-8, header row required): parent_full_name, parent_phone,
// parent_email, child_full_name, child_birth_date, target_date,
// source_name, responsible_email.
// source_name/responsible_email are resolved against LeadSource/User by
// name/email in LeadsImportService — not validated as UUIDs here since a
// CSV author can't know internal ids.
export class ImportLeadRowDto {
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
  @IsString()
  sourceName?: string;

  @IsEmail()
  responsibleEmail!: string;
}
