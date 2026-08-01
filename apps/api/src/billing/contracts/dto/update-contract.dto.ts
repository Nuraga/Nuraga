import { IsDateString, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { ContractStatus } from "@prisma/client";

const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "TERMINATED", "EXPIRED"];

export class UpdateContractDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  number?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(CONTRACT_STATUSES)
  status?: ContractStatus;
}
