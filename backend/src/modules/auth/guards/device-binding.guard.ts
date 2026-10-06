import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DeviceBindingGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Le contrôle matériel strict s'applique prioritairement aux terminaux vendeurs
    if (!user || user.role !== 'VENDOR') {
      return true;
    }

    const deviceUuid = request.headers['x-device-uuid'] || user.deviceId;

    if (!deviceUuid) {
      throw new ForbiddenException("Sécurité terminal : identifiant matériel de l'appareil manquant.");
    }

    if (!user.vendorId) {
      throw new ForbiddenException('Profil vendeur introuvable pour ce compte.');
    }

    const device = await this.prisma.device.findFirst({
      where: {
        vendorId: user.vendorId,
        deviceUuid: String(deviceUuid),
      },
    });

    if (!device) {
      throw new ForbiddenException("Terminal non reconnu : cet appareil n'est pas autorisé pour ce point de vente.");
    }

    if (device.status === 'REVOKED') {
      throw new ForbiddenException("Terminal révoqué : l'administrateur a bloqué l'accès de cet appareil.");
    }

    if (device.status === 'PENDING') {
      throw new ForbiddenException('Terminal en attente d’approbation par l’administrateur.');
    }

    // Mise à jour de la dernière activité de l'appareil
    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        isOnline: true,
        ipAddress: request.ip || null,
      },
    });

    return true;
  }
}
