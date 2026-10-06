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
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Role, DrawStatus } from '@prisma/client';

@Controller('api/v1/draws')
export class DrawsController {
  constructor(private readonly drawsService: DrawsService) {}

  @Public()
  @Get('open')
  async getOpenDraws(@Query('gameId') gameId?: string) {
    return this.drawsService.getOpenDraws(gameId);
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
}
