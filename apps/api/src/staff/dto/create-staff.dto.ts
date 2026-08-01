import { IsDateString, IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
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

  @IsOptional()
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
  @IsIn(["BRANCH_MANAGER", "MANAGER", "ACCOUNTANT", "TEACHER"])
  role?: Role;

  @IsString()
  @MinLength(1)
  position!: string;

  @IsOptional()
  @IsDateString()
  hiredAt?: string;
}
