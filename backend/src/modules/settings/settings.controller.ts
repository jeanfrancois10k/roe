import { Controller, Get, Patch, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { UpdateLotterySettingsDto } from './dto/update-lottery-settings.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Paramètres Système & Devises')
@Controller('api/v1/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Récupère la configuration générale et la devise active (HTG prioritaire)' })
  @ApiResponse({ status: 200, description: 'Paramètres système retournés avec succès.' })
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch('currency')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Changer la devise officielle de la plateforme (HTG ou USD)' })
  @ApiResponse({ status: 200, description: 'Devise mise à jour avec succès.' })
  async updateCurrency(@Body() dto: UpdateCurrencyDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.settingsService.updateCurrency(dto, userId);
  }

  @Patch('lottery')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour les informations de la loterie (Nom, Téléphone, En-tête, Pied de page, etc.)' })
  @ApiResponse({ status: 200, description: 'Paramètres de loterie mis à jour avec succès.' })
  async updateLottery(@Body() dto: UpdateLotterySettingsDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.settingsService.updateLotterySettings(dto, userId);
  }

  @Public()
  @Get('app/update')
  @ApiOperation({ summary: 'Vérifie la disponibilité d\'une nouvelle version de l\'application Android' })
  @ApiResponse({ status: 200, description: 'Informations de mise à jour de l\'APK' })
  async checkAppUpdate() {
    return this.settingsService.getAppUpdateInfo();
  }

  @Post('reset-platform')
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Vider la base de données (transactions, tickets, tirages et vendeurs de test) pour une plateforme vierge' })
  @ApiResponse({ status: 200, description: 'Plateforme remise à zéro avec succès.' })
  async resetPlatform(@Body() body: { deleteVendors?: boolean }, @Request() req: any) {
    const userId = req.user?.id || req.user?.userId;
    const deleteVendors = body?.deleteVendors !== undefined ? Boolean(body.deleteVendors) : true;
    return this.settingsService.resetPlatformData(userId, deleteVendors);
  }
}
