import { IsOptional, IsString } from "class-validator";

export class RejectAbsenceRequestDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
