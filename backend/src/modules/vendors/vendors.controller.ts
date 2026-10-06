import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { ResetCredentialsDto } from './dto/reset-credentials.dto';
import { VendorQueryDto } from './dto/vendor-query.dto';
import { AssignDeviceDto } from './dto/assign-device.dto';
import { BalanceAdjustmentDto } from './dto/balance-adjustment.dto';
import { Role, TransactionType } from '@prisma/client';

@Controller('api/v1/admin/vendors')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateVendorDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.vendorsService.createVendor(dto, adminId);
  }

  @Get()
  async findAll(@Query() query: VendorQueryDto) {
    return this.vendorsService.findAll(query);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.vendorsService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.vendorsService.updateVendor(id, dto, adminId);
  }

  @Post(':id/reset-credentials')
  @HttpCode(HttpStatus.OK)
  async resetCredentials(
    @Param('id') id: string,
    @Body() dto: ResetCredentialsDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.vendorsService.resetCredentials(id, dto, adminId);
  }

  @Post(':id/adjust-balance')
  @HttpCode(HttpStatus.OK)
  async adjustBalance(
    @Param('id') id: string,
    @Body() dto: BalanceAdjustmentDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.vendorsService.adjustBalance(id, dto, adminId);
  }

  @Post(':id/devices')
  @HttpCode(HttpStatus.CREATED)
  async assignDevice(
    @Param('id') id: string,
    @Body() dto: AssignDeviceDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.vendorsService.assignDevice(id, dto, adminId);
  }

  @Get(':id/transactions')
  async getTransactions(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('type') type?: TransactionType,
  ) {
    return this.vendorsService.getVendorTransactions(id, Number(page), Number(limit), type);
  }

  @Get(':id/tickets')
  async getTickets(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.vendorsService.getVendorTickets(id, Number(page), Number(limit));
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspend(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body('reason') reason?: string,
  ) {
    return this.vendorsService.suspendVendor(id, adminId, reason);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.vendorsService.reactivateVendor(id, adminId);
  }

  @Post('devices/:deviceId/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeDevice(
    @Param('deviceId') deviceId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.vendorsService.revokeDevice(deviceId, adminId);
  }
}
