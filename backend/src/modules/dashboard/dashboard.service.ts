import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminStats(vendorId?: string) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const ticketFilter = vendorId ? { vendorId } : {};
    const transactionFilter = vendorId ? { vendorId } : {};

    // Requêtes parallèles pour performances optimales
    const [
      activeVendorsCount,
      suspendedVendorsCount,
      onlineDevicesCount,
      totalDevicesCount,
      todaySales,
      monthSales,
      totalTicketsSold,
      winningTicketsCount,
      paidPrizes,
      commissionsAgg,
      recentTransactions,
      recentAuditLogs,
      suspendedVendors,
      allVendors,
      selectedVendor,
    ] = await Promise.all([
      this.prisma.vendor.count({ where: { status: 'ACTIVE' } }),
      this.prisma.vendor.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.device.count({ where: { isOnline: true } }),
      this.prisma.device.count(),
      this.prisma.ticket.aggregate({
        where: { createdAt: { gte: startOfToday }, status: 'CONFIRMED', ...ticketFilter },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.ticket.aggregate({
        where: { createdAt: { gte: startOfMonth }, status: 'CONFIRMED', ...ticketFilter },
        _sum: { totalAmount: true },
      }),
      this.prisma.ticket.count({ where: { status: 'CONFIRMED', ...ticketFilter } }),
      this.prisma.ticket.count({ where: { isWinner: true, ...ticketFilter } }),
      this.prisma.ticket.aggregate({
        where: {
          payoutStatus: 'PAID',
          ...(vendorId ? { OR: [{ vendorId }, { paidByVendorId: vendorId }] } : {}),
        },
        _sum: { wonAmount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'COMMISSION', ...transactionFilter },
        _sum: { amount: true },
      }),
      this.prisma.transaction.findMany({
        take: 10,
        where: transactionFilter,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: { select: { vendorCode: true, fullName: true } },
        },
      }),
      this.prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { username: true, role: true } },
        },
      }),
      this.prisma.vendor.findMany({
        where: { status: 'SUSPENDED' },
        select: { id: true, vendorCode: true, fullName: true, updatedAt: true },
      }),
      this.prisma.vendor.findMany({
        select: { id: true, vendorCode: true, fullName: true, status: true },
        orderBy: { vendorCode: 'asc' },
      }),
      vendorId
        ? this.prisma.vendor.findUnique({
            where: { id: vendorId },
            select: {
              id: true,
              vendorCode: true,
              fullName: true,
              currentBalance: true,
              defaultCommissionRate: true,
              creditLimit: true,
              status: true,
            },
          })
        : null,
    ]);

    const todaySalesAmount = Number(todaySales._sum.totalAmount || 0);
    const monthSalesAmount = Number(monthSales._sum.totalAmount || 0);
    const paidPrizesAmount = Number(paidPrizes._sum.wonAmount || 0);
    const commissionsAmount = Number(commissionsAgg._sum.amount || 0);

    // Chiffre d'affaires brut et net
    const grossRevenue = monthSalesAmount;
    const netRevenue = grossRevenue - paidPrizesAmount - commissionsAmount;

    // Alertes automatiques
    const alerts = [];
    if (suspendedVendorsCount > 0 && !vendorId) {
      alerts.push({
        id: 'alert-suspended',
        type: 'WARNING',
        title: `${suspendedVendorsCount} vendeur(s) suspendu(s)`,
        message: 'Des vendeurs sont actuellement désactivés ou sous procédure de contrôle.',
        count: suspendedVendorsCount,
        details: suspendedVendors,
      });
    }

    if (onlineDevicesCount === 0 && totalDevicesCount > 0 && !vendorId) {
      alerts.push({
        id: 'alert-devices-offline',
        type: 'INFO',
        title: 'Aucun terminal en ligne',
        message: 'Tous les terminaux vendeurs sont actuellement déconnectés.',
      });
    }

    return {
      overview: {
        activeVendorsCount,
        suspendedVendorsCount,
        onlineDevicesCount,
        totalDevicesCount,
        todaySalesAmount,
        todayTicketsCount: todaySales._count.id || 0,
        monthSalesAmount,
        totalTicketsSold,
        winningTicketsCount,
        paidPrizesAmount,
        commissionsAmount,
        grossRevenue,
        netRevenue,
        currency: (await this.prisma.systemSetting.findUnique({ where: { key: 'DEFAULT_CURRENCY' } }))?.value || 'HTG',
        currencySymbol: (await this.prisma.systemSetting.findUnique({ where: { key: 'CURRENCY_SYMBOL' } }))?.value || 'G',
      },
      vendorsList: allVendors,
      selectedVendor: selectedVendor
        ? {
            ...selectedVendor,
            currentBalance: Math.abs(Number(selectedVendor.currentBalance)),
            defaultCommissionRate: Number(selectedVendor.defaultCommissionRate),
            creditLimit: Number(selectedVendor.creditLimit),
          }
        : null,
      recentTransactions: recentTransactions.map((tx) => ({
        ...tx,
        amount: Number(tx.amount),
        balanceBefore: Number(tx.balanceBefore),
        balanceAfter: Number(tx.balanceAfter),
      })),
      recentAuditLogs,
      alerts,
    };
  }
}
