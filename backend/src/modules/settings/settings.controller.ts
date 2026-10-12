import { Controller, Get, Patch, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
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
}
