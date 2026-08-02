import { IsInt, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

// amountMinor is signed: negative reduces the invoice, positive adds to it.
// comment is mandatory — every manual touch to a draft invoice must be
// explainable (ТЗ §6.4 step 4).
export class AddAdjustmentDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsInt()
  amountMinor!: number;

  @IsString()
  @MinLength(1)
  comment!: string;

  @IsOptional()
  @IsUUID()
  childId?: string;
}
