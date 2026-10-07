import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { TransactionType, Role, Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Crédit / Dépôt de fonds sur le compte d'un vendeur
   * Opération atomique avec verrouillage pessimiste PostgreSQL
   */
  async deposit(dto: DepositDto, operatorId: string) {
    const reference = dto.reference || `DEP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Verrouillage pessimiste de la ligne du vendeur
      const [lockedVendor] = await tx.$queryRaw<Array<{ id: string; currentBalance: any; vendorCode: string }>>`
        SELECT "id", "currentBalance", "vendorCode"
        FROM "Vendor"
        WHERE "id" = ${dto.vendorId}::uuid
        FOR UPDATE
      `;

      if (!lockedVendor) {
        throw new NotFoundException('Vendeur introuvable');
      }

      const balanceBefore = Number(lockedVendor.currentBalance);
      const balanceAfter = Number((balanceBefore + dto.amount).toFixed(2));

      // 2. Mise à jour du solde vendeur
      const updatedVendor = await tx.vendor.update({
        where: { id: dto.vendorId },
        data: {
          currentBalance: balanceAfter,
          lastActivityAt: new Date(),
        },
      });

      // 3. Écriture immutable dans le Grand Livre (Ledger)
      const transaction = await tx.transaction.create({
        data: {
          vendorId: dto.vendorId,
          operatorId,
          type: TransactionType.DEPOSIT,
          amount: dto.amount,
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
        action: 'VENDOR_DEPOSIT',
        resource: `Vendor:${dto.vendorId}`,
        newPayload: {
          amount: dto.amount,
          balanceBefore,
          balanceAfter,
          reference,
          description: dto.description,
        },
      });

      this.logger.log(
        `Dépôt réussi : +$${dto.amount} pour vendeur ${lockedVendor.vendorCode}. Nouveau solde : $${balanceAfter}`,
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

    // Somme totale de toutes les transactions
    const totalAgg = await this.prisma.transaction.aggregate({
      where: { vendorId },
      _sum: { amount: true },
      _count: { id: true },
    });

    const ledgerSum = Number(Number(totalAgg._sum.amount || 0).toFixed(2));
    const currentBalance = Number(Number(vendor.currentBalance).toFixed(2));
    const discrepancy = Number((currentBalance - ledgerSum).toFixed(2));
    const isBalanced = Math.abs(discrepancy) < 0.001;

    return {
      vendorId: vendor.id,
      vendorCode: vendor.vendorCode,
      fullName: vendor.fullName,
      currentBalance,
      ledgerSum,
      discrepancy,
      isBalanced,
      transactionsCount: totalAgg._count.id,
      reconciledAt: new Date(),
      breakdown,
      status: isBalanced ? 'RECONCILED' : 'DISCREPANCY_DETECTED',
    };
  }
}
