import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateDocumentTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  hasExpiry?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
