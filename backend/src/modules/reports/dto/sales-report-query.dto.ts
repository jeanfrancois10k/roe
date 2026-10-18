import { IsOptional, IsString } from 'class-validator';

export class SalesReportQueryDto {
  @IsOptional()
  @IsString()
  period?: string = 'day';

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  drawId?: string;

  @IsOptional()
  @IsString()
  includeWinningTickets?: string;
}
