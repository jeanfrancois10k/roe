import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';
import { TicketStatus, TicketPayoutStatus } from '@prisma/client';
import { createHaitiDate, getHaitiDateParts } from '../draws/draws.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesReport(query: SalesReportQueryDto, forcedVendorId?: string, isAdmin = false) {
    const period = query.period || 'day';
    let startDate: Date;
    let endDate: Date;

    if (query.startDate) {
      // Plage personnalisée choisie par l'utilisateur (entre plusieurs dates)
      const startClean = query.startDate.split('T')[0];
      const startParts = startClean.split('-').map(Number);
      startDate = createHaitiDate(startParts[0], startParts[1] - 1, startParts[2], 0, 0, 0);

      if (query.endDate) {
        const endClean = query.endDate.split('T')[0];
        const endParts = endClean.split('-').map(Number);
        endDate = createHaitiDate(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59);
      } else {
        endDate = createHaitiDate(startParts[0], startParts[1] - 1, startParts[2], 23, 59, 59);
      }
    } else {
      const haitiNow = getHaitiDateParts(query.date ? new Date(query.date) : new Date());
      if (period === 'day') {
        startDate = createHaitiDate(haitiNow.year, haitiNow.month, haitiNow.day, 0, 0, 0);
        endDate = createHaitiDate(haitiNow.year, haitiNow.month, haitiNow.day, 23, 59, 59);
      } else if (period === 'week') {
        // Début de semaine (Lundi à Dimanche) en heure d'Haïti
        const targetHaiti = createHaitiDate(haitiNow.year, haitiNow.month, haitiNow.day, 12, 0, 0);
        const dayOfWeek = targetHaiti.getUTCDay();
        const diffToMonday = (dayOfWeek + 6) % 7;
        const mondayDay = haitiNow.day - diffToMonday;
        startDate = createHaitiDate(haitiNow.year, haitiNow.month, mondayDay, 0, 0, 0);
        endDate = createHaitiDate(haitiNow.year, haitiNow.month, mondayDay + 6, 23, 59, 59);
      } else {
        // Mois complet en heure d'Haïti
        startDate = createHaitiDate(haitiNow.year, haitiNow.month, 1, 0, 0, 0);
        const nextMonthStart = createHaitiDate(haitiNow.year, haitiNow.month + 1, 1, 0, 0, 0);
        endDate = new Date(nextMonthStart.getTime() - 1);
      }
    }

    const effectiveVendorId = forcedVendorId || (isAdmin ? query.vendorId : undefined);
    const vendorFilter = effectiveVendorId ? { vendorId: effectiveVendorId } : {};
    const drawFilter = query.drawId && query.drawId !== 'ALL' && query.drawId !== '' ? { drawId: query.drawId } : {};

    // Informations Vendeur & Taux de Commission
    let vendorCode = '';
    let vendorFullName = '';
    let vendorCommissionRate = 8.0;

    if (effectiveVendorId) {
      const vendorRecord = await this.prisma.vendor.findUnique({
        where: { id: effectiveVendorId },
        select: { vendorCode: true, fullName: true, defaultCommissionRate: true },
      });
      if (vendorRecord) {
        vendorCode = vendorRecord.vendorCode || '';
        vendorFullName = vendorRecord.fullName || '';
        if (vendorRecord.defaultCommissionRate != null) {
          vendorCommissionRate = Number(vendorRecord.defaultCommissionRate);
        }
      }
    }

    // Paramètres système (Nom de la borlette, Logo, Devise)
    const [nameSetting, logoSetting, phoneSetting, currencySetting] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { key: 'LOTTERY_NAME' } }),
      this.prisma.systemSetting.findUnique({ where: { key: 'LOTTERY_LOGO_URL' } }),
      this.prisma.systemSetting.findUnique({ where: { key: 'LOTTERY_PHONE' } }),
      this.prisma.systemSetting.findUnique({ where: { key: 'DEFAULT_CURRENCY' } }),
    ]);

    const lotteryName = nameSetting?.value || 'TOTAL CENTER LOTO';
    const lotteryLogoUrl = logoSetting?.value || '';
    const lotteryPhone = phoneSetting?.value || '';
    const currency = currencySetting?.value || 'HTG';

    // 1. Métriques Globales
    const [salesAgg, winnerAgg, prizesPaidAgg, rawTickets, winningTickets] = await Promise.all([
      this.prisma.ticket.aggregate({
        where: {
          ...vendorFilter,
          ...drawFilter,
          createdAt: { gte: startDate, lte: endDate },
          status: TicketStatus.CONFIRMED,
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.ticket.aggregate({
        where: {
          ...vendorFilter,
          ...drawFilter,
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
          ...drawFilter,
          paidAt: { gte: startDate, lte: endDate },
          payoutStatus: TicketPayoutStatus.PAID,
        },
        _sum: { wonAmount: true },
        _count: { _all: true },
      }),
      this.prisma.ticket.findMany({
        where: {
          ...vendorFilter,
          ...drawFilter,
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
      this.prisma.ticket.findMany({
        where: {
          ...vendorFilter,
          ...drawFilter,
          createdAt: { gte: startDate, lte: endDate },
          status: TicketStatus.CONFIRMED,
          isWinner: true,
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          ticketNumber: true,
          createdAt: true,
          totalAmount: true,
          wonAmount: true,
          payoutStatus: true,
          draw: {
            select: {
              drawNumber: true,
              game: { select: { name: true, code: true } },
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

    // Calculs conformes au ticket thermique officiel Borlette
    const commission = Number((totalSales * (vendorCommissionRate / 100.0)).toFixed(2));
    const balanceCash = Number((totalSales - prizesPaid).toFixed(2)); // Ventes - Pertes
    const balanceTotale = Number((balanceCash - commission).toFixed(2)); // Balance Cash - Commission

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

    // 4. Formatage Liste Tickets Gagnants (Reçu Thermique Photo 1)
    const formattedWinningTickets = winningTickets.map((t) => ({
      ticketNumber: t.ticketNumber,
      createdAt: t.createdAt.toISOString(),
      totalAmount: Number(t.totalAmount),
      wonAmount: Number(t.wonAmount),
      payoutStatus: t.payoutStatus === TicketPayoutStatus.PAID ? 'P' : 'NP',
      drawName: t.draw ? `${t.draw.game?.name || ''} #${t.draw.drawNumber}` : 'Tirage',
    }));

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      currency,
      lottery: {
        name: lotteryName,
        logoUrl: lotteryLogoUrl,
        phone: lotteryPhone,
      },
      vendor: {
        code: vendorCode,
        name: vendorFullName,
        commissionRate: vendorCommissionRate,
      },
      global: {
        totalSales,
        ticketsCount,
        winningTicketsCount,
        totalWonAmount,
        prizesPaid,
        prizesPaidCount,
        netRevenue,
        // Champs thermiques
        nombreFichesVendues: ticketsCount,
        nombreFichesGagnantes: winningTicketsCount,
        ventesTotal: totalSales,
        ventesCash: totalSales,
        ventesMoncash: 0.0,
        paiementsPertes: prizesPaid,
        balanceCash,
        commission,
        commissionRate: vendorCommissionRate,
        balanceTotale,
      },
      byDraw,
      byVendor,
      winningTickets: formattedWinningTickets,
    };
  }
}
