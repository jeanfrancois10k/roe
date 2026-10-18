import { IsOptional, IsString, IsIn } from 'class-validator';

export class SalesReportQueryDto {
  @IsOptional()
  @IsIn(['day', 'week', 'month'], { message: "La période doit être 'day', 'week' ou 'month'" })
  period?: 'day' | 'week' | 'month' = 'day';

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;
}
