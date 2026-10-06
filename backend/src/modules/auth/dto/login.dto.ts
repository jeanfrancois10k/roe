import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString({ message: "L'identifiant doit être une chaîne de caractères" })
  @IsNotEmpty({ message: "L'identifiant est obligatoire" })
  username: string;

  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit comporter au moins 6 caractères' })
  password: string;

  @IsOptional()
  @IsString()
  deviceUuid?: string;

  @IsOptional()
  @IsString()
  deviceModel?: string;

  @IsOptional()
  @IsString()
  osVersion?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}
