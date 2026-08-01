import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import type { PaymentMethod } from "@prisma/client";

const PAYMENT_METHODS = ["CASH", "CARD_ONSITE", "BANK_TRANSFER", "ONLINE_GATEWAY"];

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsIn(PAYMENT_METHODS)
  method!: PaymentMethod;

  @IsDateString()
  paidAt!: string;

  @IsOptional()
  @IsString()
  externalRef?: string;
}
