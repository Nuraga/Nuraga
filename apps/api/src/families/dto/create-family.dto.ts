import { IsString, MinLength } from "class-validator";

export class CreateFamilyDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
