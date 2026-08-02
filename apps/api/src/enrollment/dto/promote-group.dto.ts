import { IsOptional, IsUUID } from "class-validator";

// Exactly one of the two must be set: toGroupId promotes the whole group
// up a level, dischargeReasonId graduates them out (TRD 4.3 "выпуск").
export class PromoteGroupDto {
  @IsOptional()
  @IsUUID()
  toGroupId?: string;

  @IsOptional()
  @IsUUID()
  dischargeReasonId?: string;
}
