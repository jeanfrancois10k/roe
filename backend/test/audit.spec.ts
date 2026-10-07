import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/modules/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('AuditService (Traçabilité & Journalisation Immuable)', () => {
  let auditService: AuditService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      auditLog: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    auditService = module.get<AuditService>(AuditService);
  });

  it('doit enregistrer un événement avec payloads diff', async () => {
    prismaMock.auditLog.create.mockResolvedValue({ id: 'log-1' });

    await auditService.log({
      userId: 'admin-1',
      action: 'VENDOR_SUSPENDED',
      resource: 'Vendor:v-1',
      oldPayload: { status: 'ACTIVE' },
      newPayload: { status: 'SUSPENDED' },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'VENDOR_SUSPENDED',
        resource: 'Vendor:v-1',
        oldPayload: { status: 'ACTIVE' },
        newPayload: { status: 'SUSPENDED' },
      }),
    });
  });

  it('doit filtrer les journaux d’audit par action et pagination', async () => {
    prismaMock.auditLog.count.mockResolvedValue(1);
    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        action: 'VENDOR_SUSPENDED',
        user: { username: 'superadmin' },
      },
    ]);

    const res = await auditService.findAll({ action: 'VENDOR_SUSPENDED', page: 1, limit: 10 });

    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: 'VENDOR_SUSPENDED' }),
      }),
    );
  });

  it('doit lever NotFoundException si le journal d’audit n’existe pas', async () => {
    prismaMock.auditLog.findUnique.mockResolvedValue(null);

    await expect(auditService.findById('unknown-id')).rejects.toThrow(NotFoundException);
  });
});
