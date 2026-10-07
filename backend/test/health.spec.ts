import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../src/modules/health/health.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { RealtimeGateway } from '../src/modules/realtime/realtime.gateway';

describe('HealthController (Surveillance & Health Check)', () => {
  let controller: HealthController;
  let prismaMock: any;
  let realtimeMock: any;

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };

    realtimeMock = {
      server: {
        engine: {
          clientsCount: 5,
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: RealtimeGateway, useValue: realtimeMock },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('doit renvoyer un statut HEALTHY lorsque la base de données répond', async () => {
    const res = await controller.getHealth();

    expect(res.status).toBe('HEALTHY');
    expect(res.database.status).toBe('UP');
    expect(res.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(res.realtime.activeConnectedClients).toBe(5);
    expect(res.system.memoryHeapUsedMb).toBeGreaterThan(0);
  });

  it('doit renvoyer DEGRADED si la base de données échoue', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('DB Connection Refused'));

    const res = await controller.getHealth();

    expect(res.status).toBe('DEGRADED');
    expect(res.database.status).toBe('DOWN');
  });
});
