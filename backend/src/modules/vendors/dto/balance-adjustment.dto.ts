import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class BalanceAdjustmentDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty({ message: 'Le montant est obligatoire' })
  amount: number;

  @IsString({ message: 'Le motif de la régularisation est obligatoire' })
  @IsNotEmpty()
  reason: string;
}
