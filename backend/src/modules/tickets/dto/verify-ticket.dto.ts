import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class VerifyTicketDto {
  @IsString({ message: 'Le numéro de ticket ou le code QR est obligatoire' })
  @IsNotEmpty()
  query: string; // Numéro imprimé (ex: ROE-20261006-A1B2) ou contenu du QR Code

  @IsOptional()
  @IsString()
  checksum?: string;
}
