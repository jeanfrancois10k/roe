import { IsNotEmpty, IsUUID, IsString, IsOptional } from 'class-validator';

export class PayTicketDto {
  @IsUUID('4', { message: 'ID de ticket invalide' })
  @IsNotEmpty()
  ticketId: string;

  @IsString({ message: "L'identifiant matériel du terminal deviceUuid est obligatoire" })
  @IsNotEmpty()
  deviceUuid: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
