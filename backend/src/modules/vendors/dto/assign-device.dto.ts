import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignDeviceDto {
  @IsString({ message: "L'identifiant matériel deviceUuid est obligatoire" })
  @IsNotEmpty()
  deviceUuid: string;

  @IsString({ message: 'Le modèle du terminal est obligatoire' })
  @IsNotEmpty()
  deviceModel: string;

  @IsOptional()
  @IsString()
  osVersion?: string = 'Android';

  @IsOptional()
  @IsString()
  appVersion?: string = '1.0.0';
}
