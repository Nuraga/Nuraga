import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateDocumentTypeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  hasExpiry?: boolean;
}
