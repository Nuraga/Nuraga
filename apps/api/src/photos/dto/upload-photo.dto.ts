import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UploadPhotoDto {
  @IsUUID()
  groupId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  caption?: string;

  @IsOptional()
  @IsDateString()
  takenAt?: string;
}
