import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from '../src/modules/transactions/transactions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { TransactionType, Role } from '@prisma/client';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('TransactionsService (Grand Livre Immutable & Réconciliation)', () => {
  let transactionsService: TransactionsService;
  let prismaMock: any;
  let auditMock: any;

  beforeEach(async () => {
    prismaMock = {
      vendor: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    auditMock = {
      log: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    transactionsService = module.get<TransactionsService>(TransactionsService);
  });

  describe('deposit (Rechargement de solde)', () => {
    it('doit créditer le solde et créer une entrée DEPOSIT immutable dans le Grand Livre', async () => {
      prismaMock.$queryRaw.mockResolvedValue([
        { id: 'v-1', currentBalance: '150.00', vendorCode: 'VND-001' },
      ]);
      prismaMock.vendor.update.mockResolvedValue({
        id: 'v-1',
        vendorCode: 'VND-001',
        currentBalance: '250.00',
      });
      prismaMock.transaction.create.mockResolvedValue({
        id: 'tx-1',
        vendorId: 'v-1',
        type: TransactionType.DEPOSIT,
        amount: '100.00',
        balanceBefore: '150.00',
        balanceAfter: '250.00',
        reference: 'DEP-TEST-1',
        description: 'Dépôt cash agence',
      });

      const res = await transactionsService.deposit(
        {
          vendorId: 'v-1',
          amount: 100,
          description: 'Dépôt cash agence',
          reference: 'DEP-TEST-1',
        },
        'admin-operator-1',
      );

      expect(res.success).toBe(true);
      expect(res.vendor.currentBalance).toBe(250);
      expect(res.transaction.amount).toBe(100);
      expect(res.transaction.balanceBefore).toBe(150);
      expect(res.transaction.balanceAfter).toBe(250);
      expect(prismaMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: TransactionType.DEPOSIT,
            amount: 100,
          }),
        }),
      );
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'VENDOR_DEPOSIT',
          userId: 'admin-operator-1',
        }),
      );
    });
  });

  describe('withdraw (Retrait de fonds)', () => {
    it('doit débiter le solde si les fonds disponibles sont suffisants', async () => {
      prismaMock.$queryRaw.mockResolvedValue([
        { id: 'v-1', currentBalance: '200.00', creditLimit: '50.00', vendorCode: 'VND-001' },
      ]);
      prismaMock.vendor.update.mockResolvedValue({
        id: 'v-1',
        vendorCode: 'VND-001',
        currentBalance: '80.00',
      });
      prismaMock.transaction.create.mockResolvedValue({
        id: 'tx-2',
        vendorId: 'v-1',
        type: TransactionType.WITHDRAWAL,
        amount: '-120.00',
        balanceBefore: '200.00',
        balanceAfter: '80.00',
        reference: 'WTH-TEST-1',
        description: 'Retrait gains',
      });

      const res = await transactionsService.withdraw(
        {
          vendorId: 'v-1',
          amount: 120,
          description: 'Retrait gains',
          reference: 'WTH-TEST-1',
        },
        'admin-operator-1',
      );

      expect(res.success).toBe(true);
      expect(res.vendor.currentBalance).toBe(80);
      expect(res.transaction.amount).toBe(-120);
      expect(prismaMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: TransactionType.WITHDRAWAL,
            amount: -120,
          }),
        }),
      );
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'VENDOR_WITHDRAWAL' }),
      );
    });

    it('doit rejeter le retrait si le solde disponible (avec découvert) est insuffisant', async () => {
      prismaMock.$queryRaw.mockResolvedValue([
        { id: 'v-1', currentBalance: '50.00', creditLimit: '20.00', vendorCode: 'VND-001' },
      ]);

      // Demande de 100 alors que le solde disponible est de 70 (50 + 20)
      await expect(
        transactionsService.withdraw(
          {
            vendorId: 'v-1',
            amount: 100,
            description: 'Retrait impossible',
          },
          'admin-operator-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll (Isolation & Traçabilité multi-vendeurs)', () => {
    it('doit forcer le filtre sur son propre profil si l’utilisateur a le rôle VENDOR', async () => {
      prismaMock.transaction.count.mockResolvedValue(1);
      prismaMock.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          amount: '50.00',
          balanceBefore: '100.00',
          balanceAfter: '150.00',
          vendor: { id: 'v-vendor-own' },
        },
      ]);

      const vendorUser = {
        id: 'u-vendor',
        role: Role.VENDOR,
        vendor: { id: 'v-vendor-own' },
      };

      const res = await transactionsService.findAll({ vendorId: 'v-other-hack' }, vendorUser);

      expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ vendorId: 'v-vendor-own' }),
        }),
      );
    });
  });

  describe('reconcileVendorLedger (Vérification mathématique du Grand Livre)', () => {
    it('doit valider la réconciliation quand la somme des écritures égale le solde courant', async () => {
      prismaMock.vendor.findUnique.mockResolvedValue({
        id: 'v-1',
        vendorCode: 'VND-001',
        fullName: 'Pierre Jean',
        currentBalance: '450.00',
      });

      prismaMock.transaction.groupBy.mockResolvedValue([
        { type: TransactionType.DEPOSIT, _sum: { amount: '500.00' }, _count: { id: 2 } },
        { type: TransactionType.SALE, _sum: { amount: '-100.00' }, _count: { id: 5 } },
        { type: TransactionType.COMMISSION, _sum: { amount: '50.00' }, _count: { id: 5 } },
      ]);

      prismaMock.transaction.aggregate.mockResolvedValue({
        _sum: { amount: '450.00' },
        _count: { id: 12 },
      });

      const auditReport = await transactionsService.reconcileVendorLedger('v-1');

      expect(auditReport.currentBalance).toBe(450.0);
      expect(auditReport.ledgerSum).toBe(450.0);
      expect(auditReport.discrepancy).toBe(0.0);
      expect(auditReport.isBalanced).toBe(true);
      expect(auditReport.status).toBe('RECONCILED');
      expect(auditReport.breakdown).toHaveLength(3);
    });

    it('doit détecter une divergence si le solde courant ne correspond pas au Grand Livre', async () => {
      prismaMock.vendor.findUnique.mockResolvedValue({
        id: 'v-1',
        vendorCode: 'VND-001',
        fullName: 'Pierre Jean',
        currentBalance: '500.00', // Altération illégale manuelle suspectée
      });

      prismaMock.transaction.groupBy.mockResolvedValue([]);
      prismaMock.transaction.aggregate.mockResolvedValue({
        _sum: { amount: '450.00' }, // Somme réelle des transactions
        _count: { id: 10 },
      });

      const auditReport = await transactionsService.reconcileVendorLedger('v-1');

      expect(auditReport.discrepancy).toBe(50.0);
      expect(auditReport.isBalanced).toBe(false);
      expect(auditReport.status).toBe('DISCREPANCY_DETECTED');
    });
  });
});
