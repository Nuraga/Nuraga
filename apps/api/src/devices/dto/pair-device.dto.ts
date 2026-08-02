import { IsString, MinLength } from "class-validator";

export class PairDeviceDto {
  @IsString()
  @MinLength(1)
  secret!: string;
}
