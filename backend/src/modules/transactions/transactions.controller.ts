import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller(['transactions', 'api/v1/transactions'])
@UseGuards(RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('deposit')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async deposit(@Body() dto: DepositDto, @Request() req: any) {
    return this.transactionsService.deposit(dto, req.user.id);
  }

  @Post('withdraw')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async withdraw(@Body() dto: WithdrawDto, @Request() req: any) {
    return this.transactionsService.withdraw(dto, req.user.id);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.VENDOR)
  async findAll(@Query() query: TransactionQueryDto, @Request() req: any) {
    return this.transactionsService.findAll(query, req.user);
  }

  @Get('reconcile/:vendorId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async reconcile(@Param('vendorId') vendorId: string) {
    return this.transactionsService.reconcileVendorLedger(vendorId);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.VENDOR)
  async findById(@Param('id') id: string, @Request() req: any) {
    return this.transactionsService.findById(id, req.user);
  }
}
