import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('api/v1/audit')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(@Query() query: AuditQueryDto) {
    return this.auditService.findAll(query);
  }

  @Get('actions')
  async getActions() {
    return this.auditService.getDistinctActions();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.auditService.findById(id);
  }
}
