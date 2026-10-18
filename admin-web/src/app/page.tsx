'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Smartphone,
  TrendingUp,
  Receipt,
  Trophy,
  Coins,
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
import { formatCurrency, getCurrencySymbol } from '../lib/currency';

export default function DashboardPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [currency, setCurrency] = useState<string>('HTG');
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('');

  const fetchStats = async (vendorId?: string) => {
    try {
      const targetVendor = vendorId !== undefined ? vendorId : selectedVendorFilter;
      const url = targetVendor 
        ? `/api/v1/admin/dashboard/stats?vendorId=${encodeURIComponent(targetVendor)}`
        : '/api/v1/admin/dashboard/stats';
      const stats = await api.get(url);
      setData(stats);
      if (stats.overview?.currency) {
        setCurrency(stats.overview.currency);
      }
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

  const handleCurrencyChange = async (newCurrency: string) => {
    setCurrency(newCurrency);
    try {
      await api.patch('/api/v1/settings/currency', { currency: newCurrency });
      await fetchStats();
    } catch (err) {
      console.error('Erreur lors du changement de devise:', err);
    }
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
    currency: 'HTG',
  };

  const activeCurrency = overview.currency || currency;

  return (
    <div className="min-h-screen bg-roe-bg flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen">
        <Header
          onToggleSidebar={() => setSidebarOpen(true)}
          title="Tableau de Bord & Supervision"
          onRefresh={handleRefresh}
          isRefreshing={refreshing}
          currency={activeCurrency}
          onCurrencyChange={handleCurrencyChange}
        />

        <main className="flex-1 p-3.5 sm:p-6 md:p-8 space-y-6 md:space-y-8 max-w-7xl w-full mx-auto">
          {/* Bannière de Bienvenue & Titre */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-roe-surface via-roe-card to-roe-surface border border-roe-border/60 shadow-xl">
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2 text-roe-gold text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">
                <ShieldCheck size={14} className="flex-shrink-0" />
                <span className="truncate">Système Certifié — {activeCurrency === 'HTG' ? '🇭🇹 Gourde (HTG)' : '🇺🇸 Dollar (USD)'}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Plateforme ROE BOLET</h2>
              <p className="text-xs sm:text-sm text-roe-textMuted mt-1">
                Contrôle centralisé des points de vente et tirages certifiés.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/vendors')}
                className="w-full sm:w-auto text-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-roe-gold to-roe-goldDark text-roe-bg text-xs md:text-sm font-bold shadow-lg hover:scale-105 transition-all"
              >
                Gérer les Vendeurs
              </button>
            </div>
          </div>

          {/* SÉLECTEUR DE FILTRAGE DES RAPPORTS PAR VENDEUR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-roe-card border border-roe-border/60 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-roe-gold/15 text-roe-gold">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Filtrer les Rapports & Métriques par Vendeur</h3>
                <p className="text-xs text-roe-textMuted">
                  {selectedVendorFilter && data?.selectedVendor
                    ? `Affichage exclusif des données financières pour ${data.selectedVendor.fullName} (${data.selectedVendor.vendorCode})`
                    : 'Vue globale consolidée de toutes les banques et points de vente'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedVendorFilter}
                onChange={(e) => {
                  const newVendorId = e.target.value;
                  setSelectedVendorFilter(newVendorId);
                  fetchStats(newVendorId);
                }}
                className="w-full sm:w-72 px-3.5 py-2.5 rounded-xl bg-roe-surface border border-roe-border text-white text-xs md:text-sm font-semibold focus:outline-none focus:border-roe-gold cursor-pointer"
              >
                <option value="">🏢 Tous les Vendeurs (Vue Globale)</option>
                {data?.vendorsList?.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.vendorCode} — {v.fullName} ({v.status})
                  </option>
                ))}
              </select>

              {selectedVendorFilter && (
                <button
                  onClick={() => {
                    setSelectedVendorFilter('');
                    fetchStats('');
                  }}
                  className="px-3 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all whitespace-nowrap"
                  title="Réinitialiser le filtre"
                >
                  ✕ Réinitialiser
                </button>
              )}
            </div>
          </div>

          {/* FICHE CONTRÔLE / RÈGLEMENT DU VENDEUR SÉLECTIONNÉ */}
          {selectedVendorFilter && data?.selectedVendor && (
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-roe-surface via-roe-card to-roe-surface border border-roe-gold/40 shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-roe-border/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-roe-gold/20 text-roe-gold flex items-center justify-center font-black text-sm">
                    {data.selectedVendor.vendorCode.slice(-3)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      Fiche de Contrôle Vendeur — {data.selectedVendor.fullName}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        {data.selectedVendor.status}
                      </span>
                    </h3>
                    <p className="text-xs text-roe-textMuted font-mono">
                      Code: {data.selectedVendor.vendorCode} | Taux commission: {data.selectedVendor.defaultCommissionRate}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-1">
                <div className="p-3 sm:p-4 rounded-xl bg-roe-surface border border-roe-border">
                  <p className="text-[11px] font-bold text-roe-textMuted uppercase tracking-wider">Ventes Brutes (Jour)</p>
                  <p className="text-base sm:text-xl font-black text-white font-mono mt-1">
                    {formatCurrency(overview.todaySalesAmount, activeCurrency)}
                  </p>
                  <p className="text-[10px] text-roe-textMuted mt-0.5">{overview.todayTicketsCount} ticket(s) émis</p>
                </div>

                <div className="p-3 sm:p-4 rounded-xl bg-roe-surface border border-roe-border">
                  <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Commission Vendeur</p>
                  <p className="text-base sm:text-xl font-black text-amber-300 font-mono mt-1">
                    {formatCurrency(overview.commissionsAmount, activeCurrency)}
                  </p>
                  <p className="text-[10px] text-roe-textMuted mt-0.5">Taux fixe: {data.selectedVendor.defaultCommissionRate}%</p>
                </div>

                <div className="p-3 sm:p-4 rounded-xl bg-roe-surface border border-roe-border">
                  <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Lots Payés aux Joueurs</p>
                  <p className="text-base sm:text-xl font-black text-rose-300 font-mono mt-1">
                    {formatCurrency(overview.paidPrizesAmount, activeCurrency)}
                  </p>
                  <p className="text-[10px] text-roe-textMuted mt-0.5">Avancés par le vendeur</p>
                </div>

                <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-roe-surface border border-emerald-500/40">
                  <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Net Dû au Propriétaire</p>
                  <p className="text-base sm:text-xl font-black text-emerald-300 font-mono mt-1">
                    {formatCurrency(
                      Math.max(0, overview.todaySalesAmount - overview.commissionsAmount - overview.paidPrizesAmount),
                      activeCurrency
                    )}
                  </p>
                  <p className="text-[10px] text-emerald-200/70 mt-0.5">Ventes - Comm - Lots</p>
                </div>
              </div>
            </div>
          )}

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

          {/* Grille des 9 Indicateurs Clés Formatés en Devise Dynamique (Priorité HTG) */}
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
              value={formatCurrency(overview.todaySalesAmount, activeCurrency)}
              subtitle={`${overview.todayTicketsCount || 0} ticket(s) émis aujourd'hui`}
              icon={TrendingUp}
              variant="gold"
            />
            <StatCard
              title="Ventes du Mois"
              value={formatCurrency(overview.monthSalesAmount, activeCurrency)}
              subtitle="Chiffre d’affaires brut"
              icon={Coins}
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
              value={formatCurrency(overview.paidPrizesAmount, activeCurrency)}
              subtitle="Distribués aux joueurs"
              icon={Wallet}
              variant="rose"
            />
            <StatCard
              title="Commissions"
              value={formatCurrency(overview.commissionsAmount, activeCurrency)}
              subtitle="Attribuées aux vendeurs"
              icon={Percent}
              variant="purple"
            />
            <StatCard
              title="Chiffre d'Affaires Net"
              value={formatCurrency(overview.netRevenue, activeCurrency)}
              subtitle="Ventes - Gains - Commissions"
              icon={Coins}
              variant="emerald"
            />
          </div>

          {/* Deux Colonnes : Dernières Transactions & Piste d'Audit */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne 1 : Flux Financier Récent */}
            <div className="p-6 rounded-3xl bg-roe-surface border border-roe-border/70 shadow-xl flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-roe-card text-roe-gold">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Grand Livre Récent</h3>
                    <p className="text-xs text-roe-textMuted">Flux de trésorerie en temps réel ({activeCurrency})</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 flex-1">
                {data?.recentTransactions && data.recentTransactions.length > 0 ? (
                  data.recentTransactions.map((tx: any) => {
                    const isPositive = ['DEPOSIT', 'COMMISSION', 'REIMBURSEMENT'].includes(tx.type);
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-roe-card/50 border border-roe-border/40 hover:border-roe-border text-xs transition-all"
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
                            {isPositive ? '+' : '-'}{formatCurrency(Math.abs(Number(tx.amount)), activeCurrency)}
                          </p>
                          <p className="text-[10px] text-roe-textMuted font-mono">
                            Solde: {formatCurrency(Number(tx.balanceAfter), activeCurrency)}
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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-roe-card text-roe-purpleLight">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Journal de Sécurité</h3>
                    <p className="text-xs text-roe-textMuted">Piste d'audit des actions administratives</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 flex-1">
                {data?.recentAuditLogs && data.recentAuditLogs.length > 0 ? (
                  data.recentAuditLogs.map((log: any) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-2xl bg-roe-card/50 border border-roe-border/40 hover:border-roe-border text-xs transition-all flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono">{log.action}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-roe-card text-roe-textMuted border border-roe-border/50">
                            {log.user?.username || 'Système'}
                          </span>
                        </div>
                        <p className="text-[11px] text-roe-textMuted mt-1">Cible : {log.resource}</p>
                      </div>
                      <span className="text-[10px] text-roe-textMuted">
                        {new Date(log.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-roe-textMuted">
                    Aucun log d'audit récent.
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
