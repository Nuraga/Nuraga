import { IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateParentDto {
  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsString()
  @MinLength(1)
  relationship!: string;

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
