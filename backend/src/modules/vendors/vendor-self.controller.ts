import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '@prisma/client';

@Controller('api/v1/vendors')
@UseGuards(RolesGuard)
@Roles(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN)
export class VendorSelfController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get('control-summary')
  async getMyControlSummary(
    @CurrentUser('vendorId') vendorId: string,
    @Query('vendorId') overrideVendorId?: string,
    @Query('date') date?: string,
  ) {
    const targetVendorId = overrideVendorId || vendorId;
    if (!targetVendorId) {
      throw new ForbiddenException('Identifiant vendeur requis pour le contrôle.');
    }
    return this.vendorsService.getControlSummary(targetVendorId, date);
  }
}
