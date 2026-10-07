import { Test, TestingModule } from '@nestjs/testing';
import { CommissionsService } from '../src/modules/commissions/commissions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { CommissionType, Role } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('CommissionsService (Moteur de Calcul & Règles Dynamiques)', () => {
  let commissionsService: CommissionsService;
  let prismaMock: any;
  let auditMock: any;

  beforeEach(async () => {
    prismaMock = {
      vendor: {
        findUnique: jest.fn(),
      },
      game: {
        findUnique: jest.fn(),
      },
      commission: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };

    auditMock = {
      log: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    commissionsService = module.get<CommissionsService>(CommissionsService);
  });

  describe('setRule', () => {
    it('doit créer ou mettre à jour une règle de commission spécifique et journaliser l’audit', async () => {
      prismaMock.vendor.findUnique.mockResolvedValue({ id: 'v-1', vendorCode: 'VND-001' });
      prismaMock.game.findUnique.mockResolvedValue({ id: 'g-1', code: 'BOLET_NY' });
      prismaMock.commission.upsert.mockResolvedValue({
        id: 'c-1',
        vendorId: 'v-1',
        gameId: 'g-1',
        rateType: CommissionType.PERCENTAGE,
        rateValue: '8.50',
        game: { code: 'BOLET_NY', name: 'New York Bolet' },
        vendor: { vendorCode: 'VND-001', fullName: 'Pierre Jean' },
      });

      const res = await commissionsService.setRule(
        {
          vendorId: 'v-1',
          gameId: 'g-1',
          rateType: CommissionType.PERCENTAGE,
          rateValue: 8.5,
        },
        'admin-1',
      );

      expect(res.rateValue).toBe(8.5);
      expect(prismaMock.commission.upsert).toHaveBeenCalled();
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMMISSION_RULE_SET',
          userId: 'admin-1',
        }),
      );
    });

    it('doit lever NotFoundException si le vendeur ou le jeu n’existe pas', async () => {
      prismaMock.vendor.findUnique.mockResolvedValue(null);
      prismaMock.game.findUnique.mockResolvedValue({ id: 'g-1' });

      await expect(
        commissionsService.setRule(
          {
            vendorId: 'v-invalid',
            gameId: 'g-1',
            rateType: CommissionType.PERCENTAGE,
            rateValue: 10,
          },
          'admin-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('calculateCommission', () => {
    it('doit appliquer la règle PERCENTAGE personnalisée lorsqu’elle existe', async () => {
      prismaMock.commission.findUnique.mockResolvedValue({
        vendorId: 'v-1',
        gameId: 'g-1',
        rateType: CommissionType.PERCENTAGE,
        rateValue: '8.00',
      });

      const res = await commissionsService.calculateCommission('v-1', 'g-1', 100, 2);

      expect(res.commissionAmount).toBe(8.0);
      expect(res.rateType).toBe(CommissionType.PERCENTAGE);
      expect(res.rateValue).toBe(8);
    });

    it('doit appliquer la règle FIXED_PER_TICKET personnalisée', async () => {
      prismaMock.commission.findUnique.mockResolvedValue({
        vendorId: 'v-1',
        gameId: 'g-1',
        rateType: CommissionType.FIXED_PER_TICKET,
        rateValue: '0.75',
      });

      // 4 tickets joués * 0.75 = 3.00
      const res = await commissionsService.calculateCommission('v-1', 'g-1', 100, 4);

      expect(res.commissionAmount).toBe(3.0);
      expect(res.rateType).toBe(CommissionType.FIXED_PER_TICKET);
      expect(res.rateValue).toBe(0.75);
    });

    it('doit se rabattre sur le taux par défaut du jeu si aucune règle personnalisée', async () => {
      prismaMock.commission.findUnique.mockResolvedValue(null);
      prismaMock.game.findUnique.mockResolvedValue({ defaultCommission: '6.00' });
      prismaMock.vendor.findUnique.mockResolvedValue({ defaultCommissionRate: '5.00' });

      const res = await commissionsService.calculateCommission('v-1', 'g-1', 200, 1);

      // 200 * 6% = 12.00
      expect(res.commissionAmount).toBe(12.0);
      expect(res.rateValue).toBe(6.0);
    });

    it('doit se rabattre sur le taux par défaut du vendeur si le jeu n’a pas de taux', async () => {
      prismaMock.commission.findUnique.mockResolvedValue(null);
      prismaMock.game.findUnique.mockResolvedValue({ defaultCommission: null });
      prismaMock.vendor.findUnique.mockResolvedValue({ defaultCommissionRate: '7.50' });

      const res = await commissionsService.calculateCommission('v-1', 'g-1', 100, 1);

      // 100 * 7.5% = 7.50
      expect(res.commissionAmount).toBe(7.5);
      expect(res.rateValue).toBe(7.5);
    });
  });

  describe('deleteRule', () => {
    it('doit supprimer une règle personnalisée existante', async () => {
      prismaMock.commission.findUnique.mockResolvedValue({
        id: 'c-1',
        vendorId: 'v-1',
        gameId: 'g-1',
      });
      prismaMock.commission.delete.mockResolvedValue({ id: 'c-1' });

      const res = await commissionsService.deleteRule('v-1', 'g-1', 'admin-1');

      expect(res.success).toBe(true);
      expect(prismaMock.commission.delete).toHaveBeenCalledWith({ where: { id: 'c-1' } });
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'COMMISSION_RULE_DELETED' }),
      );
    });
  });
});
