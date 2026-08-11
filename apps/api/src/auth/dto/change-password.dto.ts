import { IsString, MinLength } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  oldPassword!: string;

  // Matches the MinLength used when an account is first provisioned
  // (CreateStaffDto, CreateParentAccountDto) — keep them in sync.
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
