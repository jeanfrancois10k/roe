import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { BatchSyncDto } from './dto/batch-sync.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('api/v1/sync')
@UseGuards(RolesGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('batch')
  @Roles(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async syncBatch(
    @Body() dto: BatchSyncDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('vendorId') vendorId: string,
  ) {
    if (!vendorId) {
      throw new ForbiddenException('Seul un terminal rattaché à un vendeur peut lancer une synchronisation.');
    }
    return this.syncService.syncBatch(dto, vendorId, userId);
  }

  @Get('status')
  @Roles(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN)
  async getSyncStatus(@CurrentUser('vendorId') vendorId: string) {
    if (!vendorId) {
      throw new ForbiddenException('Profil vendeur requis pour consulter le statut de synchronisation.');
    }
    return this.syncService.getSyncStatus(vendorId);
  }
}
