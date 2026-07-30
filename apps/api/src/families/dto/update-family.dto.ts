import { IsString, MinLength } from "class-validator";

export class UpdateFamilyDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
