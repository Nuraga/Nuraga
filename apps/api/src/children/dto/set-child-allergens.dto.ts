import { IsArray, IsUUID } from "class-validator";

export class SetChildAllergensDto {
  @IsArray()
  @IsUUID("4", { each: true })
  allergenIds!: string[];
}
