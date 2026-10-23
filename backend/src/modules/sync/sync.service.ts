import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { AuditService } from '../audit/audit.service';
import { BatchSyncDto } from './dto/batch-sync.dto';
import { VendorStatus, DeviceStatus, DrawStatus } from '@prisma/client';

export interface ProcessedSyncTicket {
  idempotencyKey: string;
  status: 'SUCCESS' | 'ALREADY_SYNCED' | 'REJECTED';
  ticketNumber?: string;
  secureChecksum?: string;
  totalAmount?: number;
  reason?: string;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Synchronisation par lot d'opérations préparées hors ligne (Offline Sync Queue)
   * Garantit l'idempotence stricte et l'intégrité temporelle des tirages
   */
  async syncBatch(dto: BatchSyncDto, vendorId: string, operatorUserId: string) {
    const now = new Date();

    // 1. Contrôle du statut du vendeur
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (!vendor || vendor.status !== VendorStatus.ACTIVE) {
      throw new ForbiddenException('Compte vendeur inactif ou suspendu. Synchronisation rejetée.');
    }

    // 2. Contrôle de l'appareil Android
    const device = await this.prisma.device.findUnique({
      where: { deviceUuid: dto.deviceUuid },
    });
    if (!device || device.status !== DeviceStatus.AUTHORIZED || device.vendorId !== vendorId) {
      throw new ForbiddenException('Appareil non autorisé pour la synchronisation.');
    }

    // Mise à jour de l'heure de synchronisation du terminal
    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: now,
        isOnline: true,
      },
    });

    const processedTickets: ProcessedSyncTicket[] = [];
    let successCount = 0;
    let duplicateCount = 0;
    let rejectedCount = 0;

    // 3. Traitement ordonné de chaque ticket en attente
    for (const pendingTicket of dto.pendingTickets) {
      const key = pendingTicket.idempotencyKey;

      try {
        // RÈGLE ANTI-DOUBLON IDEMPOTENTE : vérifier si la transaction a déjà été validée
        const existingTx = await this.prisma.transaction.findUnique({
          where: { reference: key },
          include: {
            ticket: { select: { ticketNumber: true, secureChecksum: true, totalAmount: true } },
          },
        });

        if (existingTx) {
          duplicateCount++;
          processedTickets.push({
            idempotencyKey: key,
            status: 'ALREADY_SYNCED',
            ticketNumber: existingTx.ticket?.ticketNumber || 'TICKET-EXISTANT',
            secureChecksum: existingTx.ticket?.secureChecksum,
            totalAmount: Number(existingTx.ticket?.totalAmount || Math.abs(Number(existingTx.amount))),
            reason: 'Ticket déjà validé avec succès (anti-doublon idempotent).',
          });
          continue;
        }

        // RÈGLE TEMPORELLE ABSOLUE : Vérifier que le tirage n'a pas fermé avant l'arrivée au serveur
        const draw = await this.prisma.draw.findUnique({
          where: { id: pendingTicket.drawId },
        });

        if (!draw) {
          rejectedCount++;
          processedTickets.push({
            idempotencyKey: key,
            status: 'REJECTED',
            reason: 'Tirage introuvable.',
          });
          continue;
        }

        if (draw.status !== DrawStatus.OPEN || now >= new Date(draw.salesClosingAt)) {
          rejectedCount++;
          processedTickets.push({
            idempotencyKey: key,
            status: 'REJECTED',
            reason: `Vente rejetée : les ventes sont closes pour ce tirage depuis ${new Date(draw.salesClosingAt).toLocaleTimeString()}.`,
          });
          continue;
        }

        // Exécution transactionnelle de la vente
        const saleResult = await this.ticketsService.sellTicket(
          pendingTicket,
          vendorId,
          operatorUserId,
        );

        successCount++;
        processedTickets.push({
          idempotencyKey: key,
          status: 'SUCCESS',
          ticketNumber: saleResult.ticket.ticketNumber,
          secureChecksum: saleResult.ticket.secureChecksum,
          totalAmount: saleResult.ticket.totalAmount,
        });
      } catch (err: any) {
        rejectedCount++;
        processedTickets.push({
          idempotencyKey: key,
          status: 'REJECTED',
          reason: err.message || 'Erreur lors de la validation du ticket.',
        });
      }
    }

    // 4. Récupération du delta pour rafraîchir le cache local du terminal POS
    const [latestVendor, openDraws, activeGames] = await Promise.all([
      this.prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { currentBalance: true, creditLimit: true, dailySalesLimit: true },
      }),
      this.prisma.draw.findMany({
        where: {
          status: DrawStatus.OPEN,
          salesClosingAt: { gt: now },
        },
        include: {
          game: { select: { id: true, code: true, name: true, minBetAmount: true, maxBetAmount: true } },
        },
        orderBy: { salesClosingAt: 'asc' },
      }),
      this.prisma.game.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, code: true, name: true, minBetAmount: true, maxBetAmount: true, gameRules: true },
      }),
    ]);

    // 5. Journalisation d'audit
    if (dto.pendingTickets.length > 0) {
      await this.auditService.log({
        userId: operatorUserId,
        action: 'OFFLINE_SYNC_PROCESSED',
        resource: `Vendor:${vendorId}`,
        newPayload: {
          deviceUuid: dto.deviceUuid,
          totalSubmitted: dto.pendingTickets.length,
          successCount,
          duplicateCount,
          rejectedCount,
        },
      });
    }

    this.logger.log(
      `Synchronisation terminée pour ${vendor.vendorCode} (${dto.deviceUuid}) : ${successCount} validés, ${duplicateCount} doublons évités, ${rejectedCount} rejetés.`,
    );

    return {
      serverTime: now.toISOString(),
      summary: {
        total: dto.pendingTickets.length,
        success: successCount,
        duplicates: duplicateCount,
        rejected: rejectedCount,
      },
      processedTickets,
      delta: {
        vendorBalance: Math.abs(Number(latestVendor?.currentBalance || 0)),
        creditLimit: Number(latestVendor?.creditLimit || 0),
        openDraws: openDraws.map((d) => ({
          id: d.id,
          drawNumber: d.drawNumber,
          gameId: d.gameId,
          gameCode: d.game.code,
          gameName: d.game.name,
          scheduledAt: d.scheduledAt,
          salesClosingAt: d.salesClosingAt,
        })),
        activeGames: activeGames.map((g) => ({
          ...g,
          minBetAmount: Number(g.minBetAmount),
          maxBetAmount: Number(g.maxBetAmount),
        })),
      },
    };
  }

  /**
   * Statut de synchronisation et synchronisation d'horloge pour le POS
   */
  async getSyncStatus(vendorId: string) {
    const now = new Date();
    const openDraws = await this.prisma.draw.findMany({
      where: {
        status: DrawStatus.OPEN,
        salesClosingAt: { gt: now },
      },
      select: {
        id: true,
        drawNumber: true,
        salesClosingAt: true,
        game: { select: { code: true, name: true } },
      },
      orderBy: { salesClosingAt: 'asc' },
    });

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { currentBalance: true, status: true },
    });

    return {
      serverTime: now.toISOString(),
      vendorStatus: vendor?.status,
      currentBalance: Math.abs(Number(vendor?.currentBalance || 0)),
      openDrawsCount: openDraws.length,
      nextClosingDraw: openDraws[0] || null,
    };
  }
}
