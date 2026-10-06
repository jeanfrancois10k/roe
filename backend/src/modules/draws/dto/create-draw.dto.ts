import { IsNotEmpty, IsUUID, IsDateString } from 'class-validator';

export class CreateDrawDto {
  @IsUUID('4', { message: 'ID de jeu invalide' })
  @IsNotEmpty()
  gameId: string;

  @IsDateString({}, { message: 'Date de tirage invalide (ISO 8601)' })
  @IsNotEmpty()
  scheduledAt: string;

  @IsDateString({}, { message: 'Date de clôture des ventes invalide (ISO 8601)' })
  @IsNotEmpty()
  salesClosingAt: string;
}
