import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SellTicketDto } from '../../tickets/dto/sell-ticket.dto';

export class BatchSyncDto {
  @IsString({ message: "L'identifiant matériel deviceUuid est obligatoire" })
  @IsNotEmpty()
  deviceUuid: string;

  @IsOptional()
  @IsString()
  lastSyncTimestamp?: string;

  @IsArray({ message: 'La liste des tickets en attente de synchronisation est requise' })
  @ValidateNested({ each: true })
  @Type(() => SellTicketDto)
  pendingTickets: SellTicketDto[];
}
