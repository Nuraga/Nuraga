import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

export class UpdateGroupDto {
  @IsOptional()
  @IsUUID()
  groupTypeId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  plannedCapacity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxCapacity?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
