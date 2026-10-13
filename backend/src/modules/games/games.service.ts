import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { GameStatus } from '@prisma/client';

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateGameDto, adminId?: string) {
    const existing = await this.prisma.game.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Un jeu avec le code '${dto.code}' existe déjà.`);
    }

    const game = await this.prisma.game.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description || null,
        status: dto.status || GameStatus.ACTIVE,
        minBetAmount: dto.minBetAmount,
        maxBetAmount: dto.maxBetAmount,
        gameRules: dto.gameRules,
        drawFrequency: dto.drawFrequency || null,
        defaultCommission: dto.defaultCommission ?? 5.0,
      },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'GAME_CREATED',
      resource: `Game:${game.id}`,
      newPayload: { code: game.code, name: game.name },
    });

    return game;
  }

  async findAll(status?: GameStatus) {
    const where = status ? { status } : {};
    const games = await this.prisma.game.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { draws: true, tickets: true },
        },
      },
    });

    return games.map((g) => ({
      ...g,
      minBetAmount: Number(g.minBetAmount),
      maxBetAmount: Number(g.maxBetAmount),
      defaultCommission: Number(g.defaultCommission),
    }));
  }

  async findById(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: {
        draws: {
          take: 5,
          orderBy: { scheduledAt: 'desc' },
        },
      },
    });
    if (!game) {
      throw new NotFoundException('Jeu introuvable');
    }

    return {
      ...game,
      minBetAmount: Number(game.minBetAmount),
      maxBetAmount: Number(game.maxBetAmount),
      defaultCommission: Number(game.defaultCommission),
    };
  }

  async update(id: string, dto: UpdateGameDto, adminId?: string) {
    const existing = await this.prisma.game.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Jeu introuvable');
    }

    const updated = await this.prisma.game.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        minBetAmount: dto.minBetAmount,
        maxBetAmount: dto.maxBetAmount,
        gameRules: dto.gameRules ? dto.gameRules : undefined,
        drawFrequency: dto.drawFrequency,
        defaultCommission: dto.defaultCommission,
      },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'GAME_UPDATED',
      resource: `Game:${id}`,
      oldPayload: existing,
      newPayload: updated,
    });

    return updated;
  }

  // ----------------------------------------------------
  // GESTION DES NUMÉROS BLOQUÉS & PLAFONDS
  // ----------------------------------------------------

  async getBlockedNumbers(gameId?: string, drawId?: string) {
    const where: any = {};
    if (gameId) where.gameId = gameId;
    if (drawId) where.drawId = drawId;

    const items = await this.prisma.blockedNumber.findMany({
      where,
      include: {
        game: { select: { id: true, name: true, code: true } },
        draw: { select: { id: true, drawNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((item) => ({
      ...item,
      maxAmount: item.maxAmount ? Number(item.maxAmount) : null,
    }));
  }

  async blockNumber(
    dto: {
      number: string;
      gameId?: string;
      drawId?: string;
      isBlocked?: boolean;
      maxAmount?: number;
      note?: string;
    },
    adminId?: string,
  ) {
    const cleanNumber = dto.number.trim();
    if (!cleanNumber) {
      throw new BadRequestException('Le numéro est obligatoire');
    }

    const created = await this.prisma.blockedNumber.create({
      data: {
        number: cleanNumber,
        gameId: dto.gameId || null,
        drawId: dto.drawId || null,
        isBlocked: dto.isBlocked !== undefined ? dto.isBlocked : true,
        maxAmount: dto.maxAmount !== undefined ? dto.maxAmount : null,
        note: dto.note || null,
      },
      include: {
        game: true,
        draw: true,
      },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'NUMBER_RESTRICTION_SET',
      resource: `BlockedNumber:${created.id}`,
      newPayload: {
        number: cleanNumber,
        isBlocked: created.isBlocked,
        maxAmount: created.maxAmount,
      },
    });

    return {
      ...created,
      maxAmount: created.maxAmount ? Number(created.maxAmount) : null,
    };
  }

  async unblockNumber(id: string, adminId?: string) {
    const existing = await this.prisma.blockedNumber.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Règle de numéro introuvable');
    }

    await this.prisma.blockedNumber.delete({ where: { id } });

    await this.auditService.log({
      userId: adminId,
      action: 'NUMBER_RESTRICTION_REMOVED',
      resource: `BlockedNumber:${id}`,
      oldPayload: existing,
    });

    return { success: true, message: `Restriction supprimée pour le numéro ${existing.number}` };
  }
}
