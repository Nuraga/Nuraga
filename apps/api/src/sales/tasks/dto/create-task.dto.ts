import { IsDateString, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateTaskDto {
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsOptional()
  @IsUUID()
  familyId?: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsDateString()
  dueAt!: string;

  @IsUUID()
  assignedToId!: string;
}
