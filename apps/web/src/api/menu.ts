import { api } from "./client";
import type { MealType, MenuItem } from "./types";

export interface MenuDayItemInput {
  mealType: MealType;
  dishId: string;
}

export const menuApi = {
  getRange: (branchId: string, from: string, to: string) =>
    api.get<MenuItem[]>(`/branches/${branchId}/menu`, { from, to }),
  publishDay: (branchId: string, date: string, items: MenuDayItemInput[]) =>
    api.post<MenuItem[]>(`/branches/${branchId}/menu/${date}`, { items }),
};
