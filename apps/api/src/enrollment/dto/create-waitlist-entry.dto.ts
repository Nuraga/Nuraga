import { IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class CreateWaitlistEntryDto {
  @IsOptional()
  @IsUUID()
  childId?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}
