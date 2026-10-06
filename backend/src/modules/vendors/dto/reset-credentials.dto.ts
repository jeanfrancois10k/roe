import { IsOptional, IsString, Length, MinLength } from 'class-validator';

export class ResetCredentialsDto {
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  newPassword?: string;

  @IsOptional()
  @IsString()
  @Length(4, 6, { message: 'Le code PIN doit comporter entre 4 et 6 chiffres' })
  newPin?: string;
}
