import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class UploadDocumentDto {
  @IsUUID()
  documentTypeId!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
