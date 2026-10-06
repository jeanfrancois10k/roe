import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, VendorStatus } from '@prisma/client';

@Controller('api/v1/admin/vendors')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: VendorStatus,
  ) {
    return this.vendorsService.findAll(Number(page), Number(limit), status);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.vendorsService.findById(id);
  }

  @Post(':id/suspend')
  async suspend(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body('reason') reason?: string,
  ) {
    return this.vendorsService.suspendVendor(id, adminId, reason);
  }

  @Post(':id/reactivate')
  async reactivate(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.vendorsService.reactivateVendor(id, adminId);
  }

  @Post('devices/:deviceId/revoke')
  async revokeDevice(
    @Param('deviceId') deviceId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.vendorsService.revokeDevice(deviceId, adminId);
  }
}
