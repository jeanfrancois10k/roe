import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { Prisma } from '@prisma/client';

export interface CreateAuditLogDto {
  userId?: string;
  action: string;
  resource: string;
  ipAddress?: string;
  userAgent?: string;
  oldPayload?: any;
  newPayload?: any;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: CreateAuditLogDto) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          userId: entry.userId || null,
          action: entry.action,
          resource: entry.resource,
          ipAddress: entry.ipAddress || null,
          userAgent: entry.userAgent || null,
          oldPayload: entry.oldPayload ? JSON.parse(JSON.stringify(entry.oldPayload)) : null,
          newPayload: entry.newPayload ? JSON.parse(JSON.stringify(entry.newPayload)) : null,
        },
      });
    } catch (err) {
      this.logger.error(`Échec de l'enregistrement de l'Audit Log [${entry.action}]`, err);
    }
  }

  async findAll(query: AuditQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (query.action) {
      where.action = query.action;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.resource) {
      where.resource = { contains: query.resource, mode: 'insensitive' };
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: 'insensitive' } },
        { resource: { contains: query.search, mode: 'insensitive' } },
        { ipAddress: { contains: query.search, mode: 'insensitive' } },
        { user: { username: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, username: true, role: true },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  async getDistinctActions() {
    const actionsRaw = await this.prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });
    return actionsRaw.map((a) => a.action);
  }

  async findById(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, role: true, email: true },
        },
      },
    });

    if (!log) {
      throw new NotFoundException('Journal d’audit introuvable');
    }

    return log;
  }
}
