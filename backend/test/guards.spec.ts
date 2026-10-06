import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { DeviceBindingGuard } from '../src/modules/auth/guards/device-binding.guard';
import { Role, DeviceStatus } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';

describe('Guards de Sécurité & RBAC', () => {
  describe('RolesGuard', () => {
    let rolesGuard: RolesGuard;
    let reflector: Reflector;

    beforeEach(() => {
      reflector = new Reflector();
      rolesGuard = new RolesGuard(reflector);
    });

    it('doit autoriser l’accès si aucun rôle n’est spécifié', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
      const mockContext: any = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: { role: Role.VENDOR } }),
        }),
      };

      expect(rolesGuard.canActivate(mockContext)).toBe(true);
    });

    it('doit autoriser systématiquement le SUPER_ADMIN', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
      const mockContext: any = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: { role: Role.SUPER_ADMIN } }),
        }),
      };

      expect(rolesGuard.canActivate(mockContext)).toBe(true);
    });

    it('doit refuser avec ForbiddenException si le rôle est insuffisant', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.SUPER_ADMIN]);
      const mockContext: any = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: { role: Role.VENDOR } }),
        }),
      };

      expect(() => rolesGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });

  describe('DeviceBindingGuard', () => {
    let deviceGuard: DeviceBindingGuard;
    let prismaMock: any;

    beforeEach(() => {
      prismaMock = {
        device: {
          findFirst: jest.fn(),
          update: jest.fn(),
        },
      };
      deviceGuard = new DeviceBindingGuard(prismaMock);
    });

    it('doit laisser passer les non-vendeurs (ex: Admin Web)', async () => {
      const mockContext: any = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: Role.ADMIN },
          }),
        }),
      };

      await expect(deviceGuard.canActivate(mockContext)).resolves.toBe(true);
    });

    it('doit bloquer un terminal dont le statut est REVOKED', async () => {
      const mockContext: any = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            user: { role: Role.VENDOR, vendorId: 'v1', deviceId: 'DEV-001' },
            headers: { 'x-device-uuid': 'DEV-001' },
          }),
        }),
      };

      prismaMock.device.findFirst.mockResolvedValue({
        id: 'd1',
        deviceUuid: 'DEV-001',
        status: DeviceStatus.REVOKED,
      });

      await expect(deviceGuard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
    });
  });
});
