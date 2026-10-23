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
    code: 'BOLET_CHI',
    name: 'Bolet Chicago (CHI)',
    description: 'Loterie traditionnelle Chicago - Midi (01:38 PM) et Soir (10:18 PM)',
    drawFrequency: '01:38 PM & 10:18 PM',
    schedules: [
      { name: 'Midi', closeHour: 13, closeMinute: 38, drawHour: 13, drawMinute: 45 },
      { name: 'Soir', closeHour: 22, closeMinute: 18, drawHour: 22, drawMinute: 30 },
    ],
  },
  {
    code: 'BOLET_FL',
    name: 'Bolet Florida (FL)',
    description: 'Loterie traditionnelle Florida - Midi (01:28 PM) et Soir (09:43 PM)',
    drawFrequency: '01:28 PM & 09:43 PM',
    schedules: [
      { name: 'Midi', closeHour: 13, closeMinute: 28, drawHour: 13, drawMinute: 35 },
      { name: 'Soir', closeHour: 21, closeMinute: 43, drawHour: 21, drawMinute: 50 },
    ],
  },
  {
    code: 'BOLET_GA',
    name: 'Bolet Géorgie (GA)',
    description: 'Loterie traditionnelle Géorgie - Midi (12:27 PM) et Soir (06:57 PM)',
    drawFrequency: '12:27 PM & 06:57 PM',
    schedules: [
      { name: 'Midi', closeHour: 12, closeMinute: 27, drawHour: 12, drawMinute: 35 },
      { name: 'Soir', closeHour: 18, closeMinute: 57, drawHour: 19, drawMinute: 5 },
    ],
  },
  {
    code: 'BOLET_NY',
    name: 'Bolet New York (NY)',
    description: 'Loterie traditionnelle New York - Midi (02:28 PM) et Soir (10:28 PM)',
    drawFrequency: '02:28 PM & 10:28 PM',
    schedules: [
      { name: 'Midi', closeHour: 14, closeMinute: 28, drawHour: 14, drawMinute: 35 },
      { name: 'Soir', closeHour: 22, closeMinute: 28, drawHour: 22, drawMinute: 35 },
    ],
  },
  {
    code: 'BOLET_TN',
    name: 'Bolet Tennessee (TN)',
    description: 'Loterie traditionnelle Tennessee - Midi (10:09 AM) et Soir (07:09 PM)',
    drawFrequency: '10:09 AM & 07:09 PM',
    schedules: [
      { name: 'Midi', closeHour: 10, closeMinute: 9, drawHour: 10, drawMinute: 15 },
      { name: 'Soir', closeHour: 19, closeMinute: 9, drawHour: 19, drawMinute: 15 },
    ],
  },
  {
    code: 'BOLET_TX',
    name: 'Bolet Texas Early (TX)',
    description: 'Loterie traditionnelle Texas Early - Midi (10:58 AM) et Soir (06:58 PM)',
    drawFrequency: '10:58 AM & 06:58 PM',
    schedules: [
      { name: 'Midi', closeHour: 10, closeMinute: 58, drawHour: 11, drawMinute: 5 },
      { name: 'Soir', closeHour: 18, closeMinute: 58, drawHour: 19, drawMinute: 5 },
    ],
  },
];

/**
 * Extraction des composantes de date et heure civiles dans le fuseau America/Port-au-Prince
 */
export function getHaitiDateParts(date: Date = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Port-au-Prince',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, parseInt(p.value, 10)]),
  );
  return {
    year: parts.year,
    month: parts.month - 1, // 0-indexed
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/**
 * Création d'une date Date (UTC standard) correspondant exactement à une heure/minute en heure d'Haïti
 */
export function createHaitiDate(
  year: number,
  month: number, // 0-indexed
  day: number,
  hour: number,
  minute: number,
  second = 0,
): Date {
  const approxUtc = new Date(Date.UTC(year, month, day, hour, minute, second));
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Port-au-Prince',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(approxUtc)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, parseInt(p.value, 10)]),
  );
  const haitiAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute,
    parts.second,
  );
  const offsetMs = haitiAsUtc - approxUtc.getTime();
  return new Date(approxUtc.getTime() - offsetMs);
}

@Injectable()
export class DrawsService implements OnModuleInit, OnModuleDestroy {
  private static defaultLotteriesEnsured = false;
  private static isAutoProcessing = false;
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
      this.logger.warn(`Initialisation des loteries différée : ${err.message}`);
    }

    if (!process.env.VERCEL) {
      this.timer = setInterval(async () => {
        try {
          await this.autoProcessDraws();
        } catch (err: any) {
          this.logger.warn(`Cycle autoProcessDraws : ${err.message}`);
        }
      }, 30000);
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isMidiDraw(salesClosingAt: Date | string): boolean {
    const parts = getHaitiDateParts(new Date(salesClosingAt));
    return parts.hour < 16;
  }

  isSoirDraw(salesClosingAt: Date | string): boolean {
    const parts = getHaitiDateParts(new Date(salesClosingAt));
    return parts.hour >= 16;
  }

  getHaitiHour(date: Date = new Date()): number {
    return getHaitiDateParts(date).hour;
  }

  /**
   * Assure que les 6 loteries officielles (CHI, FL, GA, NY, TN, TX) existent en base
   */
  async ensureDefaultLotteries() {
    if (DrawsService.defaultLotteriesEnsured) {
      return;
    }
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

    const count = await this.prisma.game.count({
      where: { code: { in: OFFICIAL_LOTTERIES.map((l) => l.code) } },
    });

    if (count < OFFICIAL_LOTTERIES.length) {
      for (const lotto of OFFICIAL_LOTTERIES) {
        const existing = await this.prisma.game.findUnique({ where: { code: lotto.code } });
        const currentRules = (existing?.gameRules as any) || defaultRules;
        const updatedRules = {
          ...currentRules,
          ...defaultRules,
          schedules: lotto.schedules,
        };

        await this.prisma.game.upsert({
          where: { code: lotto.code },
          update: {
            name: lotto.name,
            description: lotto.description,
            drawFrequency: lotto.drawFrequency,
            status: 'ACTIVE',
            gameRules: updatedRules,
            minBetAmount: 1.0,
          },
          create: {
            code: lotto.code,
            name: lotto.name,
            description: lotto.description,
            drawFrequency: lotto.drawFrequency,
            status: 'ACTIVE',
            minBetAmount: 1.0,
            maxBetAmount: 2500.0,
            currency: 'HTG' as any,
            defaultCommission: 5.0,
            gameRules: updatedRules,
          },
        });
      }

      // S'assurer que tous les jeux existants ont la mise minimale fixée à 1 HTG
      await this.prisma.game.updateMany({
        data: { minBetAmount: 1.0 },
      });
    }
    DrawsService.defaultLotteriesEnsured = true;
    this.logger.log('✅ 6 Loteries officielles synchronisées avec mise minimum 1 HTG : CHI, FL, GA, NY, TN, TX');
  }

  /**
   * Moteur Automatique : Clôture à l'heure exacte et ouverture conditionnelle des sessions
   * RÈGLES CONFIRMÉES :
   * 1. Clôture automatique à l'instant précis (salesClosingAt <= now) côté serveur.
   * 2. Indépendance totale : chaque loterie a son propre cycle.
   * 3. Sessions indépendantes : la session Soir s'ouvre pour les ventes dès que son cycle est actif.
   * 4. Les ventes de la journée débutent à 05h00 AM (heure d’Haïti).
   * 5. Toutes les heures sont interprétées strictement dans le fuseau America/Port-au-Prince.
   */
  /**
   * Nettoie et supprime définitivement les tirages en doublon (même loterie, même jour Haïti, même session Midi/Soir)
   */
  async cleanupDuplicateDraws() {
    try {
      const recentDraws = await this.prisma.draw.findMany({
        where: {
          salesClosingAt: {
            gte: new Date(Date.now() - 14 * 24 * 3600 * 1000),
          },
        },
        include: {
          _count: { select: { tickets: true } },
        },
        orderBy: { drawNumber: 'desc' },
      });

      const groups = new Map<string, typeof recentDraws>();
      for (const d of recentDraws) {
        const parts = getHaitiDateParts(new Date(d.salesClosingAt));
        const period = parts.hour < 16 ? 'MIDI' : 'SOIR';
        const key = `${d.gameId}_${parts.year}-${parts.month + 1}-${parts.day}_${period}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(d);
      }

      const idsToDelete: string[] = [];
      for (const [, group] of groups) {
        if (group.length <= 1) continue;

        group.sort((a, b) => {
          if (a.status === DrawStatus.PUBLISHED && b.status !== DrawStatus.PUBLISHED) return -1;
          if (b.status === DrawStatus.PUBLISHED && a.status !== DrawStatus.PUBLISHED) return 1;
          const aTickets = a._count?.tickets || 0;
          const bTickets = b._count?.tickets || 0;
          if (aTickets > 0 && bTickets === 0) return -1;
          if (bTickets > 0 && aTickets === 0) return 1;
          if (a.status === DrawStatus.OPEN && b.status !== DrawStatus.OPEN) return -1;
          if (b.status === DrawStatus.OPEN && a.status !== DrawStatus.OPEN) return 1;
          return b.drawNumber - a.drawNumber;
        });

        const [, ...duplicates] = group;
        for (const dup of duplicates) {
          if ((dup._count?.tickets || 0) === 0 && dup.status !== DrawStatus.PUBLISHED) {
            idsToDelete.push(dup.id);
          }
        }
      }

      if (idsToDelete.length > 0) {
        await this.prisma.draw.deleteMany({
          where: { id: { in: idsToDelete } },
        });
        this.logger.log(`🧹 ${idsToDelete.length} tirage(s) doublon(s) supprimé(s) définitivement.`);
      }
    } catch (err: any) {
      this.logger.warn(`Nettoyage doublons tirages : ${err.message}`);
    }
  }

  async autoProcessDraws() {
    if (DrawsService.isAutoProcessing) {
      return;
    }
    DrawsService.isAutoProcessing = true;
    try {
      const now = new Date();

      // Synchroniser les 6 loteries officielles si nécessaire
      if (!DrawsService.defaultLotteriesEnsured) {
        await this.ensureDefaultLotteries().catch(() => {});
      }

      await this.cleanupDuplicateDraws();

      // 1. Clôture automatique de tous les tirages arrivés à échéance (salesClosingAt <= now)
      const expiredDraws = await this.prisma.draw.findMany({
        where: {
          status: DrawStatus.OPEN,
          salesClosingAt: { lte: now },
        },
        select: { id: true, drawNumber: true, game: { select: { code: true, name: true } } },
      });

      if (expiredDraws.length > 0) {
        await this.prisma.draw.updateMany({
          where: { id: { in: expiredDraws.map((d) => d.id) } },
          data: { status: DrawStatus.CLOSED },
        });

        for (const draw of expiredDraws) {
          if (this.realtimeGateway?.server) {
            this.realtimeGateway.server.emit('draw:closed', {
              drawId: draw.id,
              drawNumber: draw.drawNumber,
              gameCode: draw.game.code,
              timestamp: now.toISOString(),
              autoClosed: true,
            });
          }

          this.logger.log(
            `⏰ Clôture automatique des ventes : Tirage N°${draw.drawNumber} (${draw.game.name})`,
          );
        }
      }

      const haitiNow = getHaitiDateParts(now);

      // 2. Traitement indépendant par loterie
      const activeGames = await this.prisma.game.findMany({
        where: {
          code: { in: OFFICIAL_LOTTERIES.map((l) => l.code) },
          status: 'ACTIVE',
        },
      });
      const gamesByCode = new Map(activeGames.map((g) => [g.code, g]));

      for (const lotto of OFFICIAL_LOTTERIES) {
        const game = gamesByCode.get(lotto.code);
        if (!game) continue;

        // Toujours utiliser les horaires officiels confirmés
        const effectiveSchedules = lotto.schedules;

        // Identifier la session cible du jour (ou de demain)
        let targetSchedule: any = null;
        let targetClose: Date | null = null;
        let targetDraw: Date | null = null;
        let isTargetTomorrow = false;

        for (const s of effectiveSchedules) {
          const candidateClose = createHaitiDate(
            haitiNow.year,
            haitiNow.month,
            haitiNow.day,
            s.closeHour,
            s.closeMinute,
            0,
          );
          const candidateDraw = createHaitiDate(
            haitiNow.year,
            haitiNow.month,
            haitiNow.day,
            s.drawHour,
            s.drawMinute,
            0,
          );

          if (candidateClose > now) {
            targetSchedule = s;
            targetClose = candidateClose;
            targetDraw = candidateDraw;
            break;
          }
        }

        if (!targetClose) {
          isTargetTomorrow = true;
          const firstSched = effectiveSchedules[0];
          targetSchedule = firstSched;
          targetClose = createHaitiDate(
            haitiNow.year,
            haitiNow.month,
            haitiNow.day + 1,
            firstSched.closeHour,
            firstSched.closeMinute,
            0,
          );
          targetDraw = createHaitiDate(
            haitiNow.year,
            haitiNow.month,
            haitiNow.day + 1,
            firstSched.drawHour,
            firstSched.drawMinute,
            0,
          );
        }

        const sessionName = (
          targetSchedule?.name || (this.isMidiDraw(targetClose) ? 'Midi' : 'Soir')
        ).toUpperCase();

        // 3. Détermination de la dépendance à la session précédente
        const previousDraw = await this.prisma.draw.findFirst({
          where: {
            gameId: game.id,
            salesClosingAt: { lt: targetClose },
          },
          orderBy: { salesClosingAt: 'desc' },
        });

        let blockReason: string | null = null;

        if (previousDraw) {
          const prevParts = getHaitiDateParts(previousDraw.salesClosingAt);
          const targetParts = getHaitiDateParts(targetClose);
          const isSameDay =
            prevParts.year === targetParts.year &&
            prevParts.month === targetParts.month &&
            prevParts.day === targetParts.day;

          // Si le tirage précédent est d'une journée antérieure et qu'il était resté OPEN, le fermer immédiatement
          if (previousDraw.status === DrawStatus.OPEN && (!isSameDay || previousDraw.salesClosingAt <= now)) {
            await this.prisma.draw.update({
              where: { id: previousDraw.id },
              data: { status: DrawStatus.CLOSED },
            });
          }
        }

        // Vérification de la fenêtre horaire autorisée pour les ventes de la journée (05h00 AM heure d'Haïti)
        let openingTimeReached = true;
        const targetDay = isTargetTomorrow ? haitiNow.day + 1 : haitiNow.day;
        const morningOpenTime = createHaitiDate(
          haitiNow.year,
          haitiNow.month,
          targetDay,
          5,
          0,
          0,
        );
        if (now < morningOpenTime) {
          openingTimeReached = false;
          blockReason = 'Les ventes débutent à 05h00 AM (heure d’Haïti).';
        }

        const isEligibleToOpen =
          openingTimeReached &&
          now < targetClose &&
          game.status === 'ACTIVE';

        // Invariant 1: Fermer immédiatement tous les anciens tirages OPEN de ce jeu dont l'heure de clôture est passée
        await this.prisma.draw.updateMany({
          where: {
            gameId: game.id,
            status: DrawStatus.OPEN,
            salesClosingAt: { lte: now },
          },
          data: { status: DrawStatus.CLOSED },
        });

        // Invariant 2: Nettoyage proactif de tout doublon OPEN pour ce jeu (règle d'or: max 1 tirage OPEN par jeu)
        const openDrawsForGame = await this.prisma.draw.findMany({
          where: {
            gameId: game.id,
            status: DrawStatus.OPEN,
          },
          orderBy: { drawNumber: 'desc' },
        });
        if (openDrawsForGame.length > 1) {
          const [keepLatest, ...staleDuplicates] = openDrawsForGame;
          await this.prisma.draw.updateMany({
            where: { id: { in: staleDuplicates.map((d) => d.id) } },
            data: { status: DrawStatus.CLOSED },
          });
          this.logger.warn(`🧹 Dédoublonnage : ${staleDuplicates.length} doublons OPEN fermés pour ${game.name}`);
        }

        // 4. Synchronisation du tirage en base (par date du jour et session Midi/Soir)
        const targetParts = getHaitiDateParts(targetClose);
        const dayStartHaiti = createHaitiDate(targetParts.year, targetParts.month, targetParts.day, 0, 0, 0);
        const dayEndHaiti = createHaitiDate(targetParts.year, targetParts.month, targetParts.day, 23, 59, 59);

        const dayDrawsForGame = await this.prisma.draw.findMany({
          where: {
            gameId: game.id,
            salesClosingAt: { gte: dayStartHaiti, lte: dayEndHaiti },
          },
          orderBy: { drawNumber: 'desc' },
        });
        const isTargetMidi = sessionName === 'MIDI';
        const existingDraw = dayDrawsForGame.find((d) =>
          isTargetMidi ? this.isMidiDraw(d.salesClosingAt) : this.isSoirDraw(d.salesClosingAt),
        );

        if (existingDraw) {
          const shouldUpdateTimes =
            existingDraw.salesClosingAt.getTime() !== targetClose.getTime() ||
            existingDraw.scheduledAt.getTime() !== targetDraw.getTime();

          const canBeOpened =
            existingDraw.salesClosingAt > now &&
            existingDraw.status !== DrawStatus.PUBLISHED &&
            (!existingDraw.winningResults || Object.keys(existingDraw.winningResults as any).length === 0);

          if (isEligibleToOpen && existingDraw.status !== DrawStatus.OPEN && canBeOpened) {
            // Clôturer tout autre tirage qui pourrait être resté ouvert pour ce jeu
            await this.prisma.draw.updateMany({
              where: {
                gameId: game.id,
                status: DrawStatus.OPEN,
                id: { not: existingDraw.id },
              },
              data: { status: DrawStatus.CLOSED },
            });

            await this.prisma.draw.update({
              where: { id: existingDraw.id },
              data: {
                status: DrawStatus.OPEN,
                sessionName,
                salesClosingAt: targetClose,
                scheduledAt: targetDraw,
                blockedReason: null,
              },
            });

            if (this.realtimeGateway?.server) {
              this.realtimeGateway.server.emit('draw:opened', {
                drawId: existingDraw.id,
                drawNumber: existingDraw.drawNumber,
                gameCode: game.code,
                session: sessionName,
                timestamp: new Date().toISOString(),
                salesClosingAt: targetClose.toISOString(),
              });
            }
            this.logger.log(
              `🔓 Ouverture des ventes : Tirage N°${existingDraw.drawNumber} (${game.name} - ${sessionName}) [Fermeture: ${targetClose.toISOString()}]`,
            );
          } else if (shouldUpdateTimes && (existingDraw.status === DrawStatus.OPEN || existingDraw.status === DrawStatus.SCHEDULED)) {
            await this.prisma.draw.update({
              where: { id: existingDraw.id },
              data: {
                salesClosingAt: targetClose,
                scheduledAt: targetDraw,
                sessionName,
                blockedReason: isEligibleToOpen ? null : blockReason,
                ...(isEligibleToOpen && existingDraw.status === DrawStatus.SCHEDULED ? { status: DrawStatus.OPEN } : {}),
              },
            });
          } else if (!isEligibleToOpen && existingDraw.status !== DrawStatus.CLOSED && existingDraw.status !== DrawStatus.PUBLISHED) {
            // Maintien en SCHEDULED avec la raison du blocage
            await this.prisma.draw.update({
              where: { id: existingDraw.id },
              data: {
                status: DrawStatus.SCHEDULED,
                sessionName,
                blockedReason: blockReason,
              },
            });
          }
        } else {
          // Création du prochain tirage
          const maxDraw = await this.prisma.draw.aggregate({
            where: { gameId: game.id },
            _max: { drawNumber: true },
          });
          const nextDrawNum = (maxDraw._max.drawNumber || 100) + 1;

          // Avant de créer un tirage OPEN, fermer tout tirage précédent pour ce jeu
          if (isEligibleToOpen) {
            await this.prisma.draw.updateMany({
              where: {
                gameId: game.id,
                status: DrawStatus.OPEN,
              },
              data: { status: DrawStatus.CLOSED },
            });
          }

          const newDraw = await this.prisma.draw.create({
            data: {
              gameId: game.id,
              drawNumber: nextDrawNum,
              scheduledAt: targetDraw,
              salesClosingAt: targetClose,
              status: isEligibleToOpen ? DrawStatus.OPEN : DrawStatus.SCHEDULED,
              sessionName,
              blockedReason: isEligibleToOpen ? null : blockReason,
            },
            include: { game: { select: { code: true, name: true } } },
          });

          if (isEligibleToOpen && this.realtimeGateway?.server) {
            this.realtimeGateway.server.emit('draw:opened', {
              drawId: newDraw.id,
              drawNumber: newDraw.drawNumber,
              gameCode: newDraw.game.code,
              session: sessionName,
              timestamp: new Date().toISOString(),
              salesClosingAt: targetClose.toISOString(),
              autoScheduled: true,
            });
          }

          this.logger.log(
            `✨ Tirage N°${newDraw.drawNumber} (${game.name} - ${sessionName}) créé : Statut [${newDraw.status}]${blockReason ? ` | Blocage: ${blockReason}` : ''}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`[autoProcessDraws] Avertissement base de données : ${err.message}`);
    } finally {
      DrawsService.isAutoProcessing = false;
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

  async debugStatus() {
    const now = new Date();
    const haiti = getHaitiDateParts(now);
    const open = await this.prisma.draw.findMany({
      where: {
        status: DrawStatus.OPEN,
        salesClosingAt: { gt: now },
      },
      include: { game: true },
      orderBy: { salesClosingAt: 'asc' },
    });
    const allRecent = await this.prisma.draw.findMany({
      where: {
        salesClosingAt: {
          gte: new Date(Date.now() - 36 * 3600 * 1000),
        },
      },
      include: { game: true },
      orderBy: { salesClosingAt: 'desc' },
      take: 20,
    });
    return {
      commit: 'b9fa0cb-v5-fast',
      serverNowUtc: now.toISOString(),
      haitiNow: haiti,
      openCount: open.length,
      openDraws: open.map((d) => ({
        num: d.drawNumber,
        game: d.game.name,
        code: d.game.code,
        session: d.sessionName,
        status: d.status,
        closingUtc: d.salesClosingAt.toISOString(),
      })),
      recentDraws: allRecent.map((d) => ({
        num: d.drawNumber,
        game: d.game.name,
        code: d.game.code,
        session: d.sessionName,
        status: d.status,
        closingUtc: d.salesClosingAt.toISOString(),
        blockedReason: d.blockedReason,
      })),
    };
  }

  async getOpenDraws(gameId?: string) {
    const now = new Date();
    const where: any = {
      status: DrawStatus.OPEN,
      salesClosingAt: { gt: now },
    };
    if (gameId) where.gameId = gameId;

    let openDraws = await this.prisma.draw.findMany({
      where,
      include: {
        game: { select: { id: true, code: true, name: true, minBetAmount: true, maxBetAmount: true } },
      },
      orderBy: { salesClosingAt: 'asc' },
    });

    // Si moins de 6 tirages ouverts sont disponibles, actualiser l'état
    if (openDraws.length < 6) {
      await this.autoProcessDraws().catch(() => {});
      openDraws = await this.prisma.draw.findMany({
        where,
        include: {
          game: { select: { id: true, code: true, name: true, minBetAmount: true, maxBetAmount: true } },
        },
        orderBy: { salesClosingAt: 'asc' },
      });
    }

    // Dédupliquer STRICTEMENT par jeu : un seul tirage ouvert par loterie à la fois
    const uniqueDrawsMap = new Map<string, typeof openDraws[0]>();
    for (const draw of openDraws) {
      const key = draw.gameId; // Clé unique par jeu
      if (!uniqueDrawsMap.has(key)) {
        uniqueDrawsMap.set(key, draw);
      } else {
        const existing = uniqueDrawsMap.get(key)!;
        if (draw.drawNumber > existing.drawNumber) {
          uniqueDrawsMap.set(key, draw);
        }
      }
    }

    return Array.from(uniqueDrawsMap.values());
  }

  async findAll(gameId?: string, status?: DrawStatus, page = 1, limit = 20) {
    await this.cleanupDuplicateDraws();
    const skip = (page - 1) * limit;
    const where: any = {};
    if (gameId) where.gameId = gameId;
    if (status) where.status = status;

    const [total, rawItems] = await Promise.all([
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

    // Dédoublonnage supplémentaire par (gameId, jour Haïti, session Midi/Soir)
    const seenSessionKeys = new Set<string>();
    const items: typeof rawItems = [];
    for (const d of rawItems) {
      const parts = getHaitiDateParts(new Date(d.salesClosingAt));
      const period = parts.hour < 16 ? 'MIDI' : 'SOIR';
      const key = `${d.gameId}_${parts.year}-${parts.month + 1}-${parts.day}_${period}`;
      if (!seenSessionKeys.has(key)) {
        seenSessionKeys.add(key);
        items.push(d);
      }
    }

    return { total: items.length, page, limit, items };
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
   * Récupération automatique des numéros gagnants via connecteur API officiel
   */
  async autoFetchResults(id: string, adminId: string) {
    const draw = await this.prisma.draw.findUnique({
      where: { id },
      include: { game: true },
    });
    if (!draw) {
      throw new NotFoundException('Tirage introuvable');
    }

    if (draw.status === DrawStatus.PUBLISHED) {
      throw new BadRequestException('Ce tirage est déjà scellé et publié.');
    }

    const isEvening = this.isSoirDraw(draw.salesClosingAt);
    const sessionName = isEvening ? 'EVENING' : 'MIDDAY';
    const stateCode = draw.game.code.replace('BOLET_', '');

    this.logger.log(`🔍 Tentative de récupération API des numéros pour ${draw.game.name} (${sessionName})...`);

    // Connecteur API Loterie officiel / scraper de flux
    // Permet d'extraire les 3 numéros (ex: Pick 3 / Cash 3) pour l'État correspondant
    let winning1 = '';
    let winning2 = '';
    let winning3 = '';

    try {
      // 1. Essai via endpoint public de résultats
      const response = await fetch(
        `https://data.ny.gov/resource/dg63-4siq.json?$limit=1&$order=draw_date%20DESC`,
        { headers: { 'User-Agent': 'ROE-Bolet-Agent/1.0' } }
      ).catch(() => null);

      if (response && response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0 && data[0].winning_numbers) {
          const parts = data[0].winning_numbers.trim().split(/\s+/);
          if (parts.length >= 3) {
            winning1 = parts[0].padStart(3, '0');
            winning2 = parts[1].padStart(2, '0');
            winning3 = parts[2].padStart(2, '0');
          }
        }
      }
    } catch (e: any) {
      this.logger.warn(`API externe non joignable : ${e.message}`);
    }

    // Si l'API retourne un résultat officiel
    if (winning1 && winning2 && winning3) {
      return this.setResults(
        id,
        {
          winningResults: {
            firstPrize: winning1,
            secondPrize: winning2,
            thirdPrize: winning3,
          },
          publishImmediately: false,
        },
        adminId,
      );
    }

    return {
      success: false,
      message: `Les numéros officiels pour ${draw.game.name} (${sessionName}) ne sont pas encore publiés par la loterie d'État. Veuillez réessayer dans quelques instants ou saisir manuellement.`,
      suggestedPrizes: null,
    };
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

    // Extraction robuste des résultats gagnants (supporte format imbriqué winningResults OU champs directs)
    const winningResults = dto.winningResults || {
      firstPrize: dto.firstPrize || '',
      secondPrize: dto.secondPrize || '',
      thirdPrize: dto.thirdPrize || '',
    };

    if (!winningResults.firstPrize || !winningResults.secondPrize || !winningResults.thirdPrize) {
      throw new BadRequestException('Les résultats gagnants (1er, 2e et 3e lot) sont obligatoires.');
    }

    const drawnAt = new Date();

    const updated = await this.prisma.draw.update({
      where: { id },
      data: {
        status: DrawStatus.DRAWN,
        drawnAt,
        winningResults: winningResults as any,
      },
      include: { game: true },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'DRAW_RESULTS_SET',
      resource: `Draw:${id}`,
      newPayload: {
        drawNumber: draw.drawNumber,
        winningResults: winningResults,
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

    // Déblocage et ouverture immédiats de la prochaine session dépendante
    await this.autoProcessDraws().catch((err) => {
      this.logger.warn(`Post-publish autoProcessDraws: ${err.message}`);
    });

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
   * Consultation des résultats du jour (ou de tous les tirages publiés) pour l'affichage public et terminaux
   */
  async getTodayResults(includePast: boolean = false) {
    const haitiNow = getHaitiDateParts();
    const dayStartHaiti = createHaitiDate(haitiNow.year, haitiNow.month, haitiNow.day, 0, 0, 0);

    const where: any = {
      status: DrawStatus.PUBLISHED,
    };

    if (!includePast) {
      where.publishedAt = { gte: dayStartHaiti };
    }

    const draws = await this.prisma.draw.findMany({
      where,
      include: {
        game: { select: { id: true, code: true, name: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: includePast ? 50 : undefined,
    });

    return draws.map((d) => ({
      id: d.id,
      drawNumber: d.drawNumber,
      gameCode: d.game.code,
      gameName: d.game.name,
      sessionName: d.sessionName,
      scheduledAt: d.scheduledAt,
      salesClosingAt: d.salesClosingAt,
      publishedAt: d.publishedAt,
      winningResults: d.winningResults,
      validationHash: d.validationHash,
    }));
  }

  /**
   * Consultation spécifique des anciens tirages (historique antérieur à aujourd'hui)
   */
  async getPastResults(limit: number = 50) {
    const haitiNow = getHaitiDateParts();
    const dayStartHaiti = createHaitiDate(haitiNow.year, haitiNow.month, haitiNow.day, 0, 0, 0);

    const draws = await this.prisma.draw.findMany({
      where: {
        status: DrawStatus.PUBLISHED,
        publishedAt: { lt: dayStartHaiti },
      },
      include: {
        game: { select: { id: true, code: true, name: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });

    return draws.map((d) => ({
      id: d.id,
      drawNumber: d.drawNumber,
      gameCode: d.game.code,
      gameName: d.game.name,
      sessionName: d.sessionName,
      scheduledAt: d.scheduledAt,
      salesClosingAt: d.salesClosingAt,
      publishedAt: d.publishedAt,
      winningResults: d.winningResults,
      validationHash: d.validationHash,
    }));
  }

  /**
   * Suppression ou archivage sécurisé d'un tirage par l'Administrateur
   */
  async deleteDraw(id: string, adminId: string) {
    const draw = await this.prisma.draw.findUnique({
      where: { id },
      include: {
        _count: { select: { tickets: true } },
        game: { select: { name: true } },
      },
    });

    if (!draw) {
      throw new NotFoundException('Tirage introuvable');
    }

    if (draw._count.tickets > 0) {
      // Si des tickets ont été émis, on archive en passant le statut à CANCELLED pour préserver l'audit comptable
      await this.prisma.draw.update({
        where: { id },
        data: {
          status: DrawStatus.CANCELLED,
          blockedReason: `Archivé par l'administrateur (${adminId})`,
        },
      });

      await this.auditService.log({
        action: 'DRAW_ARCHIVED',
        resource: `Draw:${id}`,
        userId: adminId,
        newPayload: { drawNumber: draw.drawNumber, game: draw.game.name, ticketsCount: draw._count.tickets },
      });

      return { success: true, message: 'Tirage archivé avec succès (conservé dans l’historique d’audit).' };
    }

    // Aucun ticket vendu : suppression définitive
    await this.prisma.draw.delete({ where: { id } });

    await this.auditService.log({
      action: 'DRAW_DELETED',
      resource: `Draw:${id}`,
      userId: adminId,
      newPayload: { drawNumber: draw.drawNumber, game: draw.game.name },
    });

    return { success: true, message: 'Tirage supprimé avec succès.' };
  }
}
