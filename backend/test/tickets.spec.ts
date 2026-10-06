import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from '../src/modules/tickets/tickets.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { VendorStatus, DeviceStatus, DrawStatus } from '@prisma/client';

describe('TicketsService (Règles Critiques & Sécurité Transactionnelle)', () => {
  let ticketsService: TicketsService;
  let prismaMock: any;
  let auditMock: any;

  beforeEach(async () => {
    prismaMock = {
      transaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      vendor: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      game: {
        findUnique: jest.fn(),
      },
      draw: {
        findUnique: jest.fn(),
      },
      ticket: {
        aggregate: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    auditMock = {
      log: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'HMAC_TICKET_SECRET') return 'test_secret';
              if (key === 'CANCELLATION_WINDOW_MINUTES') return 5;
              return null;
            }),
          },
        },
      ],
    }).compile();

    ticketsService = module.get<TicketsService>(TicketsService);
  });

  const validDto = {
    gameId: 'g-1',
    drawId: 'd-1',
    deviceUuid: 'DEV-POS-1',
    idempotencyKey: 'IDEMP-12345',
    grids: [{ numbers: ['07', '42'], betAmount: 10.0, multiplier: 1 }],
  };

  it('RÈGLE 8 : doit rejeter si la clé d’idempotence existe déjà (Anti-Rejeu)', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ id: 'tx-existing' });

    await expect(
      ticketsService.sellTicket(validDto, 'v-1', 'u-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('RÈGLE 2 : doit bloquer la vente si le vendeur est SUSPENDU (Kill Switch)', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);
    prismaMock.vendor.findUnique.mockResolvedValue({
      id: 'v-1',
      status: VendorStatus.SUSPENDED,
      devices: [{ deviceUuid: 'DEV-POS-1', status: DeviceStatus.AUTHORIZED }],
    });

    await expect(
      ticketsService.sellTicket(validDto, 'v-1', 'u-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('RÈGLE 3 : doit bloquer la vente si l’appareil Android est RÉVOQUÉ', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);
    prismaMock.vendor.findUnique.mockResolvedValue({
      id: 'v-1',
      status: VendorStatus.ACTIVE,
      devices: [{ deviceUuid: 'DEV-POS-1', status: DeviceStatus.REVOKED }],
    });

    await expect(
      ticketsService.sellTicket(validDto, 'v-1', 'u-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('RÈGLE 5 : doit bloquer la vente si le tirage est après la clôture des ventes', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);
    prismaMock.vendor.findUnique.mockResolvedValue({
      id: 'v-1',
      status: VendorStatus.ACTIVE,
      devices: [{ deviceUuid: 'DEV-POS-1', status: DeviceStatus.AUTHORIZED }],
    });
    prismaMock.game.findUnique.mockResolvedValue({
      id: 'g-1',
      status: 'ACTIVE',
      minBetAmount: 1.0,
      maxBetAmount: 100.0,
    });

    // Tirage dont les ventes étaient closes il y a 10 minutes
    const pastClosing = new Date(Date.now() - 10 * 60 * 1000);
    prismaMock.draw.findUnique.mockResolvedValue({
      id: 'd-1',
      gameId: 'g-1',
      status: DrawStatus.OPEN,
      salesClosingAt: pastClosing,
    });

    await expect(
      ticketsService.sellTicket(validDto, 'v-1', 'u-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('RÈGLE 9 : doit refuser la vente si les fonds du vendeur sont insuffisants', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);
    prismaMock.vendor.findUnique.mockResolvedValue({
      id: 'v-1',
      status: VendorStatus.ACTIVE,
      maxTicketAmount: 500,
      dailySalesLimit: 5000,
      devices: [{ deviceUuid: 'DEV-POS-1', status: DeviceStatus.AUTHORIZED }],
    });
    prismaMock.game.findUnique.mockResolvedValue({
      id: 'g-1',
      status: 'ACTIVE',
      minBetAmount: 1.0,
      maxBetAmount: 100.0,
    });
    prismaMock.draw.findUnique.mockResolvedValue({
      id: 'd-1',
      gameId: 'g-1',
      status: DrawStatus.OPEN,
      salesClosingAt: new Date(Date.now() + 60 * 60 * 1000), // Dans 1h
    });
    prismaMock.ticket.aggregate.mockResolvedValue({ _sum: { totalAmount: 0 } });

    // Lock pessimiste : solde à 0 et découvert à 0 -> mise de 10 impossible
    prismaMock.$queryRaw.mockResolvedValue([
      { currentBalance: 0, creditLimit: 0 },
    ]);

    await expect(
      ticketsService.sellTicket(validDto, 'v-1', 'u-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
