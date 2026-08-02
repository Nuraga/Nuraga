import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateTrustedPersonDto {
  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsOptional()
  @IsString()
  documentInfo?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
