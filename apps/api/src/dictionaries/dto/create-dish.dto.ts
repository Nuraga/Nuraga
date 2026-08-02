import { IsArray, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateDishDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  allergenIds?: string[];
}
