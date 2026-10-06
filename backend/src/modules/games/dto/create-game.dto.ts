import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GameStatus } from '@prisma/client';

export class CreateGameDto {
  @IsString({ message: 'Le code du jeu est obligatoire' })
  @IsNotEmpty()
  code: string;

  @IsString({ message: 'Le nom du jeu est obligatoire' })
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(GameStatus)
  status?: GameStatus = GameStatus.ACTIVE;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  minBetAmount: number = 1.0;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxBetAmount: number = 1000.0;

  @IsObject({ message: 'Les règles du jeu doivent être un objet valide' })
  gameRules: Record<string, any>;

  @IsOptional()
  @IsString()
  drawFrequency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultCommission?: number = 5.0;
}
