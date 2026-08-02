import { IsString, MinLength } from "class-validator";

export class CreateLeadRejectionReasonDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
