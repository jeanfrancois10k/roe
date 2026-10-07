import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from '../src/modules/sync/sync.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TicketsService } from '../src/modules/tickets/tickets.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { VendorStatus, DeviceStatus, DrawStatus } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';

describe('Phase 9: SyncService (Synchronisation Offline-First & Idempotence)', () => {
  let syncService: SyncService;
  let prismaMock: any;
  let ticketsServiceMock: any;
  let auditMock: any;

  beforeEach(async () => {
    prismaMock = {
      vendor: {
        findUnique: jest.fn(),
      },
      device: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        findUnique: jest.fn(),
      },
      draw: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      game: {
        findMany: jest.fn(),
      },
    };

    ticketsServiceMock = {
      sellTicket: jest.fn(),
    };

    auditMock = {
      log: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TicketsService, useValue: ticketsServiceMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    syncService = module.get<SyncService>(SyncService);
  });

  const validBatchDto = {
    deviceUuid: 'DEV-POS-1',
    pendingTickets: [
      {
        gameId: 'g-1',
        drawId: 'd-1',
        deviceUuid: 'DEV-POS-1',
        idempotencyKey: 'OFFLINE-KEY-001',
        grids: [{ numbers: ['12'], betAmount: 10 }],
      },
    ],
  };

  it('doit synchroniser un ticket préparé hors ligne et renvoyer le delta serveur', async () => {
    prismaMock.vendor.findUnique
      .mockResolvedValueOnce({ id: 'v-1', status: VendorStatus.ACTIVE, vendorCode: 'VND-001' }) // 1er check
      .mockResolvedValueOnce({ currentBalance: 990, creditLimit: 200, dailySalesLimit: 5000 }); // delta

    prismaMock.device.findUnique.mockResolvedValue({
      id: 'dev-1',
      deviceUuid: 'DEV-POS-1',
      vendorId: 'v-1',
      status: DeviceStatus.AUTHORIZED,
    });
    prismaMock.device.update.mockResolvedValue({});

    // Pas de doublon existant
    prismaMock.transaction.findUnique.mockResolvedValue(null);

    // Tirage ouvert dans le futur
    prismaMock.draw.findUnique.mockResolvedValue({
      id: 'd-1',
      status: DrawStatus.OPEN,
      salesClosingAt: new Date(Date.now() + 60 * 60 * 1000), // Dans 1h
    });

    ticketsServiceMock.sellTicket.mockResolvedValue({
      success: true,
      ticket: {
        id: 't-new-1',
        ticketNumber: 'ROE-20261007-001',
        secureChecksum: 'chk-123',
        totalAmount: 10,
      },
    });

    prismaMock.draw.findMany.mockResolvedValue([
      {
        id: 'd-1',
        drawNumber: 101,
        gameId: 'g-1',
        scheduledAt: new Date(),
        salesClosingAt: new Date(),
        game: { id: 'g-1', code: 'BOLET_NY', name: 'Bolet NY', minBetAmount: 1, maxBetAmount: 100 },
      },
    ]);

    prismaMock.game.findMany.mockResolvedValue([
      { id: 'g-1', code: 'BOLET_NY', name: 'Bolet NY', minBetAmount: 1, maxBetAmount: 100, gameRules: {} },
    ]);

    const res = await syncService.syncBatch(validBatchDto, 'v-1', 'u-1');

    expect(res.summary.success).toBe(1);
    expect(res.summary.duplicates).toBe(0);
    expect(res.summary.rejected).toBe(0);
    expect(res.processedTickets[0].status).toBe('SUCCESS');
    expect(res.processedTickets[0].ticketNumber).toBe('ROE-20261007-001');
    expect(ticketsServiceMock.sellTicket).toHaveBeenCalled();
    expect(res.delta.vendorBalance).toBe(990);
    expect(res.delta.openDraws).toHaveLength(1);
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'OFFLINE_SYNC_PROCESSED' }),
    );
  });

  it('doit détecter et éliminer les doublons par idempotencyKey sans re-débiter le solde', async () => {
    prismaMock.vendor.findUnique
      .mockResolvedValueOnce({ id: 'v-1', status: VendorStatus.ACTIVE, vendorCode: 'VND-001' })
      .mockResolvedValueOnce({ currentBalance: 1000 });

    prismaMock.device.findUnique.mockResolvedValue({
      id: 'dev-1',
      deviceUuid: 'DEV-POS-1',
      vendorId: 'v-1',
      status: DeviceStatus.AUTHORIZED,
    });
    prismaMock.device.update.mockResolvedValue({});

    // La transaction existe DÉJÀ en base (reconnexion après timeout réseau)
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-already',
      reference: 'OFFLINE-KEY-001',
      amount: -10,
      ticket: { ticketNumber: 'ROE-20261007-ALREADY', secureChecksum: 'chk-abc', totalAmount: 10 },
    });

    prismaMock.draw.findMany.mockResolvedValue([]);
    prismaMock.game.findMany.mockResolvedValue([]);

    const res = await syncService.syncBatch(validBatchDto, 'v-1', 'u-1');

    expect(res.summary.success).toBe(0);
    expect(res.summary.duplicates).toBe(1);
    expect(res.processedTickets[0].status).toBe('ALREADY_SYNCED');
    expect(res.processedTickets[0].ticketNumber).toBe('ROE-20261007-ALREADY');
    // NE DOIT PAS appeler sellTicket !
    expect(ticketsServiceMock.sellTicket).not.toHaveBeenCalled();
  });

  it('RÈGLE ABSOLUE 14 & 20 : doit rejeter tout ticket soumis après la clôture du tirage', async () => {
    prismaMock.vendor.findUnique
      .mockResolvedValueOnce({ id: 'v-1', status: VendorStatus.ACTIVE, vendorCode: 'VND-001' })
      .mockResolvedValueOnce({ currentBalance: 1000 });

    prismaMock.device.findUnique.mockResolvedValue({
      id: 'dev-1',
      deviceUuid: 'DEV-POS-1',
      vendorId: 'v-1',
      status: DeviceStatus.AUTHORIZED,
    });
    prismaMock.device.update.mockResolvedValue({});

    prismaMock.transaction.findUnique.mockResolvedValue(null);

    // Tirage dont les ventes ont fermé il y a 5 minutes
    const pastClosing = new Date(Date.now() - 5 * 60 * 1000);
    prismaMock.draw.findUnique.mockResolvedValue({
      id: 'd-1',
      status: DrawStatus.OPEN,
      salesClosingAt: pastClosing,
    });

    prismaMock.draw.findMany.mockResolvedValue([]);
    prismaMock.game.findMany.mockResolvedValue([]);

    const res = await syncService.syncBatch(validBatchDto, 'v-1', 'u-1');

    expect(res.summary.success).toBe(0);
    expect(res.summary.rejected).toBe(1);
    expect(res.processedTickets[0].status).toBe('REJECTED');
    expect(res.processedTickets[0].reason).toContain('les ventes sont closes pour ce tirage');
    expect(ticketsServiceMock.sellTicket).not.toHaveBeenCalled();
  });
});
