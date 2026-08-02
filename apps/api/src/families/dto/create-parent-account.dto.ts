import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

// email/phone default to the Parent row's existing contact fields when
// omitted — see FamiliesService.provisionParentAccount.
export class CreateParentAccountDto {
  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
