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
import { GamesService } from './games.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Role, GameStatus } from '@prisma/client';

@Controller('api/v1/games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Public()
  @Get()
  async findAll(@Query('status') status?: GameStatus) {
    return this.gamesService.findAll(status);
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.gamesService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateGameDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.gamesService.create(dto, adminId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGameDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.gamesService.update(id, dto, adminId);
  }
}
