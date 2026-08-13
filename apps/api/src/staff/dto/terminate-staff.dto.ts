import { IsOptional, IsString } from "class-validator";

export class TerminateStaffDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
