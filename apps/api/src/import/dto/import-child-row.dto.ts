import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

// One CSV row = one family (with one parent) + one child, created onto the
// waitlist. Column contract (comma-delimited, UTF-8, header row required):
// family_name, child_full_name, child_birth_date, child_sex,
// parent_full_name, parent_relationship, parent_phone, parent_email
export class ImportChildRowDto {
  @IsString()
  @MinLength(1)
  familyName!: string;

  @IsString()
  @MinLength(1)
  childFullName!: string;

  @IsDateString()
  childBirthDate!: string;

  @IsOptional()
  @IsString()
  childSex?: string;

  @IsString()
  @MinLength(1)
  parentFullName!: string;

  @IsString()
  @MinLength(1)
  parentRelationship!: string;

  @IsOptional()
  @IsString()
  parentPhone?: string;

  @IsOptional()
  @IsEmail()
  parentEmail?: string;
}
