import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '@prisma/client';

@Controller('api/v1/reports')
@UseGuards(RolesGuard)
@Roles(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  async getSalesReport(
    @Query() query: SalesReportQueryDto,
    @CurrentUser('role') role: Role,
    @CurrentUser('vendorId') vendorId: string,
  ) {
    const isAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;
    const forcedVendorId = role === Role.VENDOR ? vendorId : undefined;

    return this.reportsService.getSalesReport(query, forcedVendorId, isAdmin);
  }
}
