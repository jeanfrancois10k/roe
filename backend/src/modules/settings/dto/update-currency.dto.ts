import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '@prisma/client';

export class UpdateCurrencyDto {
  @ApiProperty({
    description: 'Devise monétaire principale de la plateforme (Priorité HTG)',
    enum: Currency,
    example: Currency.HTG,
  })
  @IsEnum(Currency, { message: 'La devise doit être HTG, USD ou DOP.' })
  @IsNotEmpty()
  currency: Currency;
}
