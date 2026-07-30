import { IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class CreateWaitlistEntryDto {
  @IsUUID()
  childId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}
