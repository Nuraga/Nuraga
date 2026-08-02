import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

// Deliberately excludes status/groupId: a child is always created onto the
// waitlist (status defaults WAITLIST, no group). Enrollment/transfer are
// separate operations with their own capacity checks and audit trail
// (Milestone 5), not a raw field edit here.
export class CreateChildDto {
  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsDateString()
  birthDate!: string;

  @IsOptional()
  @IsString()
  sex?: string;
}
