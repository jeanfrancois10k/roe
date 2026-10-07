import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from '../src/modules/tickets/tickets.service';
import { DrawsService } from '../src/modules/draws/draws.service';
import { DrawEvaluatorService } from '../src/modules/draws/draw-evaluator.service';
import { TransactionsService } from '../src/modules/transactions/transactions.service';
import { CommissionsService } from '../src/modules/commissions/commissions.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RealtimeGateway } from '../src/modules/realtime/realtime.gateway';
import { ConfigService } from '@nestjs/config';
import {
  VendorStatus,
  DeviceStatus,
  DrawStatus,
  TicketStatus,
  TicketPayoutStatus,
  TransactionType,
  CommissionType,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('Phase 11: E2E Full Lottery Lifecycle Simulation (De la vente au paiement sécurisé et réconciliation)', () => {
  let ticketsService: TicketsService;
  let drawsService: DrawsService;
  let transactionsService: TransactionsService;
  let commissionsService: CommissionsService;
  let evaluatorService: DrawEvaluatorService;
  let auditService: AuditService;

  // Données de simulation en mémoire pour le cycle de vie E2E complet
  let currentVendorBalance = 1000.0;
  const ledgerTransactions: any[] = [
    {
      id: 'tx-init-deposit',
      type: TransactionType.DEPOSIT,
      amount: 1000.0,
      balanceBefore: 0.0,
      balanceAfter: 1000.0,
      reference: 'DEP-INITIAL-SEED',
    },
  ];
  let storedTicket: any = null;
  let storedDraw: any = null;
  const auditEntries: any[] = [];

  let prismaMock: any;
  let realtimeMock: any;

  beforeAll(async () => {
    // Jeu BOLET NY avec règles officielles
    const mockGame = {
      id: 'game-ny-uuid',
      code: 'BOLET_NY',
      name: 'Bolet New York Officiel',
      status: 'ACTIVE',
      minBetAmount: 1.0,
      maxBetAmount: 500.0,
      defaultCommission: 5.0,
      gameRules: {
        multipliers: {
          firstPrize: 50,
          secondPrize: 20,
          thirdPrize: 10,
          mariage: 1000,
          lot3: 500,
        },
      },
    };

    // Tirage initial ouvert
    storedDraw = {
      id: 'draw-101-uuid',
      drawNumber: 101,
      gameId: mockGame.id,
      game: mockGame,
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // Dans 2h
      salesClosingAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // Dans 1h
      status: DrawStatus.OPEN,
      winningResults: null,
      validationHash: null,
    };

    const mockDevice = {
      id: 'device-pos-uuid',
      deviceUuid: 'ANDROID-POS-001',
      vendorId: 'vendor-pilot-uuid',
      status: DeviceStatus.AUTHORIZED,
    };

    // Vendeur pilote
    const mockVendor = {
      id: 'vendor-pilot-uuid',
      vendorCode: 'VEND-001',
      fullName: 'Jean-Baptiste Vendeur',
      posAddress: 'PV-01 Centre Ville',
      status: VendorStatus.ACTIVE,
      currentBalance: currentVendorBalance,
      creditLimit: 500.0,
      dailySalesLimit: 5000.0,
      maxTicketAmount: 500.0,
      defaultCommissionRate: 5.0,
      devices: [mockDevice],
    };

    prismaMock = {
      vendor: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve({
          ...mockVendor,
          devices: [mockDevice],
          currentBalance: currentVendorBalance,
        })),
        update: jest.fn().mockImplementation(({ data }) => {
          if (data.currentBalance !== undefined) {
            currentVendorBalance = Number(data.currentBalance);
          }
          return Promise.resolve({ ...mockVendor, devices: [mockDevice], currentBalance: currentVendorBalance });
        }),
      },
      device: {
        findUnique: jest.fn().mockResolvedValue(mockDevice),
        update: jest.fn().mockResolvedValue(mockDevice),
      },
      game: {
        findUnique: jest.fn().mockResolvedValue(mockGame),
        findMany: jest.fn().mockResolvedValue([mockGame]),
      },
      draw: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(storedDraw)),
        update: jest.fn().mockImplementation(({ data }) => {
          storedDraw = { ...storedDraw, ...data };
          return Promise.resolve(storedDraw);
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve([storedDraw])),
      },
      ticket: {
        create: jest.fn().mockImplementation(({ data }) => {
          storedTicket = {
            id: 'ticket-created-uuid',
            ...data,
            game: mockGame,
            draw: storedDraw,
            vendor: mockVendor,
            createdAt: new Date(),
          };
          return Promise.resolve(storedTicket);
        }),
        findUnique: jest.fn().mockImplementation(() =>
          Promise.resolve(
            storedTicket
              ? {
                  ...storedTicket,
                  draw: storedDraw,
                  game: mockGame,
                  vendor: mockVendor,
                }
              : null,
          ),
        ),
        findMany: jest.fn().mockImplementation(() =>
          Promise.resolve(
            storedTicket
              ? [
                  {
                    ...storedTicket,
                    draw: storedDraw,
                    game: mockGame,
                    vendor: mockVendor,
                  },
                ]
              : [],
          ),
        ),
        update: jest.fn().mockImplementation(({ data }) => {
          storedTicket = { ...storedTicket, ...data };
          return Promise.resolve({
            ...storedTicket,
            draw: storedDraw,
            game: mockGame,
            vendor: mockVendor,
          });
        }),
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: 0 } }),
        count: jest.fn().mockResolvedValue(0),
      },
      transaction: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const found = ledgerTransactions.find((t) => t.reference === where.reference);
          return Promise.resolve(found || null);
        }),
        create: jest.fn().mockImplementation(({ data }) => {
          const newTx = { id: `tx-${Date.now()}-${Math.random()}`, ...data };
          ledgerTransactions.push(newTx);
          return Promise.resolve(newTx);
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(ledgerTransactions)),
        aggregate: jest.fn().mockImplementation(() => {
          const sum = ledgerTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
          return Promise.resolve({
            _sum: { amount: sum },
            _count: { id: ledgerTransactions.length },
          });
        }),
        groupBy: jest.fn().mockImplementation(() => {
          return Promise.resolve([
            { type: TransactionType.DEPOSIT, _sum: { amount: 1000.0 }, _count: { id: 1 } },
          ]);
        }),
      },
      commission: {
        findUnique: jest.fn().mockResolvedValue(null), // Utilise le taux par défaut du jeu (5%)
      },
      auditLog: {
        create: jest.fn().mockImplementation(({ data }) => {
          auditEntries.push(data);
          return Promise.resolve({ id: `audit-${Date.now()}`, ...data });
        }),
      },
      $queryRaw: jest.fn().mockImplementation(() => {
        // Renvoie l'état courant verrouillé
        return Promise.resolve([
          {
            id: mockVendor.id,
            currentBalance: currentVendorBalance,
            creditLimit: 500.0,
            vendorCode: 'VEND-001',
            status: storedTicket?.status,
            isWinner: storedTicket?.isWinner,
            wonAmount: storedTicket?.wonAmount,
            payoutStatus: storedTicket?.payoutStatus,
            expiresAt: storedTicket?.expiresAt,
            drawId: storedTicket?.drawId,
            ticketNumber: storedTicket?.ticketNumber,
          },
        ]);
      }),
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    realtimeMock = {
      server: {
        emit: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        DrawsService,
        DrawEvaluatorService,
        TransactionsService,
        CommissionsService,
        AuditService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RealtimeGateway, useValue: realtimeMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'HMAC_TICKET_SECRET') return 'secret_ticket_e2e';
              if (key === 'DRAW_VALIDATION_SECRET') return 'secret_draw_e2e';
              if (key === 'CANCELLATION_WINDOW_MINUTES') return 5;
              return null;
            }),
          },
        },
      ],
    }).compile();

    ticketsService = module.get<TicketsService>(TicketsService);
    drawsService = module.get<DrawsService>(DrawsService);
    transactionsService = module.get<TransactionsService>(TransactionsService);
    commissionsService = module.get<CommissionsService>(CommissionsService);
    evaluatorService = module.get<DrawEvaluatorService>(DrawEvaluatorService);
    auditService = module.get<AuditService>(AuditService);
  });

  // =========================================================================
  // ÉTAPE 1 : ÉMISSION D'UN TICKET COMBINÉ MULTI-GRILLES
  // =========================================================================
  it('ÉTAPE 1 : Vente d’un ticket multi-grilles avec débits et commissions atomiques', async () => {
    const sellDto = {
      gameId: storedDraw.gameId,
      drawId: storedDraw.id,
      deviceUuid: 'ANDROID-POS-001',
      idempotencyKey: 'E2E-SALE-TX-001',
      grids: [
        { numbers: ['12'], betAmount: 10.0 }, // Grille 1 : Borlette 1er lot
        { numbers: ['12', '78'], betAmount: 2.0 }, // Grille 2 : Mariage
        { numbers: ['512'], betAmount: 5.0 }, // Grille 3 : Lòt 3
        { numbers: ['99'], betAmount: 5.0 }, // Grille 4 : Perdante
      ],
    };

    // Montant total : 10 + 2 + 5 + 5 = 22.00 $
    // Commission 5% : 22 * 0.05 = 1.10 $
    const result = await ticketsService.sellTicket(sellDto, 'vendor-pilot-uuid', 'operator-admin-id');

    expect(result.success).toBe(true);
    expect(result.ticket.ticketNumber).toMatch(/^ROE-\d{8}-[A-F0-9]{8}$/);
    expect(result.ticket.totalAmount).toBe(22.0);
    expect(result.ticket.secureChecksum).toBeDefined();

    // Nouveau solde vendeur : 1000.00 - 22.00 + 1.10 = 979.10 $
    expect(currentVendorBalance).toBe(979.1);
    expect(result.ticket.newBalance).toBe(979.1);

    // Vérifier les 2 écritures ledger générées (SALE et COMMISSION)
    const saleTx = ledgerTransactions.find((t) => t.type === TransactionType.SALE);
    const commTx = ledgerTransactions.find((t) => t.type === TransactionType.COMMISSION);

    expect(saleTx).toBeDefined();
    expect(saleTx.amount).toBe(-22.0);
    expect(commTx).toBeDefined();
    expect(commTx.amount).toBe(1.1);

    // Vérification de la journalisation d'audit
    expect(auditEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'TICKET_SOLD' }),
      ]),
    );
  });

  // =========================================================================
  // ÉTAPE 2 : CLÔTURE STRICTE DU TIRAGE
  // =========================================================================
  it('ÉTAPE 2 : Clôture des ventes et rejet strict de toute nouvelle vente après fermeture', async () => {
    // Avancer l'heure pour clôturer les ventes
    storedDraw.salesClosingAt = new Date(Date.now() - 5 * 60 * 1000); // Clôturé il y a 5 min

    const lateSellDto = {
      gameId: storedDraw.gameId,
      drawId: storedDraw.id,
      deviceUuid: 'ANDROID-POS-001',
      idempotencyKey: 'E2E-LATE-SALE-FAIL',
      grids: [{ numbers: ['12'], betAmount: 5.0 }],
    };

    await expect(
      ticketsService.sellTicket(lateSellDto, 'vendor-pilot-uuid', 'operator-admin-id'),
    ).rejects.toThrow(BadRequestException);
  });

  // =========================================================================
  // ÉTAPE 3 : SAISIE DES RÉSULTATS, SCELLEMENT CRYPTOGRAPHIQUE & ÉVALUATION BATCH
  // =========================================================================
  it('ÉTAPE 3 : Saisie administrative, scellement SHA-256 et calcul automatique des gains ($5000)', async () => {
    // Numéros officiels sortis :
    // 1er lot : 512 (Borlette: 12, Lot 3: 512)
    // 2e lot  : 34
    // 3e lot  : 78
    const winningResultsDto = {
      winningResults: {
        firstPrize: '512',
        secondPrize: '34',
        thirdPrize: '78',
      },
      publishImmediately: true,
    };

    const publishRes = await drawsService.setResults(storedDraw.id, winningResultsDto, 'superadmin-id');

    expect(storedDraw.status).toBe(DrawStatus.PUBLISHED);
    expect(storedDraw.validationHash).toBeDefined();
    expect(typeof storedDraw.validationHash).toBe('string');

    // Le ticket doit avoir été évalué :
    // Grille 1 (12) : 10 * 50 = 500 $
    // Grille 2 (12 & 78) : 2 * 1000 = 2000 $
    // Grille 3 (512) : 5 * 500 = 2500 $
    // Grille 4 (99) : 0 $
    // Total gagné : 500 + 2000 + 2500 = 5000.00 $
    expect(storedTicket.isWinner).toBe(true);
    expect(storedTicket.wonAmount).toBe(5000.0);
    expect(storedTicket.payoutStatus).toBe(TicketPayoutStatus.UNPAID);

    expect((publishRes as any).evaluationSummary.totalWinners).toBe(1);
    expect((publishRes as any).evaluationSummary.totalWonAmount).toBe(5000.0);
  });

  // =========================================================================
  // ÉTAPE 4 : VÉRIFICATION DU TICKET DEPUIS LE TERMINAL POS
  // =========================================================================
  it('ÉTAPE 4 : Scan et vérification du ticket gagnant par numéro et checksum HMAC', async () => {
    const verifyRes = await ticketsService.verifyTicket({
      query: storedTicket.ticketNumber,
      checksum: storedTicket.secureChecksum,
    });

    expect(verifyRes.isAuthentic).toBe(true);
    expect(verifyRes.statusKey).toBe('WINNER');
    expect(verifyRes.statusLabel).toBe('TICKET GAGNANT !');
    expect(verifyRes.canBePaid).toBe(true);
    expect(verifyRes.wonAmount).toBe(5000.0);
  });

  // =========================================================================
  // ÉTAPE 5 : PAIEMENT SÉCURISÉ & CONTRÔLE ANTI-DOUBLE PAIEMENT
  // =========================================================================
  it('ÉTAPE 5 : Paiement du gain, crédit du vendeur et blocage de toute tentative de double paiement', async () => {
    const payDto = {
      ticketId: storedTicket.id,
      deviceUuid: 'ANDROID-POS-001',
      idempotencyKey: 'E2E-PAY-TX-001',
    };

    // Le vendeur verse 5000$ cash au client.
    // La maison rembourse son compte : 979.10 + 5000.00 = 5979.10 $
    const payRes = await ticketsService.payTicketPrize(payDto, 'vendor-pilot-uuid', 'operator-admin-id');

    expect(payRes.success).toBe(true);
    expect(payRes.ticket.payoutStatus).toBe(TicketPayoutStatus.PAID);
    expect(currentVendorBalance).toBe(5979.1);
    expect(payRes.vendor.newBalance).toBe(5979.1);

    // Écriture Ledger PRIZE_PAYOUT vérifiée
    const prizeTx = ledgerTransactions.find((t) => t.type === TransactionType.PRIZE_PAYOUT);
    expect(prizeTx).toBeDefined();
    expect(prizeTx.amount).toBe(5000.0);

    // TENTATIVE DE FRAUDE : Second paiement du même ticket
    await expect(
      ticketsService.payTicketPrize(payDto, 'vendor-pilot-uuid', 'operator-admin-id'),
    ).rejects.toThrow(BadRequestException);
  });

  // =========================================================================
  // ÉTAPE 6 : RÉCONCILIATION COMPTABLE DU GRAND LIVRE
  // =========================================================================
  it('ÉTAPE 6 : Réconciliation comptable absolue : Somme du Grand Livre = Solde Actuel', async () => {
    // Calcul de la réconciliation
    const auditReport = await transactionsService.reconcileVendorLedger('vendor-pilot-uuid');

    // 1000 (Dépôt initial) - 22 (Vente) + 1.10 (Commission) + 5000 (Gain remboursé) = 5979.10 $
    expect(auditReport.currentBalance).toBe(5979.1);
    expect(auditReport.ledgerSum).toBe(5979.1);
    expect(auditReport.discrepancy).toBe(0.0);
    expect(auditReport.isBalanced).toBe(true);
    expect(auditReport.status).toBe('RECONCILED');
  });

  // =========================================================================
  // ÉTAPE 7 : TRAÇABILITÉ D'AUDIT COMPLÈTE
  // =========================================================================
  it('ÉTAPE 7 : Vérification de la complétude de la piste d’audit immuable', () => {
    const actionsLogged = auditEntries.map((e) => e.action);

    expect(actionsLogged).toContain('TICKET_SOLD');
    expect(actionsLogged).toContain('DRAW_RESULTS_PUBLISHED');
    expect(actionsLogged).toContain('TICKET_PRIZE_PAID');
  });
});
