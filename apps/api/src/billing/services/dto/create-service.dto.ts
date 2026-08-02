import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(0)
  priceMinor!: number;

  @IsOptional()
  @IsString()
  scheduleInfo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}
