import { IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class UpdateParentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  relationship?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  contactPriority?: number;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
