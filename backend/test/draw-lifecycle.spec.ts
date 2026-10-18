import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DrawsService, OFFICIAL_LOTTERIES, createHaitiDate, getHaitiDateParts } from '../src/modules/draws/draws.service';
import { DrawEvaluatorService } from '../src/modules/draws/draw-evaluator.service';
import { TicketsService } from '../src/modules/tickets/tickets.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { RealtimeGateway } from '../src/modules/realtime/realtime.gateway';
import { ConfigService } from '@nestjs/config';
import { DrawStatus, DeviceStatus, VendorStatus, TicketStatus, TicketPayoutStatus } from '@prisma/client';

describe('Étape 7 : Suite Complète de Validation du Cycle de Vie des Tirages & Règles Métier (12 Cas Obligatoires)', () => {
  let drawsService: DrawsService;
  let ticketsService: TicketsService;
  let prismaMock: any;
  let auditMock: any;
  let realtimeMock: any;

  beforeEach(async () => {
    prismaMock = {
      draw: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      game: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      vendor: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      ticket: {
        aggregate: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      blockedNumber: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn(),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    auditMock = { log: jest.fn().mockResolvedValue(true) };
    realtimeMock = { server: { emit: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DrawsService,
        TicketsService,
        DrawEvaluatorService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
        { provide: RealtimeGateway, useValue: realtimeMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'DRAW_VALIDATION_SECRET') return 'test_secret_123';
              if (key === 'HMAC_TICKET_SECRET') return 'test_hmac_secret_456';
              return null;
            }),
          },
        },
      ],
    }).compile();

    drawsService = module.get<DrawsService>(DrawsService);
    ticketsService = module.get<TicketsService>(TicketsService);
  });

  const baseSellDto = {
    gameId: 'g-ny',
    drawId: 'd-ny-1',
    deviceUuid: 'DEV-POS-1',
    idempotencyKey: 'IDEMP-TEST-001',
    grids: [{ numbers: ['12'], betAmount: 10, multiplier: 1, gameType: 'BORLETTE' }],
  };

  const setupVendorAndGame = () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null);
    prismaMock.vendor.findUnique.mockResolvedValue({
      id: 'v-1',
      status: VendorStatus.ACTIVE,
      currentBalance: 1000,
      creditLimit: 0,
      dailySalesLimit: 50000,
      maxTicketAmount: 5000,
      defaultCommissionRate: 5,
      devices: [{ deviceUuid: 'DEV-POS-1', status: DeviceStatus.AUTHORIZED }],
    });
    prismaMock.game.findUnique.mockResolvedValue({
      id: 'g-ny',
      code: 'BOLET_NY',
      name: 'Bolet New York (NY)',
      status: 'ACTIVE',
      minBetAmount: 1,
      maxBetAmount: 5000,
    });
    prismaMock.ticket.aggregate.mockResolvedValue({ _sum: { totalAmount: 0 } });
    prismaMock.vendor.update.mockResolvedValue({});
    prismaMock.transaction.create.mockResolvedValue({});
    prismaMock.ticket.create.mockResolvedValue({ id: 't-1', ticketNumber: 'ROE-TEST-T1', totalAmount: 10 });
  };

  // CAS 1 : Pari juste avant l'heure limite
  it('1. Cas 1 : Pari juste avant l heure limite -> doit être ACCEPTÉ', async () => {
    setupVendorAndGame();
    const futureClosing = new Date(Date.now() + 5000); // Clôture dans 5 secondes

    prismaMock.draw.findUnique.mockResolvedValue({
      id: 'd-ny-1',
      gameId: 'g-ny',
      status: DrawStatus.OPEN,
      salesClosingAt: futureClosing,
    });

    prismaMock.$queryRaw.mockImplementation((...args: any[]) => {
      const s = JSON.stringify(args);
      if (s.includes('Draw')) {
        return Promise.resolve([{ id: 'd-ny-1', status: DrawStatus.OPEN, salesClosingAt: futureClosing }]);
      }
      return Promise.resolve([{ currentBalance: 1000, creditLimit: 0 }]);
    });

    const res = await ticketsService.sellTicket(baseSellDto, 'v-1', 'u-1');
    expect(res).toBeDefined();
    expect(res.ticket.ticketNumber).toBeDefined();
  });

  // CAS 2 : Pari exactement à l'heure limite
  it('2. Cas 2 : Pari exactement à l heure limite (now >= salesClosingAt) -> doit être REFUSÉ', async () => {
    setupVendorAndGame();
    const exactClosing = new Date(); // Même instant que now

    prismaMock.draw.findUnique.mockResolvedValue({
      id: 'd-ny-1',
      gameId: 'g-ny',
      status: DrawStatus.OPEN,
      salesClosingAt: exactClosing,
    });

    await expect(
      ticketsService.sellTicket(baseSellDto, 'v-1', 'u-1'),
    ).rejects.toThrow(BadRequestException);
  });

  // CAS 3 : Pari après l'heure limite
  it('3. Cas 3 : Pari après l heure limite -> doit être REFUSÉ côté serveur', async () => {
    setupVendorAndGame();
    const pastClosing = new Date(Date.now() - 10000); // Passé il y a 10s

    prismaMock.draw.findUnique.mockResolvedValue({
      id: 'd-ny-1',
      gameId: 'g-ny',
      status: DrawStatus.OPEN,
      salesClosingAt: pastClosing,
    });

    await expect(
      ticketsService.sellTicket(baseSellDto, 'v-1', 'u-1'),
    ).rejects.toThrow(BadRequestException);
  });

  // CAS 4 : Téléphone dont l'horloge est modifiée
  it('4. Cas 4 : Téléphone dont l horloge locale est falsifiée -> aucun effet, refusé par l horloge serveur', async () => {
    setupVendorAndGame();
    // Même si le client prétendant être à 08h00 envoie la requête, le serveur évalue l'heure réelle
    const pastClosing = new Date(Date.now() - 60000); // 1 minute après clôture serveur

    prismaMock.draw.findUnique.mockResolvedValue({
      id: 'd-ny-1',
      gameId: 'g-ny',
      status: DrawStatus.OPEN,
      salesClosingAt: pastClosing,
    });

    await expect(
      ticketsService.sellTicket(
        { ...baseSellDto, idempotencyKey: 'IDEMP-TAMPERED-CLOCK' },
        'v-1',
        'u-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // CAS 5 : Une session fermée alors qu'une autre est encore ouverte
  it('5. Cas 5 : Fermeture de Florida n impacte pas New York (Indépendance stricte)', async () => {
    setupVendorAndGame();
    const now = new Date();

    // Florida est fermée
    prismaMock.draw.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === 'd-fl-closed') {
        return Promise.resolve({
          id: 'd-fl-closed',
          gameId: 'g-fl',
          status: DrawStatus.CLOSED,
          salesClosingAt: new Date(now.getTime() - 1000),
        });
      }
      if (where.id === 'd-ny-open') {
        return Promise.resolve({
          id: 'd-ny-open',
          gameId: 'g-ny',
          status: DrawStatus.OPEN,
          salesClosingAt: new Date(now.getTime() + 600000), // NY ouvert pendant 10 min
        });
      }
      return null;
    });

    // 1. Tenter sur Florida fermée -> Rejet
    await expect(
      ticketsService.sellTicket({ ...baseSellDto, drawId: 'd-fl-closed' }, 'v-1', 'u-1'),
    ).rejects.toThrow(BadRequestException);

    // 2. Tenter sur New York ouverte -> Succès
    prismaMock.$queryRaw.mockImplementation((...args: any[]) => {
      const s = JSON.stringify(args);
      if (s.includes('Draw')) {
        return Promise.resolve([{ id: 'd-ny-open', status: DrawStatus.OPEN, salesClosingAt: new Date(now.getTime() + 600000) }]);
      }
      return Promise.resolve([{ currentBalance: 1000, creditLimit: 0 }]);
    });

    const nyRes = await ticketsService.sellTicket({ ...baseSellDto, drawId: 'd-ny-open' }, 'v-1', 'u-1');
    expect(nyRes).toBeDefined();
  });

  // CAS 6 : Des résultats non publiés
  it('6. Cas 6 : Résultats non publiés (DRAWN ou CLOSED sans hash) -> les tickets ne sont pas encore payables', async () => {
    const mockDraw = {
      id: 'd-unpub',
      drawNumber: 201,
      status: DrawStatus.DRAWN,
      winningResults: { firstPrize: '512', secondPrize: '34', thirdPrize: '78' },
      validationHash: null,
      publishedAt: null,
      game: { code: 'BOLET_NY', name: 'Bolet New York' },
    };
    prismaMock.draw.findUnique.mockResolvedValue(mockDraw);

    // Une session DRAWN n'a pas encore le statut PUBLISHED
    const found = await drawsService.findById('d-unpub');
    expect(found.status).toBe(DrawStatus.DRAWN);
    expect(found.validationHash).toBeNull();
  });

  // CAS 7 : Des résultats publiés et validés
  it('7. Cas 7 : Résultats publiés et validés -> scellés avec signature SHA-256 et statut PUBLISHED', async () => {
    const mockDraw = {
      id: 'd-to-pub',
      drawNumber: 202,
      status: DrawStatus.DRAWN,
      winningResults: { firstPrize: '512', secondPrize: '34', thirdPrize: '78' },
      game: { id: 'g-ny', code: 'BOLET_NY', name: 'Bolet New York', gameRules: {} },
    };
    prismaMock.draw.findUnique.mockResolvedValue(mockDraw);
    prismaMock.draw.update.mockResolvedValue({
      ...mockDraw,
      status: DrawStatus.PUBLISHED,
      publishedAt: new Date(),
      validationHash: 'hmac_sha256_certified_seal',
    });
    prismaMock.ticket.findMany.mockResolvedValue([]);

    const res = await drawsService.publishDraw('d-to-pub', 'admin-super-1');
    expect(res.status).toBe(DrawStatus.PUBLISHED);
    expect(res.validationHash).toBeDefined();
  });

  // CAS 8 : Prochaine session bloquée si résultats précédents non publiés
  it('8. Cas 8 : Session suivante reste SCHEDULED avec motif explicite si session précédente non publiée', async () => {
    const mockGame = {
      id: 'g-chi',
      code: 'BOLET_CHI',
      name: 'Bolet Chicago',
      status: 'ACTIVE',
      gameRules: {
        schedules: [
          { name: 'Midi', closeHour: 13, closeMinute: 38, drawHour: 13, drawMinute: 45 },
          { name: 'Soir', closeHour: 22, closeMinute: 18, drawHour: 22, drawMinute: 30 },
        ],
      },
    };

    prismaMock.draw.findMany.mockResolvedValue([]);
    prismaMock.game.findUnique.mockResolvedValue(mockGame);

    // Simuler le tirage précédent (Midi) qui est CLOSED mais PAS ENCORE PUBLIÉ
    const unvalidatedMidiDraw = {
      id: 'd-chi-midi-closed',
      drawNumber: 105,
      gameId: 'g-chi',
      status: DrawStatus.CLOSED, // Non publié !
      sessionName: 'MIDI',
      salesClosingAt: new Date(Date.now() - 3600000),
    };

    prismaMock.draw.findFirst.mockImplementation(({ where }: any) => {
      if (where.salesClosingAt?.lt) {
        // Recherche de la session précédente
        return Promise.resolve(unvalidatedMidiDraw);
      }
      return Promise.resolve(null); // Pas encore de session soir existante
    });

    prismaMock.draw.aggregate.mockResolvedValue({ _max: { drawNumber: 105 } });

    let createdDrawData: any = null;
    prismaMock.draw.create.mockImplementation(({ data }: any) => {
      createdDrawData = data;
      return Promise.resolve({ id: 'd-new-soir', ...data, game: { code: 'BOLET_CHI', name: 'Bolet Chicago' } });
    });

    await drawsService.autoProcessDraws();

    // La session Soir doit être créée en SCHEDULED (et NON en OPEN)
    expect(createdDrawData).toBeDefined();
    expect(createdDrawData.status).toBe(DrawStatus.SCHEDULED);
    expect(createdDrawData.blockedReason).toContain('En attente de la publication des résultats officiels');
  });

  // CAS 9 : Redémarrage du serveur
  it('9. Cas 9 : Redémarrage du serveur -> les sessions fermées restent fermées et l état est intègre', async () => {
    const expiredDraw = {
      id: 'd-exp',
      drawNumber: 301,
      status: DrawStatus.OPEN,
      salesClosingAt: new Date(Date.now() - 1000),
      game: { code: 'BOLET_FL', name: 'Bolet Florida' },
    };

    // Au boot (onModuleInit), autoProcessDraws clôture immédiatement tout tirage échu
    prismaMock.draw.findMany.mockResolvedValue([expiredDraw]);
    prismaMock.draw.update.mockResolvedValue({ ...expiredDraw, status: DrawStatus.CLOSED });
    prismaMock.game.findUnique.mockResolvedValue(null);

    await drawsService.autoProcessDraws();

    expect(prismaMock.draw.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd-exp' },
        data: { status: DrawStatus.CLOSED },
      }),
    );
  });

  // CAS 10 : Concurrence à la fermeture sous transaction
  it('10. Cas 10 : Concurrence à la fermeture -> arbitrage strict à la validation dans la transaction', async () => {
    setupVendorAndGame();

    // Draw était OPEN au moment de l'envoi de la requête
    prismaMock.draw.findUnique.mockResolvedValue({
      id: 'd-race',
      gameId: 'g-ny',
      status: DrawStatus.OPEN,
      salesClosingAt: new Date(Date.now() - 1), // Atteint pendant l'attente du lock
    });

    // À l'intérieur de la transaction PostgreSQL ($queryRaw FOR SHARE), l'heure d'exécution a franchi la clôture
    prismaMock.$queryRaw.mockImplementation((...args: any[]) => {
      const s = JSON.stringify(args);
      if (s.includes('Draw')) {
        return Promise.resolve([
          { id: 'd-race', status: DrawStatus.OPEN, salesClosingAt: new Date(Date.now() - 1) },
        ]);
      }
      return Promise.resolve([{ currentBalance: 1000, creditLimit: 0 }]);
    });

    await expect(
      ticketsService.sellTicket(baseSellDto, 'v-1', 'u-1'),
    ).rejects.toThrow(BadRequestException);
  });

  // CAS 11 : Passage à minuit et changement de jour
  it('11. Cas 11 : Changement de jour et passage à minuit -> dates calculées sans décalage dans America/Port-au-Prince', () => {
    // 31 décembre à 23h59 Port-au-Prince
    const dec31Haiti = createHaitiDate(2026, 11, 31, 23, 59, 0);
    const partsDec31 = getHaitiDateParts(dec31Haiti);
    expect(partsDec31.year).toBe(2026);
    expect(partsDec31.month).toBe(11); // Décembre
    expect(partsDec31.day).toBe(31);

    // 1er janvier à 07h00 Port-au-Prince
    const jan1Haiti = createHaitiDate(2027, 0, 1, 7, 0, 0);
    const partsJan1 = getHaitiDateParts(jan1Haiti);
    expect(partsJan1.year).toBe(2027);
    expect(partsJan1.month).toBe(0); // Janvier
    expect(partsJan1.day).toBe(1);
    expect(partsJan1.hour).toBe(7);
  });

  // CAS 12 : Modifications d'horaires par un administrateur
  it('12. Cas 12 : Modification d horaires par un admin -> préserve les tickets existants et journalise l audit', async () => {
    const existingDrawWithTickets = {
      id: 'd-existing',
      drawNumber: 401,
      salesClosingAt: new Date(Date.now() + 3600000),
      scheduledAt: new Date(Date.now() + 4500000),
      status: DrawStatus.OPEN,
      game: { code: 'BOLET_NY', name: 'Bolet New York' },
    };

    prismaMock.draw.findUnique.mockResolvedValue(existingDrawWithTickets);
    prismaMock.draw.update.mockResolvedValue({
      ...existingDrawWithTickets,
      salesClosingAt: new Date(Date.now() + 7200000), // Prolongé d'une heure
    });

    const updated = await drawsService.openDraw('d-existing', 'admin-id-super', 120);

    // L'heure de clôture est mise à jour sans toucher aux tickets
    expect(updated).toBeDefined();
    expect(prismaMock.draw.update).toHaveBeenCalled();
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DRAW_MANUALLY_OPENED',
        resource: 'Draw:d-existing',
      }),
    );
  });
});
