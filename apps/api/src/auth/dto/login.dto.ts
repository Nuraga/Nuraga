import { IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsString()
  identifier!: string; // email or phone

  @IsString()
  @MinLength(1)
  password!: string;
}
