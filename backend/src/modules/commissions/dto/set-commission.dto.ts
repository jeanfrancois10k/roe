import { IsNotEmpty, IsUUID, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CommissionType } from '@prisma/client';

export class SetCommissionDto {
  @IsUUID('4', { message: 'ID vendeur invalide' })
  @IsNotEmpty()
  vendorId: string;

  @IsUUID('4', { message: 'ID de jeu invalide' })
  @IsNotEmpty()
  gameId: string;

  @IsEnum(CommissionType, { message: 'Type de commission invalide (PERCENTAGE ou FIXED_PER_TICKET)' })
  rateType: CommissionType;

  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'La valeur de la commission doit être supérieure ou égale à 0' })
  rateValue: number;
}
