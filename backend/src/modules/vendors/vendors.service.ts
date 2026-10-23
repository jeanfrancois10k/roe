import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { ResetCredentialsDto } from './dto/reset-credentials.dto';
import { VendorQueryDto } from './dto/vendor-query.dto';
import { AssignDeviceDto } from './dto/assign-device.dto';
import { BalanceAdjustmentDto } from './dto/balance-adjustment.dto';
import { Role, VendorStatus, DeviceStatus, TransactionType, TicketStatus, TicketPayoutStatus, Prisma } from '@prisma/client';

/**
 * Formatage standard d'un nom d'utilisateur vendeur combinant son nom et son code PIN
 */
export function formatVendorUsername(fullName: string, pin?: string): string {
  const cleanName = (fullName || 'VENDEUR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  const cleanPin = pin ? pin.trim() : '';
  return `${cleanName}${cleanPin}`;
}

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /**
   * Création d'un nouveau vendeur
   */
  async createVendor(dto: CreateVendorDto, adminId?: string) {
    // 1. Détermination du nom d'utilisateur (Combinaison Nom + PIN si non fourni ou personnalisation)
    let username = dto.username?.trim();
    if (!username && dto.fullName) {
      username = formatVendorUsername(dto.fullName, dto.pin);
    }
    if (!username) {
      throw new BadRequestException("Le nom d'utilisateur est obligatoire ou doit pouvoir être combiné depuis le nom et le PIN.");
    }

    // Vérification unicité username & phone
    const existingUser = await this.prisma.user.findUnique({
      where: { username },
    });
    if (existingUser) {
      throw new BadRequestException(`Le nom d'utilisateur '${username}' est déjà utilisé.`);
    }

    const existingPhone = await this.prisma.vendor.findUnique({
      where: { phone: dto.phone },
    });
    if (existingPhone) {
      throw new BadRequestException(`Le numéro de téléphone '${dto.phone}' est déjà attribué à un autre vendeur.`);
    }

    // 2. Génération automatique du vendorCode si non fourni
    let vendorCode = dto.vendorCode;
    if (!vendorCode) {
      const count = await this.prisma.vendor.count();
      vendorCode = `VEND-${String(count + 1).padStart(3, '0')}`;
    } else {
      const existingCode = await this.prisma.vendor.findUnique({
        where: { vendorCode },
      });
      if (existingCode) {
        throw new BadRequestException(`Le code vendeur '${vendorCode}' est déjà utilisé.`);
      }
    }

    // 3. Hash mot de passe et code PIN
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const pinHash = dto.pin ? await bcrypt.hash(dto.pin, 12) : null;

    // 4. Transaction de création atomique
    const vendor = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          passwordHash,
          pinHash,
          role: Role.VENDOR,
          isActive: true,
        },
      });

      const initialBalance = dto.initialBalance || 0;

      const newVendor = await tx.vendor.create({
        data: {
          userId: user.id,
          vendorCode,
          fullName: dto.fullName,
          phone: dto.phone,
          posAddress: dto.posAddress,
          status: VendorStatus.ACTIVE,
          currentBalance: initialBalance,
          creditLimit: dto.creditLimit ?? 0,
          dailySalesLimit: dto.dailySalesLimit ?? 100000,
          maxTicketAmount: dto.maxTicketAmount ?? 10000,
          defaultCommissionRate: dto.defaultCommissionRate ?? 5.0,
        },
        include: {
          user: {
            select: { id: true, username: true, role: true, isActive: true },
          },
        },
      });

      // Si un solde initial a été crédité, créer l'écriture dans le Ledger
      if (initialBalance > 0) {
        await tx.transaction.create({
          data: {
            vendorId: newVendor.id,
            operatorId: adminId || null,
            type: TransactionType.DEPOSIT,
            amount: initialBalance,
            balanceBefore: 0,
            balanceAfter: initialBalance,
            reference: `INIT-DEP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
            description: `Dépôt initial d'ouverture de compte vendeur`,
          },
        });
      }

      return newVendor;
    });

    await this.auditService.log({
      userId: adminId,
      action: 'VENDOR_CREATED',
      resource: `Vendor:${vendor.id}`,
      newPayload: {
        vendorCode: vendor.vendorCode,
        fullName: vendor.fullName,
        phone: vendor.phone,
        initialBalance: dto.initialBalance,
      },
    });

    this.logger.log(`Nouveau vendeur créé : ${vendor.vendorCode} (${vendor.fullName})`);

    return vendor;
  }

  /**
   * Recherche paginée avec filtres multiples
   */
  async findAll(query: VendorQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.VendorWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { vendorCode: { contains: query.search, mode: 'insensitive' } },
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { posAddress: { contains: query.search, mode: 'insensitive' } },
        { user: { username: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

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
          devices: {
            select: {
              id: true,
              deviceUuid: true,
              deviceModel: true,
              status: true,
              isOnline: true,
              lastSeenAt: true,
              appVersion: true,
            },
          },
          _count: {
            select: {
              tickets: true,
              transactions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const vendorIds = items.map((v) => v.id);

    const [unpaidWinnersByVendor, paidWinnersByVendor, centralCreditsByVendor] =
      vendorIds.length > 0
        ? await Promise.all([
            this.prisma.ticket.groupBy({
              by: ['vendorId'],
              where: {
                vendorId: { in: vendorIds },
                status: TicketStatus.CONFIRMED,
                isWinner: true,
                payoutStatus: TicketPayoutStatus.UNPAID,
              },
              _sum: { wonAmount: true },
              _count: { id: true },
            }),
            this.prisma.ticket.groupBy({
              by: ['paidByVendorId'],
              where: {
                paidByVendorId: { in: vendorIds },
                payoutStatus: TicketPayoutStatus.PAID,
              },
              _sum: { wonAmount: true },
              _count: { id: true },
            }),
            this.prisma.transaction.groupBy({
              by: ['vendorId'],
              where: {
                vendorId: { in: vendorIds },
                type: { in: [TransactionType.DEPOSIT, TransactionType.ADJUSTMENT] },
                amount: { gt: 0 },
                NOT: { reference: { startsWith: 'INIT-DEP-' } },
              },
              _sum: { amount: true },
              _count: { id: true },
            }),
          ])
        : [[], [], []];

    const unpaidMap = new Map(
      unpaidWinnersByVendor.map((u) => [
        u.vendorId,
        { amount: Number(u._sum.wonAmount || 0), count: u._count.id || 0 },
      ]),
    );
    const paidMap = new Map(
      paidWinnersByVendor.map((p) => [
        p.paidByVendorId || '',
        { amount: Number(p._sum.wonAmount || 0), count: p._count.id || 0 },
      ]),
    );
    const creditsMap = new Map(
      centralCreditsByVendor.map((c) => [
        c.vendorId,
        { amount: Number(c._sum.amount || 0), count: c._count.id || 0 },
      ]),
    );

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: items.map((v) => {
        const currentBalance = Number(v.currentBalance);
        const unpaid = unpaidMap.get(v.id) || { amount: 0, count: 0 };
        const paid = paidMap.get(v.id) || { amount: 0, count: 0 };
        const credits = creditsMap.get(v.id) || { amount: 0, count: 0 };
        const shortfallAmount = Math.max(0, Number((unpaid.amount - currentBalance).toFixed(2)));

        return {
          ...v,
          currentBalance,
          unpaidPrizesAmount: unpaid.amount,
          unpaidPrizesCount: unpaid.count,
          shortfallAmount,
          centralCreditsAmount: credits.amount,
          centralCreditsCount: credits.count,
          prizesPaidAmount: paid.amount,
          prizesPaidCount: paid.count,
          creditLimit: Number(v.creditLimit),
          dailySalesLimit: Number(v.dailySalesLimit),
          maxTicketAmount: Number(v.maxTicketAmount),
          defaultCommissionRate: Number(v.defaultCommissionRate),
        };
      }),
    };
  }

  /**
   * Consultation détaillée d'un vendeur avec statistiques financières
   */
  async findById(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, email: true, isActive: true, createdAt: true },
        },
        devices: true,
        commissions: {
          include: { game: true },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendeur introuvable');
    }

    // Calcul métriques du jour
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [todaySales, monthSales, totalTickets, unpaidWinnersAgg, paidWinnersAgg, centralCreditsAgg] = await Promise.all([
      this.prisma.ticket.aggregate({
        where: {
          vendorId: id,
          createdAt: { gte: startOfToday },
          status: 'CONFIRMED',
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.ticket.aggregate({
        where: {
          vendorId: id,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
          status: 'CONFIRMED',
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.ticket.count({
        where: { vendorId: id },
      }),
      this.prisma.ticket.aggregate({
        where: {
          vendorId: id,
          status: TicketStatus.CONFIRMED,
          isWinner: true,
          payoutStatus: TicketPayoutStatus.UNPAID,
        },
        _sum: { wonAmount: true },
        _count: { id: true },
      }),
      this.prisma.ticket.aggregate({
        where: {
          paidByVendorId: id,
          payoutStatus: TicketPayoutStatus.PAID,
        },
        _sum: { wonAmount: true },
        _count: { id: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          vendorId: id,
          type: { in: [TransactionType.DEPOSIT, TransactionType.ADJUSTMENT] },
          amount: { gt: 0 },
          NOT: { reference: { startsWith: 'INIT-DEP-' } },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    const currentBalance = Number(vendor.currentBalance);
    const unpaidPrizesAmount = Number(unpaidWinnersAgg._sum.wonAmount || 0);
    const unpaidPrizesCount = unpaidWinnersAgg._count.id || 0;
    const shortfallAmount = Math.max(0, Number((unpaidPrizesAmount - currentBalance).toFixed(2)));
    const centralCreditsAmount = Number(centralCreditsAgg._sum.amount || 0);
    const prizesPaidAmount = Number(paidWinnersAgg._sum.wonAmount || 0);

    return {
      ...vendor,
      currentBalance,
      unpaidPrizesAmount,
      unpaidPrizesCount,
      shortfallAmount,
      centralCreditsAmount,
      prizesPaidAmount,
      creditLimit: Number(vendor.creditLimit),
      dailySalesLimit: Number(vendor.dailySalesLimit),
      maxTicketAmount: Number(vendor.maxTicketAmount),
      defaultCommissionRate: Number(vendor.defaultCommissionRate),
      metrics: {
        todaySalesAmount: Number(todaySales._sum.totalAmount || 0),
        todayTicketsCount: todaySales._count.id || 0,
        monthSalesAmount: Number(monthSales._sum.totalAmount || 0),
        totalTicketsCount: totalTickets,
        unpaidPrizesAmount,
        unpaidPrizesCount,
        shortfallAmount,
        centralCreditsAmount,
        prizesPaidAmount,
      },
    };
  }

  /**
   * Mise à jour complète de toutes les informations d'un vendeur (coordonnées, identifiant, PIN, mot de passe, limites, statut)
   */
  async updateVendor(id: string, dto: UpdateVendorDto, adminId?: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!vendor) {
      throw new NotFoundException('Vendeur introuvable');
    }

    // 1. Vérification unicité vendorCode si modifié
    if (dto.vendorCode && dto.vendorCode !== vendor.vendorCode) {
      const existingCode = await this.prisma.vendor.findUnique({
        where: { vendorCode: dto.vendorCode },
      });
      if (existingCode) {
        throw new BadRequestException(`Le code vendeur '${dto.vendorCode}' est déjà utilisé.`);
      }
    }

    // 2. Vérification unicité téléphone si modifié
    if (dto.phone && dto.phone !== vendor.phone) {
      const existingPhone = await this.prisma.vendor.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone) {
        throw new BadRequestException(`Le numéro de téléphone '${dto.phone}' est déjà attribué à un autre vendeur.`);
      }
    }

    // 3. Vérification unicité username si modifié
    if (dto.username && dto.username !== vendor.user?.username) {
      const existingUser = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (existingUser) {
        throw new BadRequestException(`Le nom d'utilisateur '${dto.username}' est déjà utilisé.`);
      }
    }

    // 4. Si le statut passe à SUSPENDED, appliquer la procédure de suspension complète
    if (dto.status === VendorStatus.SUSPENDED && vendor.status !== VendorStatus.SUSPENDED) {
      return this.suspendVendor(id, adminId || 'SYSTEM', 'Mise à jour statut vers SUSPENDED');
    }

    // 5. Préparation des données d'authentification User
    const userData: any = {};
    if (dto.username && dto.username.trim().length > 0) {
      userData.username = dto.username.trim();
    }
    if (dto.password && dto.password.trim().length >= 6) {
      userData.passwordHash = await bcrypt.hash(dto.password.trim(), 12);
    }
    if (dto.pin !== undefined) {
      const trimmedPin = dto.pin ? String(dto.pin).trim() : '';
      if (trimmedPin.length >= 4) {
        userData.pinHash = await bcrypt.hash(trimmedPin, 12);
      } else if (trimmedPin === '') {
        userData.pinHash = null;
      }
    }

    // 6. Mise à jour transactionnelle du Vendeur et de son Utilisateur
    const updated = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0 && vendor.userId) {
        await tx.user.update({
          where: { id: vendor.userId },
          data: userData,
        });
      }

      return tx.vendor.update({
        where: { id },
        data: {
          vendorCode: dto.vendorCode !== undefined ? dto.vendorCode : undefined,
          fullName: dto.fullName,
          phone: dto.phone,
          posAddress: dto.posAddress,
          creditLimit: dto.creditLimit !== undefined ? dto.creditLimit : undefined,
          dailySalesLimit: dto.dailySalesLimit !== undefined ? dto.dailySalesLimit : undefined,
          maxTicketAmount: dto.maxTicketAmount !== undefined ? dto.maxTicketAmount : undefined,
          defaultCommissionRate: dto.defaultCommissionRate !== undefined ? dto.defaultCommissionRate : undefined,
          status: dto.status,
        },
        include: {
          user: {
            select: { id: true, username: true, role: true, isActive: true },
          },
        },
      });
    });

    await this.auditService.log({
      userId: adminId,
      action: 'VENDOR_UPDATED',
      resource: `Vendor:${id}`,
      oldPayload: vendor,
      newPayload: updated,
    });

    return updated;
  }

  /**
   * Réinitialisation sécurisée du Mot de Passe ou du PIN
   */
  async resetCredentials(id: string, dto: ResetCredentialsDto, adminId?: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!vendor || !vendor.user) {
      throw new NotFoundException('Vendeur introuvable');
    }

    const dataToUpdate: Prisma.UserUpdateInput = {};

    if (dto.newPassword) {
      dataToUpdate.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    }
    if (dto.newPin) {
      dataToUpdate.pinHash = await bcrypt.hash(dto.newPin, 12);
    }

    if (Object.keys(dataToUpdate).length === 0) {
      throw new BadRequestException('Veuillez fournir un nouveau mot de passe ou un nouveau PIN.');
    }

    await this.prisma.user.update({
      where: { id: vendor.userId },
      data: dataToUpdate,
    });

    // Révocation de toutes les sessions actives pour forcer la reconnexion avec les nouvelles clés
    await this.prisma.refreshToken.updateMany({
      where: { userId: vendor.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Coupure WebSocket pour forcer la déconnexion
    this.realtimeGateway.notifyVendorSuspension(id, 'Identifiants modifiés par la direction. Veuillez vous reconnecter.');

    await this.auditService.log({
      userId: adminId,
      action: 'VENDOR_CREDENTIALS_RESET',
      resource: `Vendor:${id}`,
      newPayload: {
        passwordReset: !!dto.newPassword,
        pinReset: !!dto.newPin,
      },
    });

    return {
      success: true,
      message: `Identifiants du vendeur ${vendor.vendorCode} mis à jour avec succès. Toutes ses sessions ont été révoquées.`,
    };
  }

  /**
   * Consultation paginée des transactions Ledger du vendeur
   */
  async getVendorTransactions(id: string, page = 1, limit = 20, type?: TransactionType) {
    const skip = (page - 1) * limit;
    const where: Prisma.TransactionWhereInput = { vendorId: id };
    if (type) where.type = type;

    const [total, items] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, page, limit, items };
  }

  /**
   * Consultation paginée des tickets du vendeur
   */
  async getVendorTickets(id: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      this.prisma.ticket.count({ where: { vendorId: id } }),
      this.prisma.ticket.findMany({
        where: { vendorId: id },
        skip,
        take: limit,
        include: { game: { select: { name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, page, limit, items };
  }

  /**
   * Régularisation manuelle du solde / Couverture de gain client (ADJUSTMENT) avec grand livre immuable et protection anti-double crédit
   */
  async adjustBalance(vendorId: string, dto: BalanceAdjustmentDto, adminId: string) {
    if (dto.amount === undefined || dto.amount === null || Number(dto.amount) === 0 || Number.isNaN(Number(dto.amount))) {
      throw new BadRequestException('Veuillez saisir un montant valide non nul.');
    }

    const cleanAmount = Number(Number(dto.amount).toFixed(2));
    const cleanReason = (dto.reason || 'Couverture du gain client').trim();
    if (!cleanReason) {
      throw new BadRequestException('Le motif de l’opération est obligatoire.');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Verrouillage pessimiste de la ligne du vendeur
      const [lockedVendor] = await tx.$queryRaw<
        Array<{ id: string; currentBalance: any; creditLimit: any; vendorCode: string }>
      >`
        SELECT "id", "currentBalance", "creditLimit", "vendorCode"
        FROM "Vendor"
        WHERE "id" = ${vendorId}::uuid
        FOR UPDATE
      `;

      if (!lockedVendor) {
        throw new NotFoundException('Vendeur introuvable');
      }

      // 2. Protection anti-double crédit (empêche la soumission en double dans les 15 secondes)
      const duplicateWindow = new Date(Date.now() - 15000);
      const recentDuplicate = await tx.transaction.findFirst({
        where: {
          vendorId,
          type: { in: [TransactionType.ADJUSTMENT, TransactionType.DEPOSIT] },
          amount: cleanAmount,
          description: cleanReason,
          createdAt: { gte: duplicateWindow },
        },
      });
      if (recentDuplicate) {
        throw new ConflictException(
          `Protection anti-double crédit : cette opération (${cleanAmount} HTG — "${cleanReason}") vient déjà d'être enregistrée il y a quelques secondes.`,
        );
      }

      const balanceBefore = Number(lockedVendor.currentBalance);
      const balanceAfter = Number((balanceBefore + cleanAmount).toFixed(2));

      if (balanceAfter < 0 && Math.abs(balanceAfter) > Number(lockedVendor.creditLimit)) {
        throw new BadRequestException('Opération impossible : solde après ajustement inférieur au découvert autorisé.');
      }

      // 3. Mise à jour du solde vendeur
      const updatedVendor = await tx.vendor.update({
        where: { id: vendorId },
        data: {
          currentBalance: balanceAfter,
          lastActivityAt: new Date(),
        },
      });

      // 4. Écriture Ledger immuable
      const transaction = await tx.transaction.create({
        data: {
          vendorId,
          operatorId: adminId,
          type: TransactionType.ADJUSTMENT,
          amount: cleanAmount,
          balanceBefore,
          balanceAfter,
          reference: `ADJ-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
          description: cleanReason,
        },
        include: {
          vendor: { select: { id: true, vendorCode: true, fullName: true } },
          operator: { select: { id: true, username: true } },
        },
      });

      await this.auditService.log({
        userId: adminId,
        action: 'VENDOR_BALANCE_ADJUSTED',
        resource: `Vendor:${vendorId}`,
        newPayload: {
          amount: cleanAmount,
          balanceBefore,
          balanceAfter,
          reason: cleanReason,
        },
      });

      // 5. Notification temps réel vers le terminal vendeur et le dashboard admin
      this.realtimeGateway.notifyVendorBalanceUpdated(
        vendorId,
        balanceAfter,
        cleanAmount,
        cleanReason,
      );

      return {
        success: true,
        message: 'Ajustement de solde enregistré dans le Grand Livre.',
        vendor: {
          ...updatedVendor,
          currentBalance: Number(updatedVendor.currentBalance),
        },
        transaction: {
          ...transaction,
          amount: Number(transaction.amount),
          balanceBefore: Number(transaction.balanceBefore),
          balanceAfter: Number(transaction.balanceAfter),
        },
      };
    });
  }

  /**
   * Attribution d'un terminal Android à un vendeur
   */
  async assignDevice(vendorId: string, dto: AssignDeviceDto, adminId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException('Vendeur introuvable');
    }

    const existingDevice = await this.prisma.device.findUnique({
      where: { deviceUuid: dto.deviceUuid },
    });

    if (existingDevice && existingDevice.vendorId !== vendorId) {
      throw new BadRequestException(`Cet appareil (${dto.deviceUuid}) est déjà assigné à un autre vendeur.`);
    }

    const device = await this.prisma.device.upsert({
      where: { deviceUuid: dto.deviceUuid },
      update: {
        vendorId,
        deviceModel: dto.deviceModel,
        osVersion: dto.osVersion || 'Android',
        appVersion: dto.appVersion || '1.0.0',
        status: DeviceStatus.AUTHORIZED,
      },
      create: {
        vendorId,
        deviceUuid: dto.deviceUuid,
        deviceModel: dto.deviceModel,
        osVersion: dto.osVersion || 'Android',
        appVersion: dto.appVersion || '1.0.0',
        status: DeviceStatus.AUTHORIZED,
      },
    });

    await this.auditService.log({
      userId: adminId,
      action: 'DEVICE_ASSIGNED',
      resource: `Device:${device.id}`,
      newPayload: { vendorId, deviceUuid: device.deviceUuid },
    });

    return device;
  }

  /**
   * Révocation d'un appareil
   */
  async revokeDevice(deviceId: string, adminId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      throw new NotFoundException('Appareil introuvable');
    }

    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: { status: DeviceStatus.REVOKED, isOnline: false },
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

  /**
   * KILL SWITCH ADMINISTRATEUR : Suspension immédiate et notification temps réel
   */
  async suspendVendor(vendorId: string, adminId: string, reason?: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException('Vendeur introuvable');
    }

    const previousStatus = vendor.status;

    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { status: VendorStatus.SUSPENDED },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: vendor.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.device.updateMany({
      where: { vendorId },
      data: { isOnline: false },
    });

    // Émission WebSocket instantanée vers le terminal Android
    this.realtimeGateway.notifyVendorSuspension(vendorId, reason);

    await this.auditService.log({
      userId: adminId,
      action: 'VENDOR_SUSPENDED',
      resource: `Vendor:${vendorId}`,
      oldPayload: { status: previousStatus },
      newPayload: { status: VendorStatus.SUSPENDED, reason },
    });

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
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException('Vendeur introuvable');
    }

    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { status: VendorStatus.ACTIVE },
    });

    this.realtimeGateway.notifyVendorReactivation(vendorId);

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
   * Suppression définitive d'un compte vendeur et de ses terminaux
   */
  async deleteVendor(vendorId: string, adminId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: true, devices: true },
    });

    if (!vendor) {
      throw new NotFoundException('Vendeur introuvable');
    }

    // Déconnexion forcée WebSocket si connecté
    try {
      this.realtimeGateway.notifyVendorSuspension(vendorId, 'Compte vendeur supprimé par la direction.');
    } catch {}

    await this.prisma.$transaction(async (tx) => {
      // 1. Supprimer les terminaux
      await tx.device.deleteMany({ where: { vendorId } });
      // 2. Supprimer les règles de commission
      await tx.commission.deleteMany({ where: { vendorId } });
      // 3. Supprimer les transactions et tickets résiduels
      await tx.transaction.deleteMany({ where: { vendorId } });
      await tx.ticket.deleteMany({ where: { vendorId } });
      // 4. Supprimer le profil vendeur
      await tx.vendor.delete({ where: { id: vendorId } });
      // 5. Supprimer le compte utilisateur
      if (vendor.userId) {
        await tx.user.delete({ where: { id: vendor.userId } });
      }
    });

    await this.auditService.log({
      userId: adminId,
      action: 'VENDOR_DELETED',
      resource: `Vendor:${vendor.vendorCode}`,
      oldPayload: { vendorCode: vendor.vendorCode, fullName: vendor.fullName },
    });

    return {
      success: true,
      message: `Le vendeur ${vendor.vendorCode} (${vendor.fullName}) a été définitivement supprimé.`,
    };
  }

  /**
   * Rapport de Contrôle Journalier (Settlement / Fè Kontwòl)
   * Calcule les ventes brutes, la commission du vendeur, les gains payés et le montant net dû au propriétaire.
   */
  async getControlSummary(vendorId: string, dateStr?: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });
    if (!vendor) {
      throw new NotFoundException('Vendeur introuvable');
    }

    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    // 1. Total Ventes du jour (Gross Sales)
    const salesAgg = await this.prisma.ticket.aggregate({
      where: {
        vendorId,
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: TicketStatus.CONFIRMED,
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    });
    const totalSales = Number(salesAgg._sum.totalAmount || 0);
    const ticketsCount = salesAgg._count._all || 0;

    // 2. Taux de commission du vendeur
    const commissionRate = Number(vendor.defaultCommissionRate || 8.0);
    const commissionAmount = Number(((totalSales * commissionRate) / 100).toFixed(2));

    // 3. Lots Payés par ce vendeur aujourd'hui (Prizes paid to customers)
    const payoutAgg = await this.prisma.ticket.aggregate({
      where: {
        paidByVendorId: vendorId,
        paidAt: { gte: startOfDay, lte: endOfDay },
        payoutStatus: TicketPayoutStatus.PAID,
      },
      _sum: { wonAmount: true },
      _count: { _all: true },
    });
    const prizesPaid = Number(payoutAgg._sum.wonAmount || 0);
    const prizesPaidCount = payoutAgg._count._all || 0;

    // 4. Montant Net Dû au Propriétaire (Net due to Bank Owner)
    // Net = Ventes - Commission - Lots Payés
    const netDueToOwner = Number((totalSales - commissionAmount - prizesPaid).toFixed(2));

    // 5. Cash net en caisse théorique (Ventes - Lots Payés)
    const cashInHand = Number((totalSales - prizesPaid).toFixed(2));

    // 6. Gains à payer (en attente) & Crédits reçus du Central & Transactions récentes
    const [unpaidWinnersAgg, centralCreditsAgg, initialDepositAgg, recentTransactions, currencySetting] =
      await Promise.all([
        this.prisma.ticket.aggregate({
          where: {
            vendorId,
            status: TicketStatus.CONFIRMED,
            isWinner: true,
            payoutStatus: TicketPayoutStatus.UNPAID,
          },
          _sum: { wonAmount: true },
          _count: { _all: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            vendorId,
            type: { in: [TransactionType.DEPOSIT, TransactionType.ADJUSTMENT] },
            amount: { gt: 0 },
            NOT: { reference: { startsWith: 'INIT-DEP-' } },
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            vendorId,
            type: TransactionType.DEPOSIT,
            reference: { startsWith: 'INIT-DEP-' },
          },
          _sum: { amount: true },
        }),
        this.prisma.transaction.findMany({
          where: { vendorId },
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: {
            operator: { select: { username: true } },
          },
        }),
        this.prisma.systemSetting.findUnique({ where: { key: 'DEFAULT_CURRENCY' } }),
      ]);

    const currentBalance = Number(vendor.currentBalance);
    const unpaidPrizesAmount = Number(unpaidWinnersAgg._sum.wonAmount || 0);
    const unpaidPrizesCount = unpaidWinnersAgg._count._all || 0;
    const shortfallAmount = Math.max(0, Number((unpaidPrizesAmount - currentBalance).toFixed(2)));
    const centralCreditsAmount = Number(centralCreditsAgg._sum.amount || 0);
    const centralCreditsCount = centralCreditsAgg._count._all || 0;
    const initialBalanceAmount = Number(initialDepositAgg._sum.amount || 0);
    const currency = currencySetting?.value || 'HTG';

    return {
      vendorId: vendor.id,
      vendorCode: vendor.vendorCode,
      vendorName: vendor.fullName,
      posAddress: vendor.posAddress,
      date: startOfDay.toISOString().split('T')[0],
      totalSales,
      ticketsCount,
      commissionRate,
      commissionAmount,
      prizesPaid,
      prizesPaidCount,
      unpaidPrizesAmount,
      unpaidPrizesCount,
      shortfallAmount,
      centralCreditsAmount,
      centralCreditsCount,
      initialBalanceAmount,
      netDueToOwner,
      cashInHand,
      currentBalance,
      currency,
      recentTransactions: recentTransactions.map((tx) => ({
        id: tx.id,
        reference: tx.reference,
        type: tx.type,
        amount: Number(tx.amount),
        balanceBefore: Number(tx.balanceBefore),
        balanceAfter: Number(tx.balanceAfter),
        description: tx.description,
        operatorUsername: tx.operator?.username || 'Système',
        createdAt: tx.createdAt,
      })),
    };
  }
}
