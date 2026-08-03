import { IsBoolean } from "class-validator";

export class SetPhotoConsentDto {
  @IsBoolean()
  consent!: boolean;
}
