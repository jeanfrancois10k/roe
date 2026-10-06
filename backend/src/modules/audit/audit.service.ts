import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

  async findAll(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findMany({
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
    return { total, page, limit, items };
  }
}
