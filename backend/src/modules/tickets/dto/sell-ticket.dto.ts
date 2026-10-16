import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BetGridDto {
  @IsArray({ message: 'Les numéros joués doivent être une liste de chaînes' })
  @IsNotEmpty({ message: 'La liste des numéros est obligatoire' })
  numbers: string[]; // Ex: ["07", "42"] ou ["123"] ou ["5", "14", "23", "45", "88"]

  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Le montant de la mise doit être supérieur ou égal à 0' })
  betAmount: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  multiplier?: number = 1;

  @IsOptional()
  @IsString()
  option?: string; // Ex: "OP1", "OP2", "OP3", "TOUT", "GRATIS"

  @IsOptional()
  @IsString()
  gameType?: string; // Ex: "BORLETTE", "LOTO3", "LOTO4", "LOTO5", "MARIAGE"

  @IsOptional()
  isGratis?: boolean;
}

export class SellTicketDto {
  @IsUUID('4', { message: 'ID de jeu invalide' })
  @IsNotEmpty()
  gameId: string;

  @IsUUID('4', { message: 'ID de tirage invalide' })
  @IsNotEmpty()
  drawId: string;

  @IsString({ message: "L'identifiant matériel du terminal deviceUuid est obligatoire" })
  @IsNotEmpty()
  deviceUuid: string;

  @IsString({ message: "La clé d'idempotence est obligatoire pour éviter les doubles paiements" })
  @IsNotEmpty()
  idempotencyKey: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BetGridDto)
  grids: BetGridDto[];
}
