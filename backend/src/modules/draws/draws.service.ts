import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { DrawEvaluatorService } from './draw-evaluator.service';
import { CreateDrawDto } from './dto/create-draw.dto';
import { SetResultsDto, WinningResultsDto } from './dto/set-results.dto';
import { OverrideResultsDto } from './dto/override-results.dto';
import { DrawStatus, TicketStatus, TicketPayoutStatus } from '@prisma/client';

@Injectable()
export class DrawsService {
  private readonly logger = new Logger(DrawsService.name);
  private readonly validationSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly evaluator: DrawEvaluatorService,
    private readonly configService: ConfigService,
  ) {
    this.validationSecret =
      this.configService.get<string>('DRAW_VALIDATION_SECRET') ||
      'roe_bolet_certified_draw_seal_secret_2026';
  }

  /**
   * Signature cryptographique certifiée SHA-256 scellant les résultats du tirage
   */
  private generateValidationHash(
    drawId: string,
    drawNumber: number,
    winningResults: any,
    publishedAt: Date,
    adminId: string,
  ): string {
    const payload = `${drawId}|${drawNumber}|${JSON.stringify(winningResults)}|${publishedAt.toISOString()}|${adminId}`;
    return crypto.createHmac('sha256', this.validationSecret).update(payload).digest('hex');
  }

  async create(dto: CreateDrawDto, adminId?: string) {
    const game = await this.prisma.game.findUnique({ where: { id: dto.gameId } });
    if (!game) {
      throw new NotFoundException('Jeu introuvable');
    }

    const scheduledDate = new Date(dto.scheduledAt);
    const closingDate = new Date(dto.salesClosingAt);

    if (closingDate >= scheduledDate) {
      throw new BadRequestException('La clôture des ventes doit être strictement antérieure à l’heure du tirage.');
    }

    const draw = await this.prisma.draw.create({
      data: {
        gameId: dto.gameId,
        scheduledAt: scheduledDate,
        salesClosingAt: closingDate,
        status: DrawStatus.OPEN,
      },
      include: {
        game: { select: { code: true, name: true } },
      },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'DRAW_CREATED',
      resource: `Draw:${draw.id}`,
      newPayload: {
        drawNumber: draw.drawNumber,
        gameCode: draw.game.code,
        closingAt: draw.salesClosingAt,
      },
    });

    this.logger.log(`Nouveau tirage planifié : N°${draw.drawNumber} pour ${draw.game.name}`);

    return draw;
  }

  async getOpenDraws(gameId?: string) {
    const now = new Date();
    const where: any = {
      status: DrawStatus.OPEN,
      salesClosingAt: { gt: now },
    };
    if (gameId) where.gameId = gameId;

    return this.prisma.draw.findMany({
      where,
      include: {
        game: { select: { id: true, code: true, name: true, minBetAmount: true, maxBetAmount: true } },
      },
      orderBy: { salesClosingAt: 'asc' },
    });
  }

  async findAll(gameId?: string, status?: DrawStatus, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (gameId) where.gameId = gameId;
    if (status) where.status = status;

    const [total, items] = await Promise.all([
      this.prisma.draw.count({ where }),
      this.prisma.draw.findMany({
        where,
        skip,
        take: limit,
        include: {
          game: { select: { id: true, code: true, name: true } },
          _count: { select: { tickets: true } },
        },
        orderBy: { scheduledAt: 'desc' },
      }),
    ]);

    return { total, page, limit, items };
  }

  async findById(id: string) {
    const draw = await this.prisma.draw.findUnique({
      where: { id },
      include: {
        game: true,
        _count: { select: { tickets: true } },
      },
    });
    if (!draw) {
      throw new NotFoundException('Tirage introuvable');
    }
    return draw;
  }

  async closeDraw(id: string, adminId?: string) {
    const draw = await this.prisma.draw.findUnique({ where: { id } });
    if (!draw) {
      throw new NotFoundException('Tirage introuvable');
    }

    if (draw.status === DrawStatus.PUBLISHED) {
      throw new BadRequestException('Impossible de fermer un tirage déjà publié.');
    }

    const updated = await this.prisma.draw.update({
      where: { id },
      data: { status: DrawStatus.CLOSED },
      include: { game: { select: { code: true, name: true } } },
    });

    if (this.realtimeGateway?.server) {
      this.realtimeGateway.server.emit('draw:closed', {
        drawId: draw.id,
        drawNumber: draw.drawNumber,
        gameCode: updated.game.code,
        timestamp: new Date().toISOString(),
      });
    }

    await this.auditService.log({
      userId: adminId,
      action: 'DRAW_CLOSED',
      resource: `Draw:${id}`,
      newPayload: { drawNumber: draw.drawNumber, status: DrawStatus.CLOSED },
    });

    return updated;
  }

  /**
   * Saisie des résultats officiels d'un tirage
   */
  async setResults(id: string, dto: SetResultsDto, adminId: string) {
    const draw = await this.prisma.draw.findUnique({
      where: { id },
      include: { game: true },
    });

    if (!draw) {
      throw new NotFoundException('Tirage introuvable');
    }

    if (draw.status === DrawStatus.PUBLISHED) {
      throw new BadRequestException(
        'Ce tirage est déjà scellé et publié. Toute modification requiert la procédure exceptionnelle de rectification.',
      );
    }

    const drawnAt = new Date();

    const updated = await this.prisma.draw.update({
      where: { id },
      data: {
        status: DrawStatus.DRAWN,
        drawnAt,
        winningResults: dto.winningResults as any,
      },
      include: { game: true },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'DRAW_RESULTS_SET',
      resource: `Draw:${id}`,
      newPayload: {
        drawNumber: draw.drawNumber,
        winningResults: dto.winningResults,
      },
    });

    if (dto.publishImmediately) {
      return this.publishDraw(id, adminId);
    }

    return updated;
  }

  /**
   * Publication officielle scellée du tirage & Évaluation batch des tickets
   */
  async publishDraw(id: string, adminId: string) {
    const draw = await this.prisma.draw.findUnique({
      where: { id },
      include: { game: true },
    });

    if (!draw) {
      throw new NotFoundException('Tirage introuvable');
    }

    if (draw.status === DrawStatus.PUBLISHED) {
      throw new BadRequestException('Ce tirage est déjà officiellement publié.');
    }

    if (!draw.winningResults) {
      throw new BadRequestException('Impossible de publier : les numéros gagnants ne sont pas renseignés.');
    }

    const publishedAt = new Date();
    const validationHash = this.generateValidationHash(
      draw.id,
      draw.drawNumber,
      draw.winningResults,
      publishedAt,
      adminId,
    );

    // 1. Mise à jour du statut du tirage et scellement SHA-256
    const publishedDraw = await this.prisma.draw.update({
      where: { id },
      data: {
        status: DrawStatus.PUBLISHED,
        publishedAt,
        validationHash,
      },
      include: { game: true },
    });

    // 2. Évaluation automatique en batch de tous les tickets CONFIRMED de ce tirage
    const tickets = await this.prisma.ticket.findMany({
      where: {
        drawId: id,
        status: TicketStatus.CONFIRMED,
      },
    });

    let totalWinners = 0;
    let totalWonAmount = 0;

    for (const ticket of tickets) {
      const grids = ticket.playedGrids as any[];
      const evalResult = this.evaluator.evaluateTicket(
        grids,
        draw.winningResults as unknown as WinningResultsDto,
        draw.game.gameRules,
      );

      if (evalResult.isWinner) {
        totalWinners++;
        totalWonAmount += evalResult.totalWonAmount;

        await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            isWinner: true,
            wonAmount: evalResult.totalWonAmount,
            payoutStatus: TicketPayoutStatus.UNPAID,
          },
        });
      } else {
        await this.prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            isWinner: false,
            wonAmount: 0.0,
            payoutStatus: TicketPayoutStatus.UNPAID,
          },
        });
      }
    }

    // 3. Journalisation d'audit scellée
    await this.auditService.log({
      userId: adminId,
      action: 'DRAW_RESULTS_PUBLISHED',
      resource: `Draw:${id}`,
      newPayload: {
        drawNumber: draw.drawNumber,
        gameCode: draw.game.code,
        winningResults: draw.winningResults,
        validationHash,
        ticketsEvaluated: tickets.length,
        totalWinners,
        totalWonAmount: Number(totalWonAmount.toFixed(2)),
      },
    });

    // 4. Notification en temps réel WebSocket
    if (this.realtimeGateway?.server) {
      this.realtimeGateway.server.emit('draw:results_published', {
        drawId: publishedDraw.id,
        drawNumber: publishedDraw.drawNumber,
        gameCode: publishedDraw.game.code,
        gameName: publishedDraw.game.name,
        winningResults: publishedDraw.winningResults,
        validationHash,
        publishedAt: publishedAt.toISOString(),
        totalWinners,
        totalWonAmount: Number(totalWonAmount.toFixed(2)),
      });
    }

    this.logger.log(
      `Tirage N°${publishedDraw.drawNumber} publié (${publishedDraw.game.name}). ${tickets.length} tickets analysés, ${totalWinners} gagnants ($${totalWonAmount.toFixed(2)} à payer).`,
    );

    return {
      ...publishedDraw,
      evaluationSummary: {
        ticketsEvaluated: tickets.length,
        totalWinners,
        totalWonAmount: Number(totalWonAmount.toFixed(2)),
      },
    };
  }

  /**
   * Procédure administrative exceptionnelle de rectification des résultats (Audité & Traçable)
   */
  async overrideResults(id: string, dto: OverrideResultsDto, adminId: string) {
    const draw = await this.prisma.draw.findUnique({
      where: { id },
      include: { game: true },
    });

    if (!draw) {
      throw new NotFoundException('Tirage introuvable');
    }

    // Vérifier si des tickets ont déjà été payés avec les anciens résultats
    const alreadyPaidCount = await this.prisma.ticket.count({
      where: {
        drawId: id,
        payoutStatus: TicketPayoutStatus.PAID,
      },
    });

    const oldResults = draw.winningResults;
    const publishedAt = new Date();
    const newHash = this.generateValidationHash(
      draw.id,
      draw.drawNumber,
      dto.winningResults,
      publishedAt,
      adminId,
    );

    // Mise à jour des résultats rectifiés
    const updatedDraw = await this.prisma.draw.update({
      where: { id },
      data: {
        winningResults: dto.winningResults as any,
        validationHash: newHash,
        publishedAt,
      },
      include: { game: true },
    });

    // Ré-évaluation des tickets non encore payés
    const tickets = await this.prisma.ticket.findMany({
      where: {
        drawId: id,
        status: TicketStatus.CONFIRMED,
        payoutStatus: { not: TicketPayoutStatus.PAID },
      },
    });

    let newWinnersCount = 0;
    let newWonTotal = 0;

    for (const ticket of tickets) {
      const grids = ticket.playedGrids as any[];
      const evalResult = this.evaluator.evaluateTicket(
        grids,
        dto.winningResults,
        draw.game.gameRules,
      );

      if (evalResult.isWinner) {
        newWinnersCount++;
        newWonTotal += evalResult.totalWonAmount;
      }

      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          isWinner: evalResult.isWinner,
          wonAmount: evalResult.totalWonAmount,
        },
      });
    }

    // Audit strict de haute criticité
    await this.auditService.log({
      userId: adminId,
      action: 'DRAW_RESULTS_OVERRIDDEN',
      resource: `Draw:${id}`,
      oldPayload: { oldResults, previousValidationHash: draw.validationHash },
      newPayload: {
        newResults: dto.winningResults,
        justificationReason: dto.justificationReason,
        alreadyPaidCount,
        newWinnersCount,
        newWonTotal: Number(newWonTotal.toFixed(2)),
        newValidationHash: newHash,
      },
    });

    if (this.realtimeGateway?.server) {
      this.realtimeGateway.server.emit('draw:results_overridden', {
        drawId: draw.id,
        drawNumber: draw.drawNumber,
        gameCode: draw.game.code,
        winningResults: dto.winningResults,
        justificationReason: dto.justificationReason,
        timestamp: new Date().toISOString(),
      });
    }

    this.logger.warn(
      `RECTIFICATION EXCEPTIONNELLE DU TIRAGE N°${draw.drawNumber} par ${adminId}. Motif: ${dto.justificationReason}`,
    );

    return {
      ...updatedDraw,
      warning: alreadyPaidCount > 0 ? `${alreadyPaidCount} tickets avaient déjà été payés avant rectification.` : null,
      reEvaluationSummary: {
        ticketsReEvaluated: tickets.length,
        alreadyPaidCount,
        newWinnersCount,
        newWonTotal: Number(newWonTotal.toFixed(2)),
      },
    };
  }

  /**
   * Consultation des résultats du jour pour l'affichage public et les terminaux vendeurs
   */
  async getTodayResults() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const draws = await this.prisma.draw.findMany({
      where: {
        status: DrawStatus.PUBLISHED,
        publishedAt: { gte: startOfToday },
      },
      include: {
        game: { select: { id: true, code: true, name: true } },
      },
      orderBy: { publishedAt: 'desc' },
    });

    return draws.map((d) => ({
      id: d.id,
      drawNumber: d.drawNumber,
      gameCode: d.game.code,
      gameName: d.game.name,
      scheduledAt: d.scheduledAt,
      publishedAt: d.publishedAt,
      winningResults: d.winningResults,
      validationHash: d.validationHash,
    }));
  }
}
