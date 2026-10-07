import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from '../src/modules/tickets/tickets.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { VendorStatus, DeviceStatus, DrawStatus, TicketStatus, TicketPayoutStatus, TransactionType } from '@prisma/client';

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
      device: {
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

  describe('verifyTicket (Vérification QR Code / Numéro de Ticket)', () => {
    it('doit identifier un ticket gagnant non payé (WINNER)', async () => {
      const mockTicket = {
        id: 't-win',
        ticketNumber: 'ROE-20261006-WIN1',
        totalAmount: 10,
        wonAmount: 500,
        isWinner: true,
        payoutStatus: TicketPayoutStatus.UNPAID,
        status: TicketStatus.CONFIRMED,
        expiresAt: new Date(Date.now() + 80 * 24 * 60 * 60 * 1000), // Dans 80j
        drawId: 'd-1',
        game: { id: 'g-1', code: 'BOLET_NY', name: 'Bolet NY' },
        draw: {
          id: 'd-1',
          drawNumber: 101,
          status: DrawStatus.PUBLISHED,
          scheduledAt: new Date(),
          publishedAt: new Date(),
          winningResults: { firstPrize: '512', secondPrize: '34', thirdPrize: '78' },
        },
        vendor: { id: 'v-1', vendorCode: 'VND-001', fullName: 'Pierre', posAddress: 'PV-01' },
      };

      prismaMock.ticket.findUnique.mockResolvedValue(mockTicket);

      const res = await ticketsService.verifyTicket({ query: 'ROE-20261006-WIN1' });

      expect(res.statusKey).toBe('WINNER');
      expect(res.statusLabel).toBe('TICKET GAGNANT !');
      expect(res.canBePaid).toBe(true);
      expect(res.wonAmount).toBe(500);
    });

    it('doit identifier un ticket déjà payé (ALREADY_PAID) et empêcher le paiement', async () => {
      const mockTicket = {
        id: 't-paid',
        ticketNumber: 'ROE-20261006-PAID1',
        totalAmount: 10,
        wonAmount: 500,
        isWinner: true,
        payoutStatus: TicketPayoutStatus.PAID,
        paidAt: new Date(),
        paidByVendorId: 'v-1',
        status: TicketStatus.CONFIRMED,
        expiresAt: new Date(Date.now() + 80 * 24 * 60 * 60 * 1000),
        drawId: 'd-1',
        game: { code: 'BOLET_NY', name: 'Bolet NY' },
        draw: { status: DrawStatus.PUBLISHED },
        vendor: { id: 'v-1', vendorCode: 'VND-001' },
      };

      prismaMock.ticket.findUnique.mockResolvedValue(mockTicket);

      const res = await ticketsService.verifyTicket({ query: 'ROE-20261006-PAID1' });

      expect(res.statusKey).toBe('ALREADY_PAID');
      expect(res.statusLabel).toBe('TICKET DÉJÀ PAYÉ');
      expect(res.canBePaid).toBe(false);
    });

    it('doit identifier un tirage non encore publié (PENDING_DRAW)', async () => {
      const mockTicket = {
        id: 't-pending',
        ticketNumber: 'ROE-20261006-PEND1',
        totalAmount: 10,
        wonAmount: 0,
        isWinner: false,
        payoutStatus: TicketPayoutStatus.UNPAID,
        status: TicketStatus.CONFIRMED,
        expiresAt: new Date(Date.now() + 80 * 24 * 60 * 60 * 1000),
        drawId: 'd-1',
        game: { code: 'BOLET_NY', name: 'Bolet NY' },
        draw: { status: DrawStatus.OPEN },
        vendor: { id: 'v-1', vendorCode: 'VND-001' },
      };

      prismaMock.ticket.findUnique.mockResolvedValue(mockTicket);

      const res = await ticketsService.verifyTicket({ query: 'ROE-20261006-PEND1' });

      expect(res.statusKey).toBe('PENDING_DRAW');
      expect(res.canBePaid).toBe(false);
    });
  });

  describe('payTicketPrize (Anti-Double Paiement & Écriture Ledger)', () => {
    it('doit créditer le vendeur, créer une écriture PRIZE_PAYOUT et sceller le ticket en PAID', async () => {
      prismaMock.vendor.findUnique.mockResolvedValue({
        id: 'v-1',
        status: VendorStatus.ACTIVE,
      });
      prismaMock.device.findUnique.mockResolvedValue({
        id: 'dev-1',
        deviceUuid: 'DEV-POS-1',
        vendorId: 'v-1',
        status: DeviceStatus.AUTHORIZED,
      });

      const futureDate = new Date(Date.now() + 80 * 24 * 60 * 60 * 1000);
      prismaMock.$queryRaw
        // 1er appel : SELECT ... FROM Ticket FOR UPDATE
        .mockResolvedValueOnce([
          {
            id: 't-win',
            ticketNumber: 'ROE-20261006-WIN1',
            status: TicketStatus.CONFIRMED,
            isWinner: true,
            wonAmount: '500.00',
            payoutStatus: TicketPayoutStatus.UNPAID,
            expiresAt: futureDate,
            drawId: 'd-1',
          },
        ])
        // 2e appel : SELECT ... FROM Vendor FOR UPDATE
        .mockResolvedValueOnce([
          {
            id: 'v-1',
            currentBalance: '1000.00',
            vendorCode: 'VND-001',
          },
        ]);

      prismaMock.vendor.update.mockResolvedValue({
        id: 'v-1',
        currentBalance: 1500,
      });
      prismaMock.transaction.create.mockResolvedValue({ id: 'tx-prize-1' });
      prismaMock.ticket.update.mockResolvedValue({
        id: 't-win',
        ticketNumber: 'ROE-20261006-WIN1',
        payoutStatus: TicketPayoutStatus.PAID,
        paidAt: new Date(),
        game: { name: 'Bolet NY', code: 'BOLET_NY' },
        draw: { drawNumber: 101 },
      });

      const res = await ticketsService.payTicketPrize(
        { ticketId: 't-win', deviceUuid: 'DEV-POS-1' },
        'v-1',
        'u-operator-1',
      );

      expect(res.success).toBe(true);
      expect(res.vendor.newBalance).toBe(1500);
      expect(prismaMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: TransactionType.PRIZE_PAYOUT,
            amount: 500,
            balanceBefore: 1000,
            balanceAfter: 1500,
          }),
        }),
      );
      expect(prismaMock.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payoutStatus: TicketPayoutStatus.PAID,
            paidByVendorId: 'v-1',
          }),
        }),
      );
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TICKET_PRIZE_PAID',
          userId: 'u-operator-1',
        }),
      );
    });

    it('doit bloquer immédiatement tout double paiement (ticket déjà PAID)', async () => {
      prismaMock.vendor.findUnique.mockResolvedValue({
        id: 'v-1',
        status: VendorStatus.ACTIVE,
      });
      prismaMock.device.findUnique.mockResolvedValue({
        id: 'dev-1',
        deviceUuid: 'DEV-POS-1',
        vendorId: 'v-1',
        status: DeviceStatus.AUTHORIZED,
      });

      prismaMock.$queryRaw.mockResolvedValueOnce([
        {
          id: 't-already-paid',
          ticketNumber: 'ROE-PAID',
          payoutStatus: TicketPayoutStatus.PAID, // DÉJÀ PAYÉ
          isWinner: true,
          wonAmount: '500.00',
        },
      ]);

      await expect(
        ticketsService.payTicketPrize(
          { ticketId: 't-already-paid', deviceUuid: 'DEV-POS-1' },
          'v-1',
          'u-operator-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

