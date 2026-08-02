import { IsString, MinLength } from "class-validator";

export class ProvisionDeviceDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
