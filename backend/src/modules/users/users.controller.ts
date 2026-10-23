import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('api/v1/users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.usersService.findAll(Number(page), Number(limit));
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN)
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @CurrentUser('id') adminId: string,
  ) {
    return this.usersService.toggleActive(id, isActive, adminId);
  }

  @Patch(':id/password')
  @Roles(Role.SUPER_ADMIN)
  async updatePassword(
    @Param('id') id: string,
    @Body('password') password: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.usersService.changeUserPassword(id, password, adminId);
  }
}
