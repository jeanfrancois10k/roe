import {
  IsNotEmpty,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WinningResultsDto } from './set-results.dto';

export class OverrideResultsDto {
  @ValidateNested()
  @Type(() => WinningResultsDto)
  @IsNotEmpty({ message: 'Les résultats rectifiés sont obligatoires' })
  winningResults: WinningResultsDto;

  @IsString()
  @IsNotEmpty({ message: 'Le motif de rectification est obligatoire pour la traçabilité d’audit' })
  @MinLength(10, { message: 'Le motif de rectification doit comporter au moins 10 caractères' })
  justificationReason: string;
}
