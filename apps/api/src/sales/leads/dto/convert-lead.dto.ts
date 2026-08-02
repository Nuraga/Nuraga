import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from "class-validator";

// Final step of the conversion wizard (ТЗ §3.2/§4.4) — creates Family +
// Parent + Child (+ Contract) in one transaction. Fields are pre-filled from
// the Lead on the frontend but re-submitted here since the staff member may
// have corrected them during the wizard.
export class ConvertLeadDto {
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

  @IsString()
  @MinLength(1)
  childFullName!: string;

  @IsDateString()
  childBirthDate!: string;

  @IsOptional()
  @IsString()
  childSex?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsUUID()
  tariffId!: string;

  @IsString()
  @MinLength(1)
  contractNumber!: string;

  @IsDateString()
  contractStartDate!: string;

  // Same meaning as EnrollChildDto.confirmOverride — confirms enrolling
  // past the target group's max capacity (ТЗ §4.3).
  @IsOptional()
  @IsBoolean()
  confirmOverride?: boolean;
}
