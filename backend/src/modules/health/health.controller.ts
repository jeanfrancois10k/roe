import { Controller, Get, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Public } from '../auth/decorators/public.decorator';

@Controller('api/v1/health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly realtimeGateway?: RealtimeGateway,
  ) {}

  @Public()
  @Get()
  async getHealth() {
    let dbStatus = 'UP';
    let dbLatencyMs = 0;

    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
    } catch (err) {
      dbStatus = 'DOWN';
      dbLatencyMs = Date.now() - start;
    }

    const mem = process.memoryUsage();
    const activeClients = this.realtimeGateway?.server?.engine?.clientsCount || 0;

    return {
      status: dbStatus === 'UP' ? 'HEALTHY' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      system: {
        nodeVersion: process.version,
        memoryRssMb: Number((mem.rss / 1024 / 1024).toFixed(1)),
        memoryHeapUsedMb: Number((mem.heapUsed / 1024 / 1024).toFixed(1)),
        memoryHeapTotalMb: Number((mem.heapTotal / 1024 / 1024).toFixed(1)),
      },
      realtime: {
        activeConnectedClients: activeClients,
      },
    };
  }
}
