import { IsDateString, IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from "class-validator";
import type { Role } from "@prisma/client";

// Exactly one of the two shapes must be given: userId links an existing
// account to a new Staff record (e.g. a parent taking a staff position);
// the fullName/email|phone/password/role fields provision a brand new
// account + branch role grant + Staff record together, since there was no
// other way to create a staff user account at all (see StaffService).
export class CreateStaffDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  // class-validator's @IsOptional() only exempts null/undefined, not "" —
  // and the frontend form sends "" for an untouched/cleared field. Without
  // @ValidateIf, an empty email fails @IsEmail() with a confusing "email
  // must be an email" even though the whole point is email is optional
  // (email-or-phone is enforced separately, see StaffService).
  @ValidateIf((o: CreateStaffDto) => o.email !== undefined && o.email !== "")
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsIn(["BRANCH_MANAGER", "MANAGER", "ACCOUNTANT", "TEACHER", "NANNY", "METHODIST"])
  role?: Role;

  @IsString()
  @MinLength(1)
  position!: string;

  @IsOptional()
  @IsDateString()
  hiredAt?: string;
}
