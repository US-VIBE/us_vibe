import { Transform } from "class-transformer";
import { IsEmail, IsString, MinLength } from "class-validator";

export class AuthCredentialsDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
