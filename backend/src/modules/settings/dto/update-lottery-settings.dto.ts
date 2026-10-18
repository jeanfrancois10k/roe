import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLotterySettingsDto {
  @ApiPropertyOptional({ example: 'ROE BOLET', description: 'Nom commercial de la loterie / borlette' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'Juétwèt', description: 'Slogan ou sous-titre de la borlette' })
  @IsOptional()
  @IsString()
  companySlogan?: string;

  @ApiPropertyOptional({ example: '42327120', description: 'Numéro de contact / téléphone' })
  @IsOptional()
  @IsString()
  companyPhone?: string;

  @ApiPropertyOptional({ example: 'Port-au-Prince, Haïti', description: 'Adresse ou ville' })
  @IsOptional()
  @IsString()
  companyAddress?: string;

  @ApiPropertyOptional({ example: 'Bank 6', description: 'Code ou nom de la banque / succursale' })
  @IsOptional()
  @IsString()
  bankRef?: string;

  @ApiPropertyOptional({ example: '', description: 'URL ou chemin de logo' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '*** ORIGINAL FICHE ***', description: 'En-tête de validation du ticket' })
  @IsOptional()
  @IsString()
  ticketHeaderNote?: string;

  @ApiPropertyOptional({ example: 'FICH SA VALAB SELMAN POU 90 JOU. FICHE PAYABLE AU PORTEUR.', description: 'Règle légale de pied de page' })
  @IsOptional()
  @IsString()
  ticketFooterNote?: string;

  @ApiPropertyOptional({ example: 'ROE-TECH', description: 'Information du fournisseur informatique' })
  @IsOptional()
  @IsString()
  ticketProviderInfo?: string;

  @ApiPropertyOptional({ example: 90, description: 'Durée de validité d\'un ticket en jours' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  ticketValidityDays?: number;

  @ApiPropertyOptional({ example: 'MARYAJ GRATIS 1500 GDES', description: 'Condition spéciale pour mariage gratuit' })
  @IsOptional()
  @IsString()
  mariageGratuitNote?: string;
}
