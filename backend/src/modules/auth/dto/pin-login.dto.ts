import { IsNotEmpty, IsString, Length } from 'class-validator';

export class PinLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Le code vendeur est obligatoire' })
  vendorCode: string;

  @IsString()
  @Length(4, 6, { message: 'Le PIN doit contenir entre 4 et 6 chiffres' })
  pin: string;

  @IsString()
  @IsNotEmpty({ message: "L'identifiant matériel de l'appareil est obligatoire pour la connexion PIN" })
  deviceUuid: string;

  @IsString()
  @IsNotEmpty()
  deviceModel: string;

  @IsString()
  @IsNotEmpty()
  osVersion: string;

  @IsString()
  @IsNotEmpty()
  appVersion: string;
}
