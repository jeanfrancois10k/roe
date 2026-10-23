import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { TransactionType, TicketStatus, TicketPayoutStatus, Role, Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Optional() private readonly realtimeGateway?: RealtimeGateway,
  ) {}

  /**
   * Crédit / Dépôt de fonds sur le compte d'un vendeur (ex: Couverture du gain client)
   * Opération atomique avec verrouillage pessimiste PostgreSQL et protection anti-double crédit
   */
  async deposit(dto: DepositDto, operatorId: string) {
    if (!dto.amount || Number(dto.amount) <= 0 || Number.isNaN(Number(dto.amount))) {
      throw new BadRequestException('Le montant à créditer doit être strictement positif.');
    }

    const cleanAmount = Number(Number(dto.amount).toFixed(2));
    const description = (dto.description || 'Couverture du gain client').trim();
    const reference = dto.reference?.trim() || `DEP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Verrouillage pessimiste de la ligne du vendeur (sérialise toutes les opérations sur ce vendeur)
      const [lockedVendor] = await tx.$queryRaw<Array<{ id: string; currentBalance: any; vendorCode: string }>>`
        SELECT "id", "currentBalance", "vendorCode"
        FROM "Vendor"
        WHERE "id" = ${dto.vendorId}::uuid
        FOR UPDATE
      `;

      if (!lockedVendor) {
        throw new NotFoundException('Vendeur introuvable');
      }

      // 2. Protection anti-double crédit par référence explicite ou soumission identique rapprochée (< 15s)
      if (dto.reference) {
        const existingRef = await tx.transaction.findUnique({
          where: { reference },
        });
        if (existingRef) {
          throw new ConflictException(
            `Protection anti-double crédit : la référence '${reference}' a déjà été traitée.`,
          );
        }
      }

      const duplicateWindow = new Date(Date.now() - 15000);
      const recentDuplicate = await tx.transaction.findFirst({
        where: {
          vendorId: dto.vendorId,
          type: { in: [TransactionType.DEPOSIT, TransactionType.ADJUSTMENT] },
          amount: cleanAmount,
          description,
          createdAt: { gte: duplicateWindow },
        },
      });
      if (recentDuplicate) {
        throw new ConflictException(
          `Protection anti-double crédit : un crédit identique de ${cleanAmount} HTG (${description}) vient déjà d'être enregistré il y a quelques secondes.`,
        );
      }

      const balanceBefore = Number(lockedVendor.currentBalance);
      const balanceAfter = Number((balanceBefore + cleanAmount).toFixed(2));

      // 3. Mise à jour du solde vendeur
      const updatedVendor = await tx.vendor.update({
        where: { id: dto.vendorId },
        data: {
          currentBalance: balanceAfter,
          lastActivityAt: new Date(),
        },
      });

      // 4. Écriture immutable dans le Grand Livre (Ledger)
      const transaction = await tx.transaction.create({
        data: {
          vendorId: dto.vendorId,
          operatorId,
          type: TransactionType.DEPOSIT,
          amount: cleanAmount,
          balanceBefore,
          balanceAfter,
          reference,
          description,
        },
        include: {
          vendor: { select: { id: true, vendorCode: true, fullName: true } },
          operator: { select: { id: true, username: true } },
        },
      });

      // 5. Audit Log
      await this.auditService.log({
        userId: operatorId,
        action: 'VENDOR_DEPOSIT',
        resource: `Vendor:${dto.vendorId}`,
        newPayload: {
          amount: cleanAmount,
          balanceBefore,
          balanceAfter,
          reference,
          description,
        },
      });

      // 6. Notification temps réel vers le terminal vendeur et le dashboard admin
      this.realtimeGateway?.notifyVendorBalanceUpdated(
        dto.vendorId,
        balanceAfter,
        cleanAmount,
        description,
      );

      this.logger.log(
        `Dépôt réussi : +${cleanAmount} HTG pour vendeur ${lockedVendor.vendorCode}. Nouveau solde : ${balanceAfter} HTG`,
      );

      return {
        success: true,
        transaction: {
          ...transaction,
          amount: Number(transaction.amount),
          balanceBefore: Number(transaction.balanceBefore),
          balanceAfter: Number(transaction.balanceAfter),
        },
        vendor: {
          id: updatedVendor.id,
          vendorCode: updatedVendor.vendorCode,
          currentBalance: Number(updatedVendor.currentBalance),
        },
      };
    });
  }

  /**
   * Débit / Retrait de fonds du compte d'un vendeur
   * Opération atomique avec verrouillage pessimiste et vérification des plafonds
   */
  async withdraw(dto: WithdrawDto, operatorId: string) {
    const reference = dto.reference || `WTH-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Verrouillage pessimiste de la ligne du vendeur
      const [lockedVendor] = await tx.$queryRaw<Array<{ id: string; currentBalance: any; creditLimit: any; vendorCode: string }>>`
        SELECT "id", "currentBalance", "creditLimit", "vendorCode"
        FROM "Vendor"
        WHERE "id" = ${dto.vendorId}::uuid
        FOR UPDATE
      `;

      if (!lockedVendor) {
        throw new NotFoundException('Vendeur introuvable');
      }

      const balanceBefore = Number(lockedVendor.currentBalance);
      const creditLimit = Number(lockedVendor.creditLimit);

      // Vérification stricte des fonds
      if (balanceBefore - dto.amount < -creditLimit) {
        throw new BadRequestException(
          `Fonds insuffisants : solde disponible $${(balanceBefore + creditLimit).toFixed(2)} (solde: $${balanceBefore.toFixed(2)}, découvert autorisé: $${creditLimit.toFixed(2)}).`,
        );
      }

      const balanceAfter = Number((balanceBefore - dto.amount).toFixed(2));

      // 2. Mise à jour du solde vendeur
      const updatedVendor = await tx.vendor.update({
        where: { id: dto.vendorId },
        data: {
          currentBalance: balanceAfter,
          lastActivityAt: new Date(),
        },
      });

      // 3. Écriture immutable dans le Grand Livre (Ledger) avec montant négatif
      const transaction = await tx.transaction.create({
        data: {
          vendorId: dto.vendorId,
          operatorId,
          type: TransactionType.WITHDRAWAL,
          amount: -dto.amount,
          balanceBefore,
          balanceAfter,
          reference,
          description: dto.description,
        },
        include: {
          vendor: { select: { id: true, vendorCode: true, fullName: true } },
          operator: { select: { id: true, username: true } },
        },
      });

      // 4. Audit Log
      await this.auditService.log({
        userId: operatorId,
        action: 'VENDOR_WITHDRAWAL',
        resource: `Vendor:${dto.vendorId}`,
        newPayload: {
          amount: -dto.amount,
          balanceBefore,
          balanceAfter,
          reference,
          description: dto.description,
        },
      });

      this.logger.log(
        `Retrait réussi : -$${dto.amount} pour vendeur ${lockedVendor.vendorCode}. Nouveau solde : $${balanceAfter}`,
      );

      return {
        success: true,
        transaction: {
          ...transaction,
          amount: Number(transaction.amount),
          balanceBefore: Number(transaction.balanceBefore),
          balanceAfter: Number(transaction.balanceAfter),
        },
        vendor: {
          id: updatedVendor.id,
          vendorCode: updatedVendor.vendorCode,
          currentBalance: Number(updatedVendor.currentBalance),
        },
      };
    });
  }

  /**
   * Consultation paginée et filtrée des écritures financières
   * Isolation stricte : un vendeur ne peut consulter que ses propres transactions
   */
  async findAll(query: TransactionQueryDto, user: any) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {};

    // Isolation vendeur
    if (user.role === Role.VENDOR) {
      if (!user.vendor?.id) {
        throw new ForbiddenException('Profil vendeur introuvable pour cet utilisateur');
      }
      where.vendorId = user.vendor.id;
    } else if (query.vendorId) {
      where.vendorId = query.vendorId;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.ticketId) {
      where.ticketId = query.ticketId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    if (query.search) {
      where.OR = [
        { reference: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: { select: { id: true, vendorCode: true, fullName: true } },
          operator: { select: { id: true, username: true } },
          ticket: { select: { id: true, ticketNumber: true, totalAmount: true } },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: items.map((t) => ({
        ...t,
        amount: Number(t.amount),
        balanceBefore: Number(t.balanceBefore),
        balanceAfter: Number(t.balanceAfter),
        ticket: t.ticket
          ? {
              ...t.ticket,
              totalAmount: Number(t.ticket.totalAmount),
            }
          : null,
      })),
    };
  }

  /**
   * Détail d'une écriture comptable
   */
  async findById(id: string, user: any) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        vendor: { select: { id: true, vendorCode: true, fullName: true, currentBalance: true } },
        operator: { select: { id: true, username: true } },
        ticket: { select: { id: true, ticketNumber: true, totalAmount: true, status: true } },
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction introuvable');
    }

    if (user.role === Role.VENDOR && user.vendor?.id !== tx.vendorId) {
      throw new ForbiddenException('Accès interdit aux écritures d’un autre vendeur');
    }

    return {
      ...tx,
      amount: Number(tx.amount),
      balanceBefore: Number(tx.balanceBefore),
      balanceAfter: Number(tx.balanceAfter),
      vendor: {
        ...tx.vendor,
        currentBalance: Number(tx.vendor.currentBalance),
      },
      ticket: tx.ticket
        ? {
            ...tx.ticket,
            totalAmount: Number(tx.ticket.totalAmount),
          }
        : null,
    };
  }

  /**
   * Audit de réconciliation comptable : Grand Livre vs Solde Actuel
   * Reconstruit la somme mathématique de toutes les écritures et la compare au solde courant
   */
  async reconcileVendorLedger(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        vendorCode: true,
        fullName: true,
        currentBalance: true,
        creditLimit: true,
        createdAt: true,
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendeur introuvable');
    }

    // Agrégation par type d'opération
    const breakdownRaw = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { vendorId },
      _sum: { amount: true },
      _count: { id: true },
    });

    const breakdown = breakdownRaw.map((b) => ({
      type: b.type,
      totalAmount: Number(b._sum.amount || 0),
      count: b._count.id,
    }));

    // Somme des écritures affectant le solde disponible du compte vendeur (Dépôts, Retraits, Ajustements, Paiements de gains)
    const [balanceAgg, totalCountAgg, unpaidWinnersAgg, centralCreditsAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          vendorId,
          type: {
            in: [
              TransactionType.DEPOSIT,
              TransactionType.WITHDRAWAL,
              TransactionType.ADJUSTMENT,
              TransactionType.PRIZE_PAYOUT,
            ],
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.count({ where: { vendorId } }),
      this.prisma.ticket.aggregate({
        where: {
          vendorId,
          status: TicketStatus.CONFIRMED,
          isWinner: true,
          payoutStatus: TicketPayoutStatus.UNPAID,
        },
        _sum: { wonAmount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          vendorId,
          type: { in: [TransactionType.DEPOSIT, TransactionType.ADJUSTMENT] },
          amount: { gt: 0 },
          NOT: { reference: { startsWith: 'INIT-DEP-' } },
        },
        _sum: { amount: true },
      }),
    ]);

    const ledgerSum = Number(Number(balanceAgg._sum.amount || 0).toFixed(2));
    const currentBalance = Number(Number(vendor.currentBalance).toFixed(2));
    const discrepancy = Number((currentBalance - ledgerSum).toFixed(2));
    const isBalanced = Math.abs(discrepancy) < 0.001;
    const unpaidPrizesAmount = Number(unpaidWinnersAgg._sum.wonAmount || 0);
    const centralCreditsAmount = Number(centralCreditsAgg._sum.amount || 0);

    return {
      vendorId: vendor.id,
      vendorCode: vendor.vendorCode,
      fullName: vendor.fullName,
      currentBalance,
      ledgerSum,
      calculatedBalance: ledgerSum,
      discrepancy,
      difference: discrepancy,
      unpaidPrizesAmount,
      centralCreditsAmount,
      shortfallAmount: Math.max(0, Number((unpaidPrizesAmount - currentBalance).toFixed(2))),
      isBalanced,
      transactionsCount: totalCountAgg,
      reconciledAt: new Date(),
      breakdown,
      status: isBalanced ? 'RECONCILED' : 'DISCREPANCY_DETECTED',
    };
  }
}
