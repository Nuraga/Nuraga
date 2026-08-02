import { IsString, MinLength } from "class-validator";

export class CreateLeadActivityDto {
  @IsString()
  @MinLength(1)
  content!: string;
}
