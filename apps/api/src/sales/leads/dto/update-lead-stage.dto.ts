import { IsIn, IsOptional, IsString, IsUUID } from "class-validator";

// ENROLLED is reachable only via POST /leads/:id/convert; WAITLISTED only
// via the enrollment waitlist endpoint (ТЗ §3.2/§3.4 — see leads.service.ts).
export const ASSIGNABLE_LEAD_STAGES = [
  "NEW",
  "CONTACTED",
  "TOUR_SCHEDULED",
  "TOUR_DONE",
  "TRIAL_DAY",
  "CONTRACT_SIGNING",
  "REJECTED",
] as const;

export type AssignableLeadStage = (typeof ASSIGNABLE_LEAD_STAGES)[number];

export class UpdateLeadStageDto {
  @IsIn(ASSIGNABLE_LEAD_STAGES)
  stage!: AssignableLeadStage;

  @IsOptional()
  @IsUUID()
  rejectionReasonId?: string;

  @IsOptional()
  @IsString()
  rejectionComment?: string;
}
