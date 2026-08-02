import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateTrustedPersonDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsString()
  documentInfo?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
