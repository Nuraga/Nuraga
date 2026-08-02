import { IsString, MinLength } from "class-validator";

export class CreateLeadSourceDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
