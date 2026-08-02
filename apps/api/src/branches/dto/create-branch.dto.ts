import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateBranchDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
