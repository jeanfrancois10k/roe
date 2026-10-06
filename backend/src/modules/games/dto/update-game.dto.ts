import {
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GameStatus } from '@prisma/client';

export class UpdateGameDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(GameStatus)
  status?: GameStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  minBetAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxBetAmount?: number;

  @IsOptional()
  @IsObject()
  gameRules?: Record<string, any>;

  @IsOptional()
  @IsString()
  drawFrequency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultCommission?: number;
}
