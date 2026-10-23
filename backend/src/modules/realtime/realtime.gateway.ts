import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    const role = client.handshake.query.role as string;
    const vendorId = client.handshake.query.vendorId as string;
    const deviceUuid = client.handshake.query.deviceUuid as string;

    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      client.join('admin_channel');
      this.logger.log(`[Admin Connecté] Socket ID: ${client.id}`);
    } else if (vendorId) {
      client.join(`vendor_${vendorId}`);
      this.logger.log(`[Vendeur Connecté] Vendor ID: ${vendorId}, Device: ${deviceUuid || 'N/A'}`);

      // Mise à jour de l'état en ligne du terminal
      if (deviceUuid) {
        await this.prisma.device.updateMany({
          where: { deviceUuid, vendorId },
          data: {
            isOnline: true,
            lastSeenAt: new Date(),
          },
        });
      }

      // Notifier les administrateurs en direct
      this.server.to('admin_channel').emit('vendor:status-change', {
        vendorId,
        isOnline: true,
        deviceUuid,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async handleDisconnect(client: Socket) {
    const vendorId = client.handshake.query.vendorId as string;
    const deviceUuid = client.handshake.query.deviceUuid as string;

    if (vendorId) {
      this.logger.log(`[Vendeur Déconnecté] Vendor ID: ${vendorId}`);

      if (deviceUuid) {
        await this.prisma.device.updateMany({
          where: { deviceUuid, vendorId },
          data: {
            isOnline: false,
            lastSeenAt: new Date(),
          },
        });
      }

      this.server.to('admin_channel').emit('vendor:status-change', {
        vendorId,
        isOnline: false,
        deviceUuid,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Heartbeat envoyé régulièrement par le terminal POS (ex: toutes les 30s)
   */
  @SubscribeMessage('vendor:heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { vendorId: string; deviceUuid: string; batteryLevel?: number; appVersion?: string },
  ) {
    const { vendorId, deviceUuid, batteryLevel, appVersion } = data;

    if (vendorId && deviceUuid) {
      await this.prisma.device.updateMany({
        where: { deviceUuid, vendorId },
        data: {
          isOnline: true,
          lastSeenAt: new Date(),
          appVersion: appVersion || undefined,
        },
      });

      await this.prisma.vendor.update({
        where: { id: vendorId },
        data: {
          lastActivityAt: new Date(),
          lastSyncAt: new Date(),
        },
      });

      // Notification live aux admins
      this.server.to('admin_channel').emit('vendor:heartbeat-ping', {
        vendorId,
        deviceUuid,
        batteryLevel,
        lastSeen: new Date().toISOString(),
      });
    }

    return { status: 'acknowledged', serverTime: new Date().toISOString() };
  }

  /**
   * KILL SWITCH TEMPS RÉEL : Déconnexion et verrouillage instantané du terminal
   */
  notifyVendorSuspension(vendorId: string, reason?: string) {
    this.logger.warn(`Émission d'un KILL SWITCH WebSocket vers le vendeur ${vendorId}`);
    this.server.to(`vendor_${vendorId}`).emit('FORCE_LOGOUT', {
      action: 'SUSPENDED',
      reason: reason || 'Compte vendeur suspendu par la direction.',
      timestamp: new Date().toISOString(),
    });

    this.server.to('admin_channel').emit('vendor:suspended', {
      vendorId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notification temps réel de réactivation
   */
  notifyVendorReactivation(vendorId: string) {
    this.server.to(`vendor_${vendorId}`).emit('VENDOR_REACTIVATED', {
      timestamp: new Date().toISOString(),
    });

    this.server.to('admin_channel').emit('vendor:reactivated', {
      vendorId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Émission d'une alerte générale vers tous les administrateurs
   */
  broadcastToAdmins(event: string, payload: any) {
    this.server.to('admin_channel').emit(event, payload);
  }

  /**
   * Notification temps réel de mise à jour du solde vendeur (Crédit Central / Couverture de Gain / Paiement)
   */
  notifyVendorBalanceUpdated(vendorId: string, newBalance: number, amount: number, reason?: string) {
    if (!this.server) return;
    const payload = {
      vendorId,
      newBalance,
      amount,
      reason: reason || 'Mise à jour du solde',
      timestamp: new Date().toISOString(),
    };
    this.server.to(`vendor_${vendorId}`).emit('vendor:balance-updated', payload);
    this.server.to('admin_channel').emit('vendor:balance-updated', payload);
  }
}
