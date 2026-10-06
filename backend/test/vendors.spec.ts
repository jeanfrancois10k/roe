import { Test, TestingModule } from '@nestjs/testing';
import { VendorsService } from '../src/modules/vendors/vendors.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { RealtimeGateway } from '../src/modules/realtime/realtime.gateway';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VendorStatus, Role } from '@prisma/client';

describe('VendorsService (Gestion Vendeurs & Contrôle à Distance)', () => {
  let vendorsService: VendorsService;
  let prismaMock: any;
  let realtimeGatewayMock: any;
  let auditMock: any;

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      vendor: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      device: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      ticket: {
        aggregate: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    realtimeGatewayMock = {
      notifyVendorSuspension: jest.fn(),
      notifyVendorReactivation: jest.fn(),
      broadcastToAdmins: jest.fn(),
    };

    auditMock = {
      log: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RealtimeGateway, useValue: realtimeGatewayMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    vendorsService = module.get<VendorsService>(VendorsService);
  });

  describe('createVendor()', () => {
    it('doit rejeter si le nom d’utilisateur existe déjà', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', username: 'existing' });

      await expect(
        vendorsService.createVendor({
          fullName: 'Test Vendor',
          phone: '+509 1111 2222',
          posAddress: 'Rue 1',
          username: 'existing',
          password: 'Password123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('doit créer un vendeur avec un vendorCode automatique et solde initial dans le Ledger', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.vendor.findUnique.mockResolvedValue(null);
      prismaMock.vendor.count.mockResolvedValue(2);

      prismaMock.user.create.mockResolvedValue({
        id: 'u-new',
        username: 'vendeur03',
        role: Role.VENDOR,
      });

      prismaMock.vendor.create.mockResolvedValue({
        id: 'v-new',
        userId: 'u-new',
        vendorCode: 'VEND-003',
        fullName: 'Marc Vendeur',
        phone: '+509 3333 4444',
        posAddress: 'Avenue Liberté',
        currentBalance: 500.0,
        status: VendorStatus.ACTIVE,
      });

      const result = await vendorsService.createVendor(
        {
          fullName: 'Marc Vendeur',
          phone: '+509 3333 4444',
          posAddress: 'Avenue Liberté',
          username: 'vendeur03',
          password: 'VendorSecret2026!',
          pin: '5678',
          initialBalance: 500.0,
        },
        'admin-id',
      );

      expect(result).toBeDefined();
      expect(result.vendorCode).toBe('VEND-003');
      expect(prismaMock.transaction.create).toHaveBeenCalled();
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'VENDOR_CREATED' }),
      );
    });
  });

  describe('suspendVendor() - Kill Switch', () => {
    it('doit suspendre le vendeur, révoquer les sessions et émettre l’ordre WebSocket', async () => {
      prismaMock.vendor.findUnique.mockResolvedValue({
        id: 'v-100',
        userId: 'u-100',
        vendorCode: 'VEND-100',
        status: VendorStatus.ACTIVE,
      });

      prismaMock.vendor.update.mockResolvedValue({
        id: 'v-100',
        status: VendorStatus.SUSPENDED,
      });

      const res = await vendorsService.suspendVendor('v-100', 'admin-id', 'Fraude suspectée');

      expect(res.success).toBe(true);
      expect(prismaMock.vendor.update).toHaveBeenCalledWith({
        where: { id: 'v-100' },
        data: { status: VendorStatus.SUSPENDED },
      });
      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u-100', revokedAt: null },
        data: expect.any(Object),
      });
      expect(realtimeGatewayMock.notifyVendorSuspension).toHaveBeenCalledWith(
        'v-100',
        'Fraude suspectée',
      );
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'VENDOR_SUSPENDED' }),
      );
    });
  });

  describe('adjustBalance() - Ledger Transactionnel', () => {
    it('doit refuser un débit qui dépasse le découvert autorisé', async () => {
      prismaMock.vendor.findUnique.mockResolvedValue({
        id: 'v-100',
        currentBalance: 50,
        creditLimit: 100, // Découvert max de 100
      });

      await expect(
        vendorsService.adjustBalance(
          'v-100',
          { amount: -200, reason: 'Pénalité' }, // 50 - 200 = -150 (dépasse -100)
          'admin-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('doit enregistrer une régularisation valide dans le grand livre', async () => {
      prismaMock.vendor.findUnique.mockResolvedValue({
        id: 'v-100',
        currentBalance: 100,
        creditLimit: 0,
      });

      prismaMock.vendor.update.mockResolvedValue({
        id: 'v-100',
        currentBalance: 300,
      });

      prismaMock.transaction.create.mockResolvedValue({
        id: 'tx-adj',
        amount: 200,
        balanceBefore: 100,
        balanceAfter: 300,
      });

      const res = await vendorsService.adjustBalance(
        'v-100',
        { amount: 200, reason: 'Bonus performance' },
        'admin-id',
      );

      expect(res.success).toBe(true);
      expect(prismaMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 200,
            balanceBefore: 100,
            balanceAfter: 300,
          }),
        }),
      );
    });
  });
});
