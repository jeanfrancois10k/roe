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
  ForbiddenException,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { SellTicketDto } from './dto/sell-ticket.dto';
import { CancelTicketDto } from './dto/cancel-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { VerifyTicketDto } from './dto/verify-ticket.dto';
import { PayTicketDto } from './dto/pay-ticket.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('api/v1/tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post('verify')
  @UseGuards(RolesGuard)
  @Roles(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async verifyTicket(@Body() dto: VerifyTicketDto) {
    return this.ticketsService.verifyTicket(dto);
  }

  @Post('pay')
  @UseGuards(RolesGuard)
  @Roles(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async payTicketPrize(
    @Body() dto: PayTicketDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('vendorId') vendorId: string,
  ) {
    if (!vendorId) {
      throw new ForbiddenException('Seul un profil vendeur actif peut effectuer le paiement d’un lot.');
    }
    return this.ticketsService.payTicketPrize(dto, vendorId, userId);
  }

  @Post('sell')
  @UseGuards(RolesGuard)
  @Roles(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async sellTicket(
    @Body() dto: SellTicketDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('vendorId') userVendorId: string,
    @CurrentUser('role') role: Role,
  ) {
    const targetVendorId = userVendorId;
    if (!targetVendorId) {
      throw new ForbiddenException("Seul un profil vendeur actif est habilité à émettre des tickets.");
    }
    return this.ticketsService.sellTicket(dto, targetVendorId, userId);
  }

  @Post('cancel')
  @UseGuards(RolesGuard)
  @Roles(Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async cancelTicket(
    @Body() dto: CancelTicketDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('vendorId') vendorId: string,
    @CurrentUser('role') role: Role,
  ) {
    const isAdmin = role === Role.ADMIN || role === Role.SUPER_ADMIN;
    return this.ticketsService.cancelTicket(dto, vendorId, userId, isAdmin);
  }

  @Get()
  async findAll(
    @Query() query: TicketQueryDto,
    @CurrentUser('role') role: Role,
    @CurrentUser('vendorId') vendorId: string,
  ) {
    // Cloisonnement strict multi-vendeurs
    if (role === Role.VENDOR) {
      query.vendorId = vendorId;
    }
    return this.ticketsService.findAll(query);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentUser('role') role: Role,
    @CurrentUser('vendorId') vendorId: string,
  ) {
    const ticket = await this.ticketsService.findById(id);
    if (role === Role.VENDOR && ticket.vendorId !== vendorId) {
      throw new ForbiddenException("Accès interdit aux tickets d'un autre point de vente.");
    }
    return ticket;
  }

  @Get('number/:ticketNumber')
  async findByNumber(
    @Param('ticketNumber') ticketNumber: string,
    @CurrentUser('role') role: Role,
    @CurrentUser('vendorId') vendorId: string,
  ) {
    const ticket = await this.ticketsService.findByNumber(ticketNumber);
    if (role === Role.VENDOR && ticket.vendorId !== vendorId) {
      throw new ForbiddenException("Accès interdit aux tickets d'un autre point de vente.");
    }
    return ticket;
  }
}
