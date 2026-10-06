import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { VendorStatus, DeviceStatus } from '@prisma/client';

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(page = 1, limit = 20, status?: VendorStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [total, items] = await Promise.all([
      this.prisma.vendor.count({ where }),
      this.prisma.vendor.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, username: true, email: true, isActive: true },
          },
          devices: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, page, limit, items };
  }

  async findById(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, email: true, isActive: true },
        },
        devices: true,
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendeur introuvable');
    }

    return vendor;
  }

  /**
   * KILL SWITCH ADMINISTRATEUR : Suspension immédiate du vendeur
   */
  async suspendVendor(vendorId: string, adminId: string, reason?: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendeur introuvable');
    }

    const previousStatus = vendor.status;

    // 1. Mise à jour statut en base
    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { status: VendorStatus.SUSPENDED },
    });

    // 2. Révocation immédiate de toutes les sessions actives (Refresh Tokens)
    await this.prisma.refreshToken.updateMany({
      where: { userId: vendor.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // 3. Déconnexion forcée des terminaux associés
    await this.prisma.device.updateMany({
      where: { vendorId },
      data: { isOnline: false },
    });

    // 4. Trace d'audit
    await this.auditService.log({
      userId: adminId,
      action: 'VENDOR_SUSPENDED',
      resource: `Vendor:${vendorId}`,
      oldPayload: { status: previousStatus },
      newPayload: { status: VendorStatus.SUSPENDED, reason },
    });

    this.logger.warn(`Vendeur ${vendor.vendorCode} (${vendorId}) SUSPENDU avec succès par l'administrateur ${adminId}`);

    return {
      success: true,
      message: `Le vendeur ${vendor.vendorCode} a été suspendu immédiatement. Toutes ses sessions ont été révoquées.`,
      vendor: updated,
    };
  }

  /**
   * Réactivation d'un compte vendeur
   */
  async reactivateVendor(vendorId: string, adminId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundException('Vendeur introuvable');
    }

    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { status: VendorStatus.ACTIVE },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'VENDOR_REACTIVATED',
      resource: `Vendor:${vendorId}`,
      oldPayload: { status: vendor.status },
      newPayload: { status: VendorStatus.ACTIVE },
    });

    return {
      success: true,
      message: `Le vendeur ${vendor.vendorCode} a été réactivé.`,
      vendor: updated,
    };
  }

  /**
   * Révocation à distance d'un terminal Android spécifique
   */
  async revokeDevice(deviceId: string, adminId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException('Appareil introuvable');
    }

    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        status: DeviceStatus.REVOKED,
        isOnline: false,
      },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'DEVICE_REVOKED',
      resource: `Device:${deviceId}`,
      newPayload: { deviceUuid: device.deviceUuid },
    });

    return {
      success: true,
      message: `Appareil ${device.deviceUuid} révoqué avec succès.`,
      device: updated,
    };
  }
}
