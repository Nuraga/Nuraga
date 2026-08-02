import { IsDateString, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateContractDto {
  @IsUUID()
  familyId!: string;

  @IsUUID()
  childId!: string;

  @IsUUID()
  tariffId!: string;

  @IsString()
  @MinLength(1)
  number!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
