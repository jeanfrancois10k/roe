import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  MinLength,
  Length,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVendorDto {
  @IsString({ message: 'Le nom complet est obligatoire' })
  @IsNotEmpty()
  fullName: string;

  @IsString({ message: 'Le numéro de téléphone est obligatoire' })
  @IsNotEmpty()
  phone: string;

  @IsString({ message: "L'adresse du point de vente est obligatoire" })
  @IsNotEmpty()
  posAddress: string;

  @IsOptional()
  @IsString({ message: "Le nom d'utilisateur doit être une chaîne de caractères" })
  username?: string;

  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit comporter au moins 6 caractères' })
  password: string;

  @IsOptional()
  @IsString()
  @Length(4, 6, { message: 'Le code PIN doit comporter 4 à 6 chiffres' })
  pin?: string;

  @IsOptional()
  @IsString()
  vendorCode?: string; // Auto-généré si absent (ex: VEND-002)

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditLimit?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailySalesLimit?: number = 5000;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxTicketAmount?: number = 500;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultCommissionRate?: number = 5.0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  initialBalance?: number = 0;
}
