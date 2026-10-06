import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateDrawDto } from './dto/create-draw.dto';
import { DrawStatus } from '@prisma/client';

@Injectable()
export class DrawsService {
  private readonly logger = new Logger(DrawsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

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
        status: DrawStatus.OPEN, // Ouvert directement aux ventes
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

    const updated = await this.prisma.draw.update({
      where: { id },
      data: { status: DrawStatus.CLOSED },
      include: { game: { select: { code: true, name: true } } },
    });

    // Émission WebSocket instantanée vers tous les terminaux Android
    this.realtimeGateway.server.emit('draw:closed', {
      drawId: draw.id,
      drawNumber: draw.drawNumber,
      gameCode: updated.game.code,
      timestamp: new Date().toISOString(),
    });

    await this.auditService.log({
      userId: adminId,
      action: 'DRAW_CLOSED',
      resource: `Draw:${id}`,
      newPayload: { drawNumber: draw.drawNumber, status: DrawStatus.CLOSED },
    });

    return updated;
  }
}
