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
}
