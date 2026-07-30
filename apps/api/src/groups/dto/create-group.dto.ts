import { IsInt, IsString, IsUUID, Min, MinLength } from "class-validator";

export class CreateGroupDto {
  @IsUUID()
  groupTypeId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(1)
  plannedCapacity!: number;

  @IsInt()
  @Min(1)
  maxCapacity!: number;
}
