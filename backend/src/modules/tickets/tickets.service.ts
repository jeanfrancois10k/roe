import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SellTicketDto } from './dto/sell-ticket.dto';
import { CancelTicketDto } from './dto/cancel-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import {
  TicketStatus,
  TransactionType,
  DeviceStatus,
  VendorStatus,
  DrawStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  private readonly hmacSecret: string;
  private readonly cancellationWindowMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {
    this.hmacSecret =
      this.configService.get<string>('HMAC_TICKET_SECRET') ||
      'roe_bolet_hmac_ticket_checksum_salt_998877';
    this.cancellationWindowMinutes =
      Number(this.configService.get<number>('CANCELLATION_WINDOW_MINUTES')) || 5;
  }

  private generateChecksum(ticketNumber: string, amount: number, drawId: string): string {
    const raw = `${ticketNumber}|${amount.toFixed(2)}|${drawId}`;
    return crypto.createHmac('sha256', this.hmacSecret).update(raw).digest('hex');
  }

  /**
   * APPLICATION STRICTE DES 11 RÈGLES DE SÉCURITÉ TRANSACTIONNELLE
   */
  async sellTicket(dto: SellTicketDto, vendorId: string, operatorUserId: string) {
    // RÈGLE 8 : Vérification de l'idempotence (Anti-double soumission)
    const existingTx = await this.prisma.transaction.findUnique({
      where: { reference: dto.idempotencyKey },
    });
    if (existingTx) {
      throw new ConflictException(
        `Une transaction avec la référence '${dto.idempotencyKey}' a déjà été traitée.`,
      );
    }

    // Calcul du montant total de la mise
    const totalAmount = dto.grids.reduce((acc, g) => acc + g.betAmount * (g.multiplier || 1), 0);
    if (totalAmount <= 0) {
      throw new BadRequestException('Le montant total du ticket doit être strictement positif.');
    }

    const now = new Date();

    // RÈGLE 1, 2, 3 : Vendeur authentifié, actif, appareil autorisé
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        devices: true,
      },
    });

    if (!vendor) {
      throw new ForbiddenException('Profil vendeur introuvable.');
    }

    if (vendor.status === VendorStatus.SUSPENDED) {
      throw new ForbiddenException('Opération rejetée : ce compte vendeur est SUSPENDU.');
    }

    if (vendor.status !== VendorStatus.ACTIVE) {
      throw new ForbiddenException('Opération rejetée : ce compte vendeur n’est pas actif.');
    }

    const matchedDevice = vendor.devices.find((d) => d.deviceUuid === dto.deviceUuid);
    if (!matchedDevice || matchedDevice.status === DeviceStatus.REVOKED) {
      throw new ForbiddenException(
        'Opération rejetée : cet appareil Android n’est pas autorisé pour la vente.',
      );
    }

    // RÈGLE 4 : Jeu actif
    const game = await this.prisma.game.findUnique({ where: { id: dto.gameId } });
    if (!game || game.status !== 'ACTIVE') {
      throw new BadRequestException('Le jeu sélectionné n’est pas disponible ou inactif.');
    }

    // RÈGLE 7 : Validation des montants par grille
    for (const grid of dto.grids) {
      if (grid.betAmount < Number(game.minBetAmount) || grid.betAmount > Number(game.maxBetAmount)) {
        throw new BadRequestException(
          `Mise non conforme : min $${game.minBetAmount}, max $${game.maxBetAmount} par combinaison.`,
        );
      }
    }

    // RÈGLE 5 : Horaire valide & Tirage ouvert
    const draw = await this.prisma.draw.findUnique({ where: { id: dto.drawId } });
    if (!draw) {
      throw new NotFoundException('Tirage introuvable.');
    }

    if (draw.gameId !== game.id) {
      throw new BadRequestException('Incohérence : le tirage sélectionné ne correspond pas au jeu.');
    }

    if (draw.status !== DrawStatus.OPEN) {
      throw new BadRequestException('Les ventes pour ce tirage ne sont pas ouvertes.');
    }

    if (now >= new Date(draw.salesClosingAt)) {
      throw new BadRequestException(
        `Vente rejetée : les ventes sont closes pour ce tirage depuis ${draw.salesClosingAt.toLocaleTimeString()}.`,
      );
    }

    // RÈGLE 6 : Plafonds vendeur (Max par ticket & Plafond journalier)
    if (totalAmount > Number(vendor.maxTicketAmount)) {
      throw new BadRequestException(
        `Dépassement de plafond : montant max autorisé par ticket est de $${vendor.maxTicketAmount}.`,
      );
    }

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todaySalesAgg = await this.prisma.ticket.aggregate({
      where: {
        vendorId,
        createdAt: { gte: startOfToday },
        status: TicketStatus.CONFIRMED,
      },
      _sum: { totalAmount: true },
    });

    const currentTodayTotal = Number(todaySalesAgg._sum.totalAmount || 0);
    if (currentTodayTotal + totalAmount > Number(vendor.dailySalesLimit)) {
      throw new BadRequestException(
        `Plafond journalier de vente ($${vendor.dailySalesLimit}) atteint pour ce vendeur.`,
      );
    }

    // G憶ration du num鑽o unique de ticket et de la signature QR code
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    const ticketNumber = `ROE-${dateStr}-${randomSuffix}`;
    const secureChecksum = this.generateChecksum(ticketNumber, totalAmount, draw.id);

    // Calcul de la commission
    const commissionRate = Number(vendor.defaultCommissionRate);
    const commissionAmount = Number(((totalAmount * commissionRate) / 100).toFixed(2));

    // RÈGLE 9 & 10 : TRANSACTION ATOMIQUE AVEC LOCK PESSIMISTE POSTGRESQL
    return await this.prisma.$transaction(async (tx) => {
      // Locking pessimiste sur la ligne du vendeur
      const [lockedVendor] = await tx.$queryRaw<Array<{ currentBalance: any; creditLimit: any }>>`
        SELECT "currentBalance", "creditLimit" 
        FROM "Vendor" 
        WHERE "id" = ${vendorId}::uuid 
        FOR UPDATE
      `;

      const currentBal = Number(lockedVendor.currentBalance);
      const creditLim = Number(lockedVendor.creditLimit);

      // V鑽ification stricte des fonds disponibles
      if (currentBal - totalAmount < -creditLim) {
        throw new BadRequestException(
          `Solde insuffisant pour émettre ce ticket (Solde disponible : $${(currentBal + creditLim).toFixed(2)}).`,
        );
      }

      // 1. D閎it de la vente
      const balanceAfterSale = currentBal - totalAmount;
      const netBalanceAfter = balanceAfterSale + commissionAmount;

      await tx.vendor.update({
        where: { id: vendorId },
        data: {
          currentBalance: netBalanceAfter,
          lastActivityAt: now,
        },
      });

      // 2. 蒀riture Ledger : D閎it de la Vente
      await tx.transaction.create({
        data: {
          vendorId,
          operatorId: operatorUserId,
          type: TransactionType.SALE,
          amount: -totalAmount,
          balanceBefore: currentBal,
          balanceAfter: balanceAfterSale,
          reference: dto.idempotencyKey,
          description: `Vente Ticket ${ticketNumber} (${game.name})`,
        },
      });

      // 3. 蒀riture Ledger : Cr閡it de la Commission imm閡iate
      if (commissionAmount > 0) {
        await tx.transaction.create({
          data: {
            vendorId,
            operatorId: operatorUserId,
            type: TransactionType.COMMISSION,
            amount: commissionAmount,
            balanceBefore: balanceAfterSale,
            balanceAfter: netBalanceAfter,
            reference: `COM-${dto.idempotencyKey}`,
            description: `Commission ${commissionRate}% sur Vente ${ticketNumber}`,
          },
        });
      }

      // 4. Cr閡tion de l'enregistrement Ticket d閒initif
      const expiresAt = new Date(draw.scheduledAt);
      expiresAt.setDate(expiresAt.getDate() + 90); // Valide 90 jours apr鑣 le tirage

      const createdTicket = await tx.ticket.create({
        data: {
          ticketNumber,
          secureChecksum,
          vendorId,
          gameId: game.id,
          drawId: draw.id,
          status: TicketStatus.CONFIRMED,
          totalAmount,
          playedGrids: JSON.parse(JSON.stringify(dto.grids)),
          expiresAt,
        },
      });

      // RÈGLE 11 : Traçabilité d'audit
      await this.auditService.log({
        userId: operatorUserId,
        action: 'TICKET_SOLD',
        resource: `Ticket:${createdTicket.id}`,
        newPayload: {
          ticketNumber,
          totalAmount,
          gameCode: game.code,
          drawNumber: draw.drawNumber,
          vendorCode: vendor.vendorCode,
        },
      });

      this.logger.log(`Ticket émis avec succès : ${ticketNumber} ($${totalAmount}) par ${vendor.vendorCode}`);

      return {
        success: true,
        ticket: {
          id: createdTicket.id,
          ticketNumber: createdTicket.ticketNumber,
          secureChecksum: createdTicket.secureChecksum,
          gameName: game.name,
          drawNumber: draw.drawNumber,
          scheduledAt: draw.scheduledAt,
          totalAmount: Number(createdTicket.totalAmount),
          playedGrids: dto.grids,
          vendorCode: vendor.vendorCode,
          posAddress: vendor.posAddress,
          createdAt: createdTicket.createdAt,
          newBalance: netBalanceAfter,
        },
      };
    });
  }

  /**
   * Annulation de ticket dans la fen黎re autoris閑
   */
  async cancelTicket(dto: CancelTicketDto, vendorId: string, operatorUserId: string, isAdmin = false) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: dto.ticketId },
      include: {
        draw: true,
        game: true,
        vendor: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }

    if (ticket.status !== TicketStatus.CONFIRMED) {
      throw new BadRequestException(`Ce ticket ne peut pas être annulé (Statut actuel : ${ticket.status})`);
    }

    if (!isAdmin && ticket.vendorId !== vendorId) {
      throw new ForbiddenException('Un vendeur ne peut annuler que les tickets émis par son propre terminal.');
    }

    const now = new Date();

    // V鑽ification heure de tirage
    if (now >= new Date(ticket.draw.salesClosingAt)) {
      throw new BadRequestException('Impossible d’annuler : les ventes pour ce tirage sont closes.');
    }

    // V鑽ification fen黎re d'annulation
    const elapsedMinutes = (now.getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60);
    if (!isAdmin && elapsedMinutes > this.cancellationWindowMinutes) {
      throw new BadRequestException(
        `Le délai légal d’annulation de ${this.cancellationWindowMinutes} minutes est dépassé.`,
      );
    }

    const ticketAmount = Number(ticket.totalAmount);

    return await this.prisma.$transaction(async (tx) => {
      // Verrouillage du vendeur
      const [lockedVendor] = await tx.$queryRaw<Array<{ currentBalance: any }>>`
        SELECT "currentBalance" FROM "Vendor" WHERE "id" = ${ticket.vendorId}::uuid FOR UPDATE
      `;

      const currentBal = Number(lockedVendor.currentBalance);
      const balanceAfterCancel = currentBal + ticketAmount;

      await tx.vendor.update({
        where: { id: ticket.vendorId },
        data: { currentBalance: balanceAfterCancel },
      });

      // 蒀riture Ledger : Remboursement de la vente
      await tx.transaction.create({
        data: {
          vendorId: ticket.vendorId,
          operatorId: operatorUserId,
          type: TransactionType.SALE_CANCEL,
          amount: ticketAmount,
          balanceBefore: currentBal,
          balanceAfter: balanceAfterCancel,
          reference: `CANCEL-${ticket.ticketNumber}`,
          description: `Annulation Vente Ticket ${ticket.ticketNumber} (${dto.reason})`,
        },
      });

      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.CANCELLED,
          cancelledAt: now,
          cancellationReason: dto.reason,
        },
      });

      await this.auditService.log({
        userId: operatorUserId,
        action: 'TICKET_CANCELLED',
        resource: `Ticket:${ticket.id}`,
        newPayload: {
          ticketNumber: ticket.ticketNumber,
          amount: ticketAmount,
          reason: dto.reason,
        },
      });

      return {
        success: true,
        message: `Ticket ${ticket.ticketNumber} annulé avec succès.`,
        ticket: updatedTicket,
        newBalance: balanceAfterCancel,
      };
    });
  }

  async findAll(query: TicketQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TicketWhereInput = {};
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.drawId) where.drawId = query.drawId;
    if (query.gameId) where.gameId = query.gameId;
    if (query.status) where.status = query.status;
    if (query.payoutStatus) where.payoutStatus = query.payoutStatus;
    if (query.search) where.ticketNumber = { contains: query.search };

    const [total, items] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        include: {
          game: { select: { code: true, name: true } },
          draw: { select: { drawNumber: true, scheduledAt: true } },
          vendor: { select: { vendorCode: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: items.map((t) => ({
        ...t,
        totalAmount: Number(t.totalAmount),
        wonAmount: Number(t.wonAmount),
      })),
    };
  }

  async findById(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        game: true,
        draw: true,
        vendor: true,
        transactions: true,
      },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }
    return {
      ...ticket,
      totalAmount: Number(ticket.totalAmount),
      wonAmount: Number(ticket.wonAmount),
    };
  }

  async findByNumber(ticketNumber: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketNumber },
      include: {
        game: { select: { code: true, name: true } },
        draw: { select: { drawNumber: true, scheduledAt: true, status: true, winningResults: true } },
        vendor: { select: { vendorCode: true, fullName: true, posAddress: true } },
      },
    });
    if (!ticket) {
      throw new NotFoundException('Numéro de ticket inconnu');
    }
    return {
      ...ticket,
      totalAmount: Number(ticket.totalAmount),
      wonAmount: Number(ticket.wonAmount),
    };
  }
}
