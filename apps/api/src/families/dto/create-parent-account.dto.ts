import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from "class-validator";

// email/phone default to the Parent row's existing contact fields when
// omitted — see FamiliesService.provisionParentAccount.
export class CreateParentAccountDto {
  @IsString()
  @MinLength(6)
  password!: string;

  // @IsOptional() alone only exempts null/undefined, not "" — an
  // untouched/cleared form field sends "", which would otherwise fail
  // @IsEmail() with a confusing error despite email being optional here.
  @ValidateIf((o: CreateParentAccountDto) => o.email !== undefined && o.email !== "")
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
