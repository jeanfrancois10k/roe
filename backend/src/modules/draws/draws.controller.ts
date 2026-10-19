import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DrawsService } from './draws.service';
import { CreateDrawDto } from './dto/create-draw.dto';
import { SetResultsDto } from './dto/set-results.dto';
import { OverrideResultsDto } from './dto/override-results.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Role, DrawStatus } from '@prisma/client';

@Controller('api/v1/draws')
export class DrawsController {
  constructor(private readonly drawsService: DrawsService) {}

  @Public()
  @Get('debug/status')
  async debugStatus() {
    return this.drawsService.debugStatus();
  }

  @Public()
  @Get('open')
  async getOpenDraws(@Query('gameId') gameId?: string) {
    return this.drawsService.getOpenDraws(gameId);
  }

  @Public()
  @Get('today/results')
  async getTodayResults() {
    return this.drawsService.getTodayResults();
  }

  @Public()
  @Get()
  async findAll(
    @Query('gameId') gameId?: string,
    @Query('status') status?: DrawStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.drawsService.findAll(gameId, status, Number(page), Number(limit));
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.drawsService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateDrawDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.drawsService.create(dto, adminId);
  }

  @Post(':id/open')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async open(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body('minutes') minutes?: number,
  ) {
    return this.drawsService.openDraw(id, adminId, minutes ? Number(minutes) : undefined);
  }

  @Post(':id/close')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.drawsService.closeDraw(id, adminId);
  }

  @Post(':id/auto-fetch')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async autoFetch(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.drawsService.autoFetchResults(id, adminId);
  }


  @Post(':id/results')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async setResults(
    @Param('id') id: string,
    @Body() dto: SetResultsDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.drawsService.setResults(id, dto, adminId);
  }

  @Post(':id/publish')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.drawsService.publishDraw(id, adminId);
  }

  @Post(':id/override')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async override(
    @Param('id') id: string,
    @Body() dto: OverrideResultsDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.drawsService.overrideResults(id, dto, adminId);
  }
}
