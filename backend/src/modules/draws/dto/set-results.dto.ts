import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WinningResultsDto {
  @IsString({ message: 'Le 1er lot est obligatoire' })
  @IsNotEmpty()
  firstPrize: string; // Ex: "512" (Borlette 12, Lot 3: 512) ou "12"

  @IsString({ message: 'Le 2e lot est obligatoire' })
  @IsNotEmpty()
  secondPrize: string; // Ex: "34"

  @IsString({ message: 'Le 3e lot est obligatoire' })
  @IsNotEmpty()
  thirdPrize: string; // Ex: "78"

  @IsOptional()
  extraPicks?: Record<string, any>;
}

export class SetResultsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => WinningResultsDto)
  winningResults?: WinningResultsDto;

  @IsOptional()
  @IsString({ message: 'Le 1er lot doit être une chaîne de caractères' })
  firstPrize?: string;

  @IsOptional()
  @IsString({ message: 'Le 2e lot doit être une chaîne de caractères' })
  secondPrize?: string;

  @IsOptional()
  @IsString({ message: 'Le 3e lot doit être une chaîne de caractères' })
  thirdPrize?: string;

  @IsOptional()
  @IsBoolean()
  publishImmediately?: boolean = true;
}
