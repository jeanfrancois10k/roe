import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CancelTicketDto {
  @IsUUID('4', { message: 'ID de ticket invalide' })
  @IsNotEmpty()
  ticketId: string;

  @IsString({ message: "Le motif de l'annulation est obligatoire" })
  @IsNotEmpty()
  reason: string;
}
