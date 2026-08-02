import { IsUUID } from "class-validator";

// A tariff switch is a deliberate, separate operation (ТЗ §6.7: "смена
// тарифа — отдельное допсоглашение"), not a raw field edit via UpdateContractDto.
export class ChangeTariffDto {
  @IsUUID()
  tariffId!: string;
}
