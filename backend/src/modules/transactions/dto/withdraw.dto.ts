import { IsNotEmpty, IsUUID, IsNumber, Min, IsString, MaxLength, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class WithdrawDto {
  @IsUUID('4', { message: 'ID vendeur invalide' })
  @IsNotEmpty()
  vendorId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'Le montant du retrait doit être strictement positif' })
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference?: string;
}
