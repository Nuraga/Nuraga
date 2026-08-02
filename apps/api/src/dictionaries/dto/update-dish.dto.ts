import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class UpdateDishDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  allergenIds?: string[];
}
