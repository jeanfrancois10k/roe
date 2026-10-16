import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
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

export interface LotteryDefinition {
  code: string;
  name: string;
  description: string;
  drawFrequency: string;
  schedules: Array<{
    name: string;
    closeHour: number;
    closeMinute: number;
    drawHour: number;
    drawMinute: number;
  }>;
}

export const OFFICIAL_LOTTERIES: LotteryDefinition[] = [
  {
    code: 'BOLET_NY',
    name: 'Bolet New York (NY)',
    description: 'Loterie traditionnelle New York - Midi (12:30 PM) et Soir (07:30 PM)',
    drawFrequency: '12:30 PM & 07:30 PM',
    schedules: [
      { name: 'Midi', closeHour: 12, closeMinute: 20, drawHour: 12, drawMinute: 30 },
      { name: 'Soir', closeHour: 19, closeMinute: 20, drawHour: 19, drawMinute: 30 },
    ],
  },
  {
    code: 'BOLET_FL',
    name: 'Bolet Florida (FL)',
    description: 'Loterie traditionnelle Florida - Midi (01:30 PM) et Soir (09:30 PM)',
    drawFrequency: '01:30 PM & 09:30 PM',
    schedules: [
      { name: 'Midi', closeHour: 13, closeMinute: 20, drawHour: 13, drawMinute: 30 },
      { name: 'Soir', closeHour: 21, closeMinute: 20, drawHour: 21, drawMinute: 30 },
    ],
  },
  {
    code: 'BOLET_GA',
    name: 'Bolet Géorgie (GA)',
    description: 'Loterie traditionnelle Géorgie - Midi (12:29 PM) et Soir (07:00 PM)',
    drawFrequency: '12:29 PM & 07:00 PM',
    schedules: [
      { name: 'Midi', closeHour: 12, closeMinute: 20, drawHour: 12, drawMinute: 29 },
      { name: 'Soir', closeHour: 18, closeMinute: 50, drawHour: 19, drawMinute: 0 },
    ],
  },
  {
    code: 'BOLET_TX',
    name: 'Bolet Texas (TX)',
    description: 'Loterie traditionnelle Texas - Midi (12:27 PM) et Soir (10:12 PM)',
    drawFrequency: '12:27 PM & 10:12 PM',
    schedules: [
      { name: 'Midi', closeHour: 12, closeMinute: 15, drawHour: 12, drawMinute: 27 },
      { name: 'Soir', closeHour: 22, closeMinute: 0, drawHour: 22, drawMinute: 12 },
    ],
  },
  {
    code: 'BOLET_TN',
    name: 'Bolet Tennessee (TN)',
    description: 'Loterie traditionnelle Tennessee - Midi (12:28 PM) et Soir (06:28 PM)',
    drawFrequency: '12:28 PM & 06:28 PM',
    schedules: [
      { name: 'Midi', closeHour: 12, closeMinute: 15, drawHour: 12, drawMinute: 28 },
      { name: 'Soir', closeHour: 18, closeMinute: 15, drawHour: 18, drawMinute: 28 },
    ],
  },
];

@Injectable()
export class DrawsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrawsService.name);
  private readonly validationSecret: string;
  private timer: NodeJS.Timeout | null = null;

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

  async onModuleInit() {
    try {
      await this.ensureDefaultLotteries();
      await this.autoProcessDraws();
    } catch (err: any) {
      this.logger.error(`Erreur initialisation loteries et tirages : ${err.message}`);
    }

    // Cycle automatique toutes les 30 secondes
    this.timer = setInterval(async () => {
      try {
        await this.autoProcessDraws();
      } catch (err: any) {
        this.logger.error(`Erreur cycle autoProcessDraws : ${err.message}`);
      }
    }, 30000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isMidiDraw(salesClosingAt: Date | string): boolean {
    const d = new Date(salesClosingAt);
    const hourStr = d.toLocaleTimeString('en-US', {
      timeZone: 'America/Port-au-Prince',
      hour12: false,
      hour: '2-digit',
    });
    const hour = parseInt(hourStr, 10);
    return hour >= 10 && hour <= 15;
  }

  isSoirDraw(salesClosingAt: Date | string): boolean {
    const d = new Date(salesClosingAt);
    const hourStr = d.toLocaleTimeString('en-US', {
      timeZone: 'America/Port-au-Prince',
      hour12: false,
      hour: '2-digit',
    });
    const hour = parseInt(hourStr, 10);
    return hour >= 16 || hour < 4;
  }

  getHaitiHour(date: Date = new Date()): number {
    const str = date.toLocaleTimeString('en-US', {
      timeZone: 'America/Port-au-Prince',
      hour12: false,
      hour: '2-digit',
    });
    const h = parseInt(str, 10);
    return isNaN(h) ? date.getHours() : h;
  }

  /**
   * Assure que les 5 loteries officielles (NY, FL, GA, TX, TN) existent en base
   */
  async ensureDefaultLotteries() {
    const defaultRules = {
      borlette: {
        firstPrizeMultiplier: 50,
        secondPrizeMultiplier: 20,
        thirdPrizeMultiplier: 10,
      },
      mariage: {
        multiplier: 1000,
        mariageGratis: 1000,
      },
      lot3: {
        multiplier: 500,
      },
      lot4: {
        multiplier: 5000,
      },
      lot5: {
        multiplier: 25000,
      },
    };

    for (const lotto of OFFICIAL_LOTTERIES) {
      await this.prisma.game.upsert({
        where: { code: lotto.code },
        update: {
          name: lotto.name,
          description: lotto.description,
          drawFrequency: lotto.drawFrequency,
          status: 'ACTIVE',
        },
        create: {
          code: lotto.code,
          name: lotto.name,
          description: lotto.description,
          drawFrequency: lotto.drawFrequency,
          status: 'ACTIVE',
          minBetAmount: 5.0,
          maxBetAmount: 2500.0,
          currency: 'HTG' as any,
          defaultCommission: 5.0,
          gameRules: defaultRules,
        },
      });
    }
    this.logger.log('✅ 5 Loteries officielles synchronisées : NY, FL, GA, TX, TN');
  }

  /**
   * Moteur Automatique : Clôture à l'heure exacte et ouverture des sessions
   */
  async autoProcessDraws() {
    const now = new Date();

    // 1. Clôture automatique de tous les tirages arrivés à échéance (salesClosingAt <= now)
    const expiredDraws = await this.prisma.draw.findMany({
      where: {
        status: DrawStatus.OPEN,
        salesClosingAt: { lte: now },
      },
      include: { game: { select: { code: true, name: true } } },
    });

    for (const draw of expiredDraws) {
      await this.prisma.draw.update({
        where: { id: draw.id },
        data: { status: DrawStatus.CLOSED },
      });

      if (this.realtimeGateway?.server) {
        this.realtimeGateway.server.emit('draw:closed', {
          drawId: draw.id,
          drawNumber: draw.drawNumber,
          gameCode: draw.game.code,
          timestamp: new Date().toISOString(),
          autoClosed: true,
        });
      }

      await this.auditService.log({
        action: 'DRAW_AUTO_CLOSED',
        resource: `Draw:${draw.id}`,
        newPayload: {
          drawNumber: draw.drawNumber,
          gameCode: draw.game.code,
          closedAt: now.toISOString(),
        },
      });

      this.logger.log(`⏰ Clôture automatique des ventes : Tirage N°${draw.drawNumber} (${draw.game.name})`);
    }

    const haitiHour = this.getHaitiHour(now);

    // 2. Vérification et création / ouverture automatique pour les jeux actifs
    for (const lotto of OFFICIAL_LOTTERIES) {
      const game = await this.prisma.game.findUnique({ where: { code: lotto.code } });
      if (!game || game.status !== 'ACTIVE') continue;

      const activeDraws = await this.prisma.draw.findMany({
        where: {
          gameId: game.id,
          status: { in: [DrawStatus.OPEN, DrawStatus.SCHEDULED] },
          salesClosingAt: { gt: now },
        },
      });

      // Règle stricte des sessions :
      // - Entre 07h00 et 13h00 : tirage Midi actif (OPEN), tirage Soir verrouillé (SCHEDULED)
      // - À partir de 13h00 : tirage Soir actif (OPEN)
      for (const d of activeDraws) {
        const isEvening = this.isSoirDraw(d.salesClosingAt);
        if (d.status === DrawStatus.SCHEDULED) {
          if (!isEvening && haitiHour >= 7 && haitiHour < 13) {
            await this.prisma.draw.update({
              where: { id: d.id },
              data: { status: DrawStatus.OPEN },
            });
            this.logger.log(`🌅 07h00 : Activation session Midi N°${d.drawNumber} (${game.name})`);
          } else if (isEvening && haitiHour >= 13) {
            await this.prisma.draw.update({
              where: { id: d.id },
              data: { status: DrawStatus.OPEN },
            });
            this.logger.log(`🌆 13h00 : Activation session Soir N°${d.drawNumber} (${game.name})`);
          }
        }
      }

      // Si aucun tirage n'est actuellement ouvert pour ce jeu, planifier la prochaine session
      if (activeDraws.length === 0) {
        let targetClose: Date | null = null;
        let targetDraw: Date | null = null;

        const effectiveSchedules =
          Array.isArray((game.gameRules as any)?.schedules) && (game.gameRules as any).schedules.length > 0
            ? (game.gameRules as any).schedules
            : lotto.schedules;

        for (const s of effectiveSchedules) {
          const cClose = new Date(now.getFullYear(), now.getMonth(), now.getDate(), s.closeHour, s.closeMinute, 0);
          const cDraw = new Date(now.getFullYear(), now.getMonth(), now.getDate(), s.drawHour, s.drawMinute, 0);

          if (cClose > now) {
            targetClose = cClose;
            targetDraw = cDraw;
            break;
          }
        }

        // Si toutes les sessions du jour sont terminées, planifier la 1ère session de demain (Midi)
        if (!targetClose) {
          const firstSched = effectiveSchedules[0];
          targetClose = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, firstSched.closeHour, firstSched.closeMinute, 0);
          targetDraw = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, firstSched.drawHour, firstSched.drawMinute, 0);
        }

        const maxDraw = await this.prisma.draw.aggregate({
          where: { gameId: game.id },
          _max: { drawNumber: true },
        });
        const nextDrawNum = (maxDraw._max.drawNumber || 100) + 1;

        const isEvening = this.isSoirDraw(targetClose);
        // Si c'est avant 7h00 du matin, ou si c'est un tirage du Soir alors qu'il est moins de 13h00 :
        // Le tirage reste en SCHEDULED (en attente), jamais OPEN pour le Soir le matin !
        let initialStatus: DrawStatus = DrawStatus.OPEN;
        if (haitiHour < 7 || (haitiHour < 13 && isEvening)) {
          initialStatus = DrawStatus.SCHEDULED;
        }

        const newDraw = await this.prisma.draw.create({
          data: {
            gameId: game.id,
            drawNumber: nextDrawNum,
            scheduledAt: targetDraw,
            salesClosingAt: targetClose,
            status: initialStatus,
          },
          include: { game: { select: { code: true, name: true } } },
        });

        if (initialStatus === DrawStatus.OPEN && this.realtimeGateway?.server) {
          this.realtimeGateway.server.emit('draw:opened', {
            drawId: newDraw.id,
            drawNumber: newDraw.drawNumber,
            gameCode: newDraw.game.code,
            timestamp: new Date().toISOString(),
            salesClosingAt: targetClose.toISOString(),
            autoScheduled: true,
          });
        }

        this.logger.log(`✨ Tirage N°${newDraw.drawNumber} pour ${game.name} planifié (${initialStatus}) jusqu'à ${targetClose.toLocaleTimeString()}`);
      }
    }
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
    // Vérification rapide pour s'assurer que l'état est synchronisé
    await this.autoProcessDraws().catch(() => {});

    const now = new Date();
    const haitiHour = this.getHaitiHour(now);

    const where: any = {
      status: DrawStatus.OPEN,
      salesClosingAt: { gt: now },
    };
    if (gameId) where.gameId = gameId;

    const openDraws = await this.prisma.draw.findMany({
      where,
      include: {
        game: { select: { id: true, code: true, name: true, minBetAmount: true, maxBetAmount: true } },
      },
      orderBy: { salesClosingAt: 'asc' },
    });

    // RÈGLE MÉTIER STRICTE :
    // Entre 07h00 et 13h00, c'est la session du tirage Midi :
    // Les vendeurs ne voient et ne peuvent vendre QUE pour les tirages Midi !
    if (haitiHour >= 7 && haitiHour < 13) {
      return openDraws.filter((d) => this.isMidiDraw(d.salesClosingAt));
    }

    // Après 13h00 : seuls les tirages du Soir sont proposés aux vendeurs
    if (haitiHour >= 13) {
      return openDraws.filter((d) => this.isSoirDraw(d.salesClosingAt));
    }

    // Avant 07h00 du matin : les ventes sont fermées pour la nuit
    return [];
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

  /**
   * Ouverture manuelle / Activation par l'Administrateur
   */
  async openDraw(id: string, adminId?: string, minutesToExtend?: number) {
    const draw = await this.prisma.draw.findUnique({
      where: { id },
      include: { game: { select: { code: true, name: true } } },
    });
    if (!draw) {
      throw new NotFoundException('Tirage introuvable');
    }

    if (draw.status === DrawStatus.PUBLISHED) {
      throw new BadRequestException('Impossible de rouvrir un tirage déjà publié.');
    }

    const now = new Date();
    let newClosingAt = draw.salesClosingAt;
    let newScheduledAt = draw.scheduledAt;

    // Si l'heure de clôture est dépassée ou expirée, on prolonge automatiquement
    if (new Date(draw.salesClosingAt) <= now) {
      const extMinutes = minutesToExtend && minutesToExtend > 0 ? minutesToExtend : 120;
      newClosingAt = new Date(now.getTime() + extMinutes * 60 * 1000);
      newScheduledAt = new Date(newClosingAt.getTime() + 15 * 60 * 1000);
    }

    const updated = await this.prisma.draw.update({
      where: { id },
      data: {
        status: DrawStatus.OPEN,
        salesClosingAt: newClosingAt,
        scheduledAt: newScheduledAt,
      },
      include: { game: { select: { code: true, name: true } } },
    });

    if (this.realtimeGateway?.server) {
      this.realtimeGateway.server.emit('draw:opened', {
        drawId: draw.id,
        drawNumber: draw.drawNumber,
        gameCode: updated.game.code,
        timestamp: new Date().toISOString(),
        salesClosingAt: newClosingAt.toISOString(),
      });
    }

    await this.auditService.log({
      userId: adminId,
      action: 'DRAW_MANUALLY_OPENED',
      resource: `Draw:${id}`,
      newPayload: {
        drawNumber: draw.drawNumber,
        status: DrawStatus.OPEN,
        salesClosingAt: newClosingAt.toISOString(),
      },
    });

    this.logger.log(`🟢 Tirage N°${draw.drawNumber} (${updated.game.name}) activé manuellement par l'admin`);
    return updated;
  }

  /**
   * Clôture manuelle / Fermeture par l'Administrateur
   */
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

    this.logger.log(`🔴 Tirage N°${draw.drawNumber} (${updated.game.name}) fermé manuellement par l'admin`);
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
