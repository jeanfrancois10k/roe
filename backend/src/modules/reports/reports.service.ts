import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';
import { TicketStatus, TicketPayoutStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesReport(query: SalesReportQueryDto, forcedVendorId?: string, isAdmin = false) {
    const period = query.period || 'day';
    const targetDate = query.date ? new Date(query.date) : new Date();

    let startDate: Date;
    let endDate: Date;

    if (period === 'day') {
      startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
      endDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
    } else if (period === 'week') {
      // Début de semaine (Lundi)
      const dayOfWeek = targetDate.getDay();
      const diffToMonday = (dayOfWeek + 6) % 7;
      startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() - diffToMonday, 0, 0, 0, 0);
      endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6, 23, 59, 59, 999);
    } else {
      // Mois complet
      startDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const effectiveVendorId = forcedVendorId || (isAdmin ? query.vendorId : undefined);
    const vendorFilter = effectiveVendorId ? { vendorId: effectiveVendorId } : {};

    // 1. Métriques Globales
    const [salesAgg, winnerAgg, prizesPaidAgg, rawTickets] = await Promise.all([
      this.prisma.ticket.aggregate({
        where: {
          ...vendorFilter,
          createdAt: { gte: startDate, lte: endDate },
          status: TicketStatus.CONFIRMED,
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.ticket.aggregate({
        where: {
          ...vendorFilter,
          createdAt: { gte: startDate, lte: endDate },
          status: TicketStatus.CONFIRMED,
          isWinner: true,
        },
        _sum: { wonAmount: true },
        _count: { _all: true },
      }),
      this.prisma.ticket.aggregate({
        where: {
          ...(effectiveVendorId ? { paidByVendorId: effectiveVendorId } : {}),
          paidAt: { gte: startDate, lte: endDate },
          payoutStatus: TicketPayoutStatus.PAID,
        },
        _sum: { wonAmount: true },
        _count: { _all: true },
      }),
      this.prisma.ticket.findMany({
        where: {
          ...vendorFilter,
          createdAt: { gte: startDate, lte: endDate },
          status: TicketStatus.CONFIRMED,
        },
        select: {
          id: true,
          totalAmount: true,
          isWinner: true,
          wonAmount: true,
          vendorId: true,
          drawId: true,
          draw: {
            select: {
              id: true,
              drawNumber: true,
              scheduledAt: true,
              game: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
          vendor: {
            select: {
              id: true,
              vendorCode: true,
              fullName: true,
              currentBalance: true,
            },
          },
        },
      }),
    ]);

    const totalSales = Number(salesAgg._sum.totalAmount || 0);
    const ticketsCount = salesAgg._count._all || 0;
    const winningTicketsCount = winnerAgg._count._all || 0;
    const totalWonAmount = Number(winnerAgg._sum.wonAmount || 0);
    const prizesPaid = Number(prizesPaidAgg._sum.wonAmount || 0);
    const prizesPaidCount = prizesPaidAgg._count._all || 0;
    const netRevenue = Number((totalSales - prizesPaid).toFixed(2));

    // 2. Répartition Par Tirage (byDraw)
    const drawMap = new Map<string, {
      drawId: string;
      drawNumber: number;
      scheduledAt: string;
      gameId: string;
      gameName: string;
      gameCode: string;
      ticketsCount: number;
      totalSales: number;
      winningTicketsCount: number;
      wonAmount: number;
    }>();

    for (const t of rawTickets) {
      const drawId = t.drawId;
      const game = t.draw?.game;
      if (!drawMap.has(drawId)) {
        drawMap.set(drawId, {
          drawId,
          drawNumber: t.draw?.drawNumber || 0,
          scheduledAt: t.draw?.scheduledAt?.toISOString() || '',
          gameId: game?.id || '',
          gameName: game?.name || 'Loterie',
          gameCode: game?.code || 'UNKNOWN',
          ticketsCount: 0,
          totalSales: 0,
          winningTicketsCount: 0,
          wonAmount: 0,
        });
      }

      const item = drawMap.get(drawId)!;
      item.ticketsCount += 1;
      item.totalSales = Number((item.totalSales + Number(t.totalAmount)).toFixed(2));
      if (t.isWinner) {
        item.winningTicketsCount += 1;
        item.wonAmount = Number((item.wonAmount + Number(t.wonAmount)).toFixed(2));
      }
    }

    const byDraw = Array.from(drawMap.values()).sort((a, b) => b.totalSales - a.totalSales);

    // 3. Répartition Par Vendeur (byVendor) si Admin ou requête globale
    let byVendor: any[] = [];
    if (isAdmin && !effectiveVendorId) {
      const vendorMap = new Map<string, {
        vendorId: string;
        vendorCode: string;
        vendorName: string;
        currentBalance: number;
        ticketsCount: number;
        totalSales: number;
        winningTicketsCount: number;
        wonAmount: number;
      }>();

      for (const t of rawTickets) {
        const vId = t.vendorId;
        const v = t.vendor;
        if (!vendorMap.has(vId)) {
          vendorMap.set(vId, {
            vendorId: vId,
            vendorCode: v?.vendorCode || 'N/A',
            vendorName: v?.fullName || 'Vendeur',
            currentBalance: Number(v?.currentBalance || 0),
            ticketsCount: 0,
            totalSales: 0,
            winningTicketsCount: 0,
            wonAmount: 0,
          });
        }

        const vItem = vendorMap.get(vId)!;
        vItem.ticketsCount += 1;
        vItem.totalSales = Number((vItem.totalSales + Number(t.totalAmount)).toFixed(2));
        if (t.isWinner) {
          vItem.winningTicketsCount += 1;
          vItem.wonAmount = Number((vItem.wonAmount + Number(t.wonAmount)).toFixed(2));
        }
      }

      byVendor = Array.from(vendorMap.values()).sort((a, b) => b.totalSales - a.totalSales);
    }

    const currencySetting = await this.prisma.systemSetting.findUnique({ where: { key: 'DEFAULT_CURRENCY' } });
    const currency = currencySetting?.value || 'HTG';

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      currency,
      global: {
        totalSales,
        ticketsCount,
        winningTicketsCount,
        totalWonAmount,
        prizesPaid,
        prizesPaidCount,
        netRevenue,
      },
      byDraw,
      byVendor,
    };
  }
}
