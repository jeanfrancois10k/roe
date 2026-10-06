import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../src/modules/audit/audit.service';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Role, VendorStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('AuthService (Tests Unitaires & Sécurité)', () => {
  let authService: AuthService;
  let prismaService: any;
  let jwtService: any;

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      vendor: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      device: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mocked.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_ACCESS_SECRET') return 'secret';
              if (key === 'JWT_REFRESH_SECRET') return 'refresh_secret';
              return null;
            }),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('doit être défini', () => {
    expect(authService).toBeDefined();
  });

  describe('login()', () => {
    it('doit rejeter un utilisateur inexistant avec UnauthorizedException', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ username: 'nonexistent', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('doit rejeter un mot de passe incorrect avec UnauthorizedException', async () => {
      const hash = await bcrypt.hash('correctPassword', 10);
      prismaService.user.findUnique.mockResolvedValue({
        id: 'u1',
        username: 'admin',
        passwordHash: hash,
        isActive: true,
        role: Role.ADMIN,
      });

      await expect(
        authService.login({ username: 'admin', password: 'wrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('doit bloquer immédiatement un vendeur dont le compte est SUSPENDED (Kill Switch)', async () => {
      const hash = await bcrypt.hash('secret123', 10);
      prismaService.user.findUnique.mockResolvedValue({
        id: 'u-vend',
        username: 'vendeur01',
        passwordHash: hash,
        isActive: true,
        role: Role.VENDOR,
        vendorProfile: {
          id: 'v-1',
          vendorCode: 'VEND-001',
          status: VendorStatus.SUSPENDED,
        },
      });

      await expect(
        authService.login({ username: 'vendeur01', password: 'secret123' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('doit authentifier avec succès un administrateur et retourner des tokens', async () => {
      const hash = await bcrypt.hash('ValidSecret2026!', 10);
      prismaService.user.findUnique.mockResolvedValue({
        id: 'u-admin-1',
        username: 'superadmin',
        email: 'admin@roebolet.com',
        passwordHash: hash,
        isActive: true,
        role: Role.SUPER_ADMIN,
        vendorProfile: null,
      });

      const res = await authService.login({
        username: 'superadmin',
        password: 'ValidSecret2026!',
      });

      expect(res).toBeDefined();
      expect(res.accessToken).toBe('mocked.jwt.token');
      expect(res.refreshToken).toBeDefined();
      expect(res.user.role).toBe(Role.SUPER_ADMIN);
    });
  });
});
