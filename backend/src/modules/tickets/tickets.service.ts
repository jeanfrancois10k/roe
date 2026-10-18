import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CommissionsService } from '../commissions/commissions.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SellTicketDto } from './dto/sell-ticket.dto';
import { CancelTicketDto } from './dto/cancel-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { VerifyTicketDto } from './dto/verify-ticket.dto';
import { PayTicketDto } from './dto/pay-ticket.dto';
import {
  TicketStatus,
  TicketPayoutStatus,
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
    @Optional() private readonly commissionsService?: CommissionsService,
    @Optional() private readonly realtimeGateway?: RealtimeGateway,
  ) {
    this.hmacSecret =
      this.configService.get<string>('HMAC_TICKET_SECRET') ||
      'roe_bolet_hmac_ticket_checksum_salt_998877';
    this.cancellationWindowMinutes =
      Number(this.configService.get<number>('CANCELLATION_WINDOW_MINUTES')) || 30;
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
    const totalAmount = dto.grids.reduce((acc, g) => acc + (g.betAmount || 0) * (g.multiplier || 1), 0);
    if (totalAmount < 0) {
      throw new BadRequestException('Le montant total du ticket ne peut pas être négatif.');
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

    // RÈGLE 7 : Validation des montants par grille (sauf Maryaj Gratis)
    for (const grid of dto.grids) {
      const isGratis = grid.isGratis === true || grid.option === 'GRATIS' || (grid.gameType === 'MARIAGE' && grid.betAmount === 0);
      if (isGratis) {
        continue;
      }
      if (grid.betAmount < Number(game.minBetAmount) || grid.betAmount > Number(game.maxBetAmount)) {
        throw new BadRequestException(
          `Mise non conforme : min ${game.minBetAmount} G, max ${game.maxBetAmount} G par combinaison.`,
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

    // RÈGLE 5.1 : Horaires autorisés de vente de la journée (à partir de 07h00 en heure d'Haïti)
    const haitiHourStr = now.toLocaleTimeString('en-US', {
      timeZone: 'America/Port-au-Prince',
      hour12: false,
      hour: '2-digit',
    });
    const haitiHour = parseInt(haitiHourStr, 10);

    if (haitiHour < 7) {
      throw new BadRequestException(
        'Vente rejetée : Les ventes de la journée débutent à 07h00 du matin (heure d’Haïti).',
      );
    }

    // RÈGLE CRITIQUE : VÉRIFICATION DES NUMÉROS BLOQUÉS & PLAFONDS PAR NUMÉRO
    const restrictedNumbers = this.prisma.blockedNumber
      ? await this.prisma.blockedNumber.findMany({
          where: {
            OR: [
              { gameId: null, drawId: null },
              { gameId: game.id, drawId: null },
              { drawId: draw.id },
            ],
          },
        })
      : [];

    if (restrictedNumbers.length > 0) {
      for (const grid of dto.grids) {
        // Obtenir tous les numéros joués dans la grille (grid.numbers)
        const numbersPlayed = Array.isArray(grid.numbers)
          ? grid.numbers.map(String)
          : [String(grid.numbers)];

        for (const num of numbersPlayed) {
          const restriction = restrictedNumbers.find((r) => r.number === num);
          if (restriction) {
            // 1. Bloqué totalement
            if (restriction.isBlocked || restriction.maxAmount === null || Number(restriction.maxAmount) <= 0) {
              throw new BadRequestException(
                `Vente rejetée : Le numéro [${num}] est actuellement BLOQUÉ par l'administration.`,
              );
            }

            // 2. Plafond max par numéro pour ce tirage
            if (restriction.maxAmount !== null && Number(restriction.maxAmount) > 0) {
              const maxAllowed = Number(restriction.maxAmount);
              if (grid.betAmount > maxAllowed) {
                throw new BadRequestException(
                  `Vente rejetée : La mise sur le numéro [${num}] (${grid.betAmount} G) dépasse le plafond autorisé de ${maxAllowed} G.`,
                );
              }
            }
          }
        }
      }
    }

    // RÈGLE 6 : Plafonds vendeur (Max par ticket & Plafond journalier)
    if (totalAmount > Number(vendor.maxTicketAmount)) {
      throw new BadRequestException(
        `Dépassement de plafond : montant max autorisé par ticket est de ${vendor.maxTicketAmount} G.`,
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
        `Plafond journalier de vente (${vendor.dailySalesLimit} G) atteint pour ce vendeur.`,
      );
    }

    // G憶ration du num鑽o unique de ticket et de la signature QR code
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    const ticketNumber = `ROE-${dateStr}-${randomSuffix}`;
    const secureChecksum = this.generateChecksum(ticketNumber, totalAmount, draw.id);

    // Calcul dynamique de la commission (moteur multi-règles)
    let commissionAmount = 0;
    let commissionDescription = '';

    if (this.commissionsService) {
      const calc = await this.commissionsService.calculateCommission(
        vendorId,
        game.id,
        totalAmount,
        dto.grids.length,
      );
      commissionAmount = calc.commissionAmount;
      commissionDescription = `Commission ${calc.rateValue}${calc.rateType === 'PERCENTAGE' ? '%' : ' (fixe)'} sur Vente ${ticketNumber}`;
    } else {
      const commissionRate = Number(vendor.defaultCommissionRate || 5.0);
      commissionAmount = Number(((totalAmount * commissionRate) / 100).toFixed(2));
      commissionDescription = `Commission ${commissionRate}% sur Vente ${ticketNumber}`;
    }

    // RÈGLE 9 & 10 : TRANSACTION ATOMIQUE AVEC LOCK PESSIMISTE POSTGRESQL
    return await this.prisma.$transaction(async (tx) => {
      // Arbitrage strict sous transaction : re-vérification du tirage et de l'heure exacte de validation
      const [lockedDraw] = await tx.$queryRaw<Array<{ id: string; status: string; salesClosingAt: Date }>>`
        SELECT "id", "status", "salesClosingAt" 
        FROM "Draw" 
        WHERE "id" = ${dto.drawId}::uuid 
        FOR SHARE
      `;

      if (!lockedDraw || lockedDraw.status !== DrawStatus.OPEN) {
        throw new BadRequestException('Vente rejetée : les ventes pour ce tirage ne sont pas ouvertes.');
      }

      const txExecutionTime = new Date();
      if (txExecutionTime >= new Date(lockedDraw.salesClosingAt)) {
        throw new BadRequestException(
          `Vente rejetée : heure limite de clôture atteinte ou dépassée (${new Date(lockedDraw.salesClosingAt).toLocaleTimeString()}).`,
        );
      }

      // Locking pessimiste sur la ligne du vendeur
      const [lockedVendor] = await tx.$queryRaw<Array<{ currentBalance: any; creditLimit: any }>>`
        SELECT "currentBalance", "creditLimit" 
        FROM "Vendor" 
        WHERE "id" = ${vendorId}::uuid 
        FOR UPDATE
      `;

      const currentBal = Number(lockedVendor.currentBalance);
      const creditLim = Number(lockedVendor.creditLimit);

      // Le modèle Borlette standard : le vendeur encaisse le cash des parieurs
      // Le solde évolue naturellement avec les ventes et commissions.
      // La sécurité est assurée par le plafond journalier (vendor.dailySalesLimit) et le montant max par ticket.


      // 1. Débit de la vente
      const balanceAfterSale = currentBal - totalAmount;
      const netBalanceAfter = balanceAfterSale + commissionAmount;

      await tx.vendor.update({
        where: { id: vendorId },
        data: {
          currentBalance: netBalanceAfter,
          lastActivityAt: now,
        },
      });

      // 2. Écriture Ledger : Débit de la Vente
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

      // 3. Écriture Ledger : Crédit de la Commission immédiate
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
            description: commissionDescription,
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

      const ticketPayload = {
        id: createdTicket.id,
        ticketNumber: createdTicket.ticketNumber,
        secureChecksum: createdTicket.secureChecksum,
        gameName: game.name,
        drawNumber: draw.drawNumber,
        scheduledAt: draw.scheduledAt,
        totalAmount: Number(createdTicket.totalAmount),
        status: createdTicket.status,
        playedGrids: dto.grids,
        vendorCode: vendor.vendorCode,
        posAddress: vendor.posAddress,
        createdAt: createdTicket.createdAt,
        newBalance: netBalanceAfter,
      };

      return {
        success: true,
        ...ticketPayload,
        ticket: ticketPayload,
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

      // Écriture Ledger : Remboursement de la vente
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
    if (query.search) where.ticketNumber = { contains: query.search, mode: 'insensitive' };

    const [total, items] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        include: {
          game: { select: { id: true, code: true, name: true } },
          draw: { select: { id: true, drawNumber: true, scheduledAt: true, salesClosingAt: true, status: true } },
          vendor: { select: { vendorCode: true, fullName: true, posAddress: true } },
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
    const clean = (ticketNumber || '').trim();
    let ticket = await this.prisma.ticket.findUnique({
      where: { ticketNumber: clean },
      include: {
        game: { select: { code: true, name: true } },
        draw: { select: { drawNumber: true, scheduledAt: true, status: true, winningResults: true } },
        vendor: { select: { vendorCode: true, fullName: true, posAddress: true } },
      },
    });
    if (!ticket) {
      ticket = await this.prisma.ticket.findFirst({
        where: { ticketNumber: { equals: clean, mode: 'insensitive' } },
        include: {
          game: { select: { code: true, name: true } },
          draw: { select: { drawNumber: true, scheduledAt: true, status: true, winningResults: true } },
          vendor: { select: { vendorCode: true, fullName: true, posAddress: true } },
        },
      });
    }
    if (!ticket) {
      throw new NotFoundException('Numéro de ticket inconnu');
    }
    return {
      ...ticket,
      totalAmount: Number(ticket.totalAmount),
      wonAmount: Number(ticket.wonAmount),
    };
  }

  /**
   * Vérification approfondie d'un ticket (par numéro ou scan QR code)
   */
  async verifyTicket(dto: VerifyTicketDto) {
    let cleanNumber = dto.query.trim();
    let providedChecksum = dto.checksum?.trim();

    // Si le scan QR code contient le format "NUMERO|CHECKSUM"
    if (cleanNumber.includes('|')) {
      const parts = cleanNumber.split('|');
      cleanNumber = parts[0];
      if (!providedChecksum && parts.length > 1) {
        providedChecksum = parts[1];
      }
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { ticketNumber: cleanNumber },
      include: {
        game: { select: { id: true, code: true, name: true, gameRules: true } },
        draw: {
          select: {
            id: true,
            drawNumber: true,
            status: true,
            scheduledAt: true,
            publishedAt: true,
            winningResults: true,
          },
        },
        vendor: { select: { id: true, vendorCode: true, fullName: true, posAddress: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket introuvable pour la référence '${cleanNumber}'.`);
    }

    // Vérification de la signature d'authenticité HMAC
    const expectedChecksum = this.generateChecksum(
      ticket.ticketNumber,
      Number(ticket.totalAmount),
      ticket.drawId,
    );
    const isAuthentic = providedChecksum ? providedChecksum === expectedChecksum : true;

    if (providedChecksum && !isAuthentic) {
      throw new BadRequestException('Alerte de sécurité : signature cryptographique du QR code non conforme !');
    }

    const now = new Date();
    const isExpired = now > new Date(ticket.expiresAt);
    const wonAmount = Number(ticket.wonAmount || 0);

    let statusKey: 'CANCELLED' | 'VOID' | 'EXPIRED' | 'PENDING_DRAW' | 'ALREADY_PAID' | 'WINNER' | 'NOT_A_WINNER';
    let statusLabel: string;
    let canBePaid = false;

    if (ticket.status === TicketStatus.CANCELLED) {
      statusKey = 'CANCELLED';
      statusLabel = 'TICKET ANNULÉ';
    } else if (ticket.status === TicketStatus.VOID) {
      statusKey = 'VOID';
      statusLabel = 'TICKET INVALIDÉ';
    } else if (isExpired) {
      statusKey = 'EXPIRED';
      statusLabel = 'TICKET EXPIRÉ (Délai de 90 jours dépassé)';
    } else if (ticket.draw.status !== DrawStatus.PUBLISHED) {
      statusKey = 'PENDING_DRAW';
      statusLabel = 'TIRAGE EN COURS (Résultats non encore publiés)';
    } else if (ticket.isWinner && wonAmount > 0) {
      if (ticket.payoutStatus === TicketPayoutStatus.PAID) {
        statusKey = 'ALREADY_PAID';
        statusLabel = 'TICKET DÉJÀ PAYÉ';
      } else {
        statusKey = 'WINNER';
        statusLabel = 'TICKET GAGNANT !';
        canBePaid = true;
      }
    } else {
      statusKey = 'NOT_A_WINNER';
      statusLabel = 'TICKET NON GAGNANT';
    }

    return {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      isAuthentic,
      gameName: ticket.game.name,
      gameCode: ticket.game.code,
      drawNumber: ticket.draw.drawNumber,
      drawStatus: ticket.draw.status,
      scheduledAt: ticket.draw.scheduledAt,
      winningResults: ticket.draw.winningResults,
      playedGrids: ticket.playedGrids,
      totalAmount: Number(ticket.totalAmount),
      wonAmount,
      isWinner: Boolean(ticket.isWinner),
      payoutStatus: ticket.payoutStatus,
      paidAt: ticket.paidAt,
      paidByVendorId: ticket.paidByVendorId,
      expiresAt: ticket.expiresAt,
      statusKey,
      statusLabel,
      canBePaid,
    };
  }

  /**
   * Paiement sécurisé d'un lot gagnant avec verrouillage pessimiste anti-double paiement
   */
  async payTicketPrize(dto: PayTicketDto, vendorId: string, operatorUserId: string) {
    const now = new Date();

    // 1. Vérification du Vendeur payeur
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (!vendor || vendor.status !== VendorStatus.ACTIVE) {
      throw new ForbiddenException('Vendeur inactif ou non autorisé à effectuer des paiements.');
    }

    // 2. Vérification de l'appareil Android
    const device = await this.prisma.device.findUnique({
      where: { deviceUuid: dto.deviceUuid },
    });
    if (!device || device.status !== DeviceStatus.AUTHORIZED || device.vendorId !== vendorId) {
      throw new ForbiddenException('Appareil non autorisé pour cette opération financière.');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 3. Verrouillage pessimiste PostgreSQL sur le TICKET
      const [lockedTicket] = await tx.$queryRaw<Array<{
        id: string;
        ticketNumber: string;
        status: TicketStatus;
        isWinner: boolean;
        wonAmount: any;
        payoutStatus: TicketPayoutStatus;
        expiresAt: Date;
        drawId: string;
      }>>`
        SELECT "id", "ticketNumber", "status", "isWinner", "wonAmount", "payoutStatus", "expiresAt", "drawId"
        FROM "Ticket"
        WHERE "id" = ${dto.ticketId}::uuid
        FOR UPDATE
      `;

      if (!lockedTicket) {
        throw new NotFoundException('Ticket introuvable');
      }

      // CONTRÔLE ABSOLU ANTI-DOUBLE PAIEMENT
      if (lockedTicket.payoutStatus === TicketPayoutStatus.PAID) {
        throw new BadRequestException('Alerte Fraude : Ce ticket a DÉJÀ ÉTÉ PAYÉ.');
      }

      if (lockedTicket.status !== TicketStatus.CONFIRMED) {
        throw new BadRequestException(`Ce ticket ne peut être payé (Statut : ${lockedTicket.status}).`);
      }

      const wonAmount = Number(lockedTicket.wonAmount);
      if (!lockedTicket.isWinner || wonAmount <= 0) {
        throw new BadRequestException('Ce ticket n’est pas gagnant.');
      }

      if (now > new Date(lockedTicket.expiresAt)) {
        throw new BadRequestException('Ce ticket a expiré et ne peut plus être payé.');
      }

      // 4. Verrouillage pessimiste sur le compte VENDEUR pour remboursement du gain avancé
      const [lockedVendor] = await tx.$queryRaw<Array<{ id: string; currentBalance: any; vendorCode: string }>>`
        SELECT "id", "currentBalance", "vendorCode"
        FROM "Vendor"
        WHERE "id" = ${vendorId}::uuid
        FOR UPDATE
      `;

      const balanceBefore = Number(lockedVendor.currentBalance);
      const balanceAfter = Number((balanceBefore + wonAmount).toFixed(2));

      // 5. Crédit du solde vendeur (la maison lui rembourse le cash remis au gagnant)
      await tx.vendor.update({
        where: { id: vendorId },
        data: {
          currentBalance: balanceAfter,
          lastActivityAt: now,
        },
      });

      // 6. Écriture Grand Livre : PRIZE_PAYOUT
      const reference = dto.idempotencyKey || `PAY-${lockedTicket.ticketNumber}`;
      await tx.transaction.create({
        data: {
          vendorId,
          operatorId: operatorUserId,
          ticketId: lockedTicket.id,
          type: TransactionType.PRIZE_PAYOUT,
          amount: wonAmount,
          balanceBefore,
          balanceAfter,
          reference,
          description: `Paiement Gain Ticket ${lockedTicket.ticketNumber} ($${wonAmount.toFixed(2)})`,
        },
      });

      // 7. Scellement définitif du Ticket en PAID
      const updatedTicket = await tx.ticket.update({
        where: { id: lockedTicket.id },
        data: {
          payoutStatus: TicketPayoutStatus.PAID,
          paidAt: now,
          paidByVendorId: vendorId,
        },
        include: {
          game: { select: { name: true, code: true } },
          draw: { select: { drawNumber: true } },
        },
      });

      // 8. Audit Log
      await this.auditService.log({
        userId: operatorUserId,
        action: 'TICKET_PRIZE_PAID',
        resource: `Ticket:${lockedTicket.id}`,
        newPayload: {
          ticketNumber: lockedTicket.ticketNumber,
          wonAmount,
          paidByVendorCode: lockedVendor.vendorCode,
          balanceBefore,
          balanceAfter,
        },
      });

      // 9. Émission WebSocket
      if (this.realtimeGateway?.server) {
        this.realtimeGateway.server.emit('ticket:paid', {
          ticketId: lockedTicket.id,
          ticketNumber: lockedTicket.ticketNumber,
          wonAmount,
          paidByVendorId: vendorId,
          paidAt: now.toISOString(),
        });
      }

      this.logger.log(
        `Gain payé avec succès : Ticket ${lockedTicket.ticketNumber} ($${wonAmount.toFixed(2)}) par ${lockedVendor.vendorCode}`,
      );

      return {
        success: true,
        message: `Gain de $${wonAmount.toFixed(2)} payé avec succès.`,
        ticket: {
          id: updatedTicket.id,
          ticketNumber: updatedTicket.ticketNumber,
          wonAmount,
          paidAt: updatedTicket.paidAt,
          payoutStatus: updatedTicket.payoutStatus,
        },
        vendor: {
          id: vendorId,
          newBalance: balanceAfter,
        },
      };
    });
  }
}
