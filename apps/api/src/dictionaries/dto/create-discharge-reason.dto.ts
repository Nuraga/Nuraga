import { IsString, MinLength } from "class-validator";

export class CreateDischargeReasonDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
