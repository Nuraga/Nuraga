import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateChildDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  sex?: string;

  @IsOptional()
  @IsString()
  photoKey?: string;
}
