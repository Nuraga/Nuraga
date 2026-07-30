import { IsDateString, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateStaffDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @MinLength(1)
  position!: string;

  @IsOptional()
  @IsDateString()
  hiredAt?: string;
}
