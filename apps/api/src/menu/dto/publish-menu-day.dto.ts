import { Type } from "class-transformer";
import { IsArray, IsIn, IsUUID, ValidateNested } from "class-validator";

export const MEAL_TYPES = ["BREAKFAST", "LUNCH", "AFTERNOON_SNACK"] as const;
export type MealTypeValue = (typeof MEAL_TYPES)[number];

export class MenuDayItemDto {
  @IsIn(MEAL_TYPES)
  mealType!: MealTypeValue;

  @IsUUID()
  dishId!: string;
}

export class PublishMenuDayDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuDayItemDto)
  items!: MenuDayItemDto[];
}
