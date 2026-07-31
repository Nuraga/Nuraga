import { IsInt, IsString, Min, MinLength } from "class-validator";

export class CreateGroupTypeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(0)
  minAgeMonths!: number;

  @IsInt()
  @Min(0)
  maxAgeMonths!: number;
}
