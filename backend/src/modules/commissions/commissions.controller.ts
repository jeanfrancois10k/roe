import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { SetCommissionDto } from './dto/set-commission.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { IsUUID, IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SimulateCommissionDto {
  @IsUUID('4', { message: 'ID vendeur invalide' })
  vendorId: string;

  @IsUUID('4', { message: 'ID jeu invalide' })
  gameId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  ticketsCount?: number;
}

@Controller('commissions')
@UseGuards(RolesGuard)
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Post('rules')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async setRule(@Body() dto: SetCommissionDto, @Request() req: any) {
    return this.commissionsService.setRule(dto, req.user?.id);
  }

  @Get('vendors/:vendorId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.VENDOR)
  async getByVendor(@Param('vendorId') vendorId: string, @Request() req: any) {
    if (req.user?.role === Role.VENDOR && req.user?.vendor?.id !== vendorId) {
      throw new ForbiddenException('Accès refusé aux commissions d’un autre vendeur.');
    }
    return this.commissionsService.getByVendor(vendorId);
  }

  @Delete('vendors/:vendorId/games/:gameId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async deleteRule(
    @Param('vendorId') vendorId: string,
    @Param('gameId') gameId: string,
    @Request() req: any,
  ) {
    return this.commissionsService.deleteRule(vendorId, gameId, req.user?.id);
  }

  @Post('simulate')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.VENDOR)
  async simulate(@Body() dto: SimulateCommissionDto) {
    return this.commissionsService.calculateCommission(
      dto.vendorId,
      dto.gameId,
      dto.totalAmount,
      dto.ticketsCount ?? 1,
    );
  }
}
