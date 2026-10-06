import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty({ message: "Le nom d'utilisateur est requis" })
  username: string;

  @IsOptional()
  @IsEmail({}, { message: 'Format email invalide' })
  email?: string;

  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit comporter au moins 6 caractères' })
  password: string;

  @IsEnum(Role, { message: 'Rôle invalide' })
  role: Role;
}
