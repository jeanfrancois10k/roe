import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TicketStatus, TicketPayoutStatus } from '@prisma/client';

export class TicketQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  drawId?: string;

  @IsOptional()
  @IsString()
  gameId?: string;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPayoutStatus)
  payoutStatus?: TicketPayoutStatus;

  @IsOptional()
  @IsString()
  search?: string; // recherche par numéro de ticket
}
