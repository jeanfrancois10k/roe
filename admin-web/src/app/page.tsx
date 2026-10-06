'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Smartphone,
  TrendingUp,
  Receipt,
  Trophy,
  DollarSign,
  Percent,
  Wallet,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { StatCard } from '../components/StatCard';
import { api } from '../lib/api';
import { getAdminSocket } from '../lib/socket';

export default function DashboardPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchStats = async () => {
    try {
      const stats = await api.get('/api/v1/admin/dashboard/stats');
      setData(stats);
    } catch (err: any) {
      console.error('Erreur chargement dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('roe_access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchStats();

    // Écoute WebSocket pour mise à jour live des vendeurs
    const socket = getAdminSocket();
    socket.on('vendor:status-change', () => {
      fetchStats();
    });
    socket.on('vendor:heartbeat-ping', () => {
      fetchStats();
    });

    return () => {
      socket.off('vendor:status-change');
      socket.off('vendor:heartbeat-ping');
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const overview = data?.overview || {
    activeVendorsCount: 0,
    onlineDevicesCount: 0,
    todaySalesAmount: 0,
    monthSalesAmount: 0,
    totalTicketsSold: 0,
    winningTicketsCount: 0,
    paidPrizesAmount: 0,
    commissionsAmount: 0,
    netRevenue: 0,
  };

  return (
    <div className="min-h-screen bg-roe-bg flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen">
        <Header
          onToggleSidebar={() => setSidebarOpen(true)}
          title="Tableau de Bord & Supervision"
          onRefresh={handleRefresh}
          isRefreshing={refreshing}
        />

        <main className="flex-1 p-4 md:p-8 space-y-8 max-w-7xl w-full mx-auto">
          {/* Bannière de Bienvenue & Titre */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-roe-surface via-roe-card to-roe-surface border border-roe-border/60 shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-roe-gold text-xs font-bold uppercase tracking-wider mb-1">
                <ShieldCheck size={16} />
                <span>Système Transactionnel Certifié</span>
              </div>
              <h2 className="text-2xl font-black text-white">Plateforme ROE BOLET</h2>
              <p className="text-xs md:text-sm text-roe-textMuted mt-1">
                Contrôle centralisé en direct des points de vente et des terminaux physiques.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/vendors')}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-roe-gold to-roe-goldDark text-roe-bg text-xs md:text-sm font-bold shadow-lg hover:scale-105 transition-all"
              >
                Gérer les Vendeurs
              </button>
            </div>
          </div>

          {/* Alertes Actives */}
          {data?.alerts && data.alerts.length > 0 && (
            <div className="space-y-3">
              {data.alerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-white text-xs md:text-sm">{alert.title}</p>
                      <p className="text-xs text-amber-200/80">{alert.message}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push('/vendors')}
                    className="flex items-center gap-1 text-xs font-semibold text-roe-gold hover:underline whitespace-nowrap ml-2"
                  >
                    <span>Vérifier</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Grille des 9 Indicateurs Clés Exigés */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            <StatCard
              title="Vendeurs Actifs"
              value={overview.activeVendorsCount}
              subtitle="Enregistrés sur la plateforme"
              icon={Users}
              variant="gold"
            />
            <StatCard
              title="Vendeurs Connectés"
              value={overview.onlineDevicesCount}
              subtitle="Terminaux en ligne (WebSocket)"
              icon={Smartphone}
              variant="emerald"
              trend={overview.onlineDevicesCount > 0 ? 'En direct' : 'Aucun terminal actif'}
            />
            <StatCard
              title="Ventes du Jour"
              value={`$${overview.todaySalesAmount.toFixed(2)}`}
              subtitle={`${overview.todayTicketsCount || 0} ticket(s) émis aujourd'hui`}
              icon={TrendingUp}
              variant="gold"
            />
            <StatCard
              title="Ventes du Mois"
              value={`$${overview.monthSalesAmount.toFixed(2)}`}
              subtitle="Chiffre d’affaires brut"
              icon={DollarSign}
              variant="purple"
            />
            <StatCard
              title="Tickets Vendus"
              value={overview.totalTicketsSold}
              subtitle="Historique cumulé"
              icon={Receipt}
              variant="gold"
            />
            <StatCard
              title="Tickets Gagnants"
              value={overview.winningTicketsCount}
              subtitle="Combinaisons validées"
              icon={Trophy}
              variant="amber"
            />
            <StatCard
              title="Gains Payés"
              value={`$${overview.paidPrizesAmount.toFixed(2)}`}
              subtitle="Distribués aux joueurs"
              icon={Wallet}
              variant="rose"
            />
            <StatCard
              title="Commissions"
              value={`$${overview.commissionsAmount.toFixed(2)}`}
              subtitle="Attribuées aux vendeurs"
              icon={Percent}
              variant="purple"
            />
            <StatCard
              title="Chiffre d'Affaires Net"
              value={`$${overview.netRevenue.toFixed(2)}`}
              subtitle="Ventes - Gains - Commissions"
              icon={DollarSign}
              variant="emerald"
            />
          </div>

          {/* Deux Colonnes : Dernières Transactions & Piste d'Audit */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne 1 : Grand Livre (Transactions) */}
            <div className="p-6 rounded-3xl bg-roe-surface border border-roe-border/70 shadow-xl flex flex-col">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-roe-border/60">
                <div className="flex items-center gap-2.5">
                  <Receipt size={18} className="text-roe-gold" />
                  <h3 className="text-base font-bold text-white">Dernières Transactions (Ledger)</h3>
                </div>
                <span className="text-[11px] font-mono text-roe-textMuted uppercase">Immuable</span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto max-h-[360px]">
                {data?.recentTransactions?.length > 0 ? (
                  data.recentTransactions.map((tx: any) => {
                    const isPositive = Number(tx.amount) >= 0;
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-roe-card/50 border border-roe-border/40 hover:border-roe-gold/20 transition-all text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              isPositive
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                          </div>
                          <div>
                            <p className="font-bold text-white">
                              {tx.vendor?.fullName || 'Vendeur'}{' '}
                              <span className="font-mono text-roe-gold text-[11px]">
                                ({tx.vendor?.vendorCode})
                              </span>
                            </p>
                            <p className="text-[11px] text-roe-textMuted">{tx.description}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p
                            className={`font-mono font-bold ${
                              isPositive ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isPositive ? '+' : ''}${Number(tx.amount).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-roe-textMuted font-mono">
                            Solde: ${Number(tx.balanceAfter).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-xs text-roe-textMuted">
                    Aucune transaction récente enregistrée.
                  </div>
                )}
              </div>
            </div>

            {/* Colonne 2 : Activités Récentes (Audit Log) */}
            <div className="p-6 rounded-3xl bg-roe-surface border border-roe-border/70 shadow-xl flex flex-col">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-roe-border/60">
                <div className="flex items-center gap-2.5">
                  <Clock size={18} className="text-purple-400" />
                  <h3 className="text-base font-bold text-white">Activités Récentes (Audit)</h3>
                </div>
                <span className="text-[11px] font-mono text-roe-textMuted uppercase">Sécurité</span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto max-h-[360px]">
                {data?.recentAuditLogs?.length > 0 ? (
                  data.recentAuditLogs.map((log: any) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-xl bg-roe-card/50 border border-roe-border/40 hover:border-purple-500/20 transition-all text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-roe-gold">
                            {log.action}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-roe-border text-roe-textMuted">
                            {log.resource}
                          </span>
                        </div>
                        <p className="text-[11px] text-roe-textMuted mt-1">
                          Par: {log.user?.username || 'Système'}
                        </p>
                      </div>

                      <div className="text-right text-[10px] text-roe-textMuted font-mono">
                        {new Date(log.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-roe-textMuted">
                    Aucun log d'activité récent.
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
