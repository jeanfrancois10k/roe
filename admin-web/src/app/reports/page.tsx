'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Calendar,
  Users,
  Receipt,
  Trophy,
  Coins,
  RefreshCw,
  Filter,
  Download,
  Dices,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Search,
} from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { StatCard } from '../../components/StatCard';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/currency';

export default function ReportsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtres
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [currency, setCurrency] = useState<string>('HTG');
  const [activeTab, setActiveTab] = useState<'DRAWS' | 'VENDORS'>('DRAWS');
  const [searchFilter, setSearchFilter] = useState('');

  const fetchVendors = async () => {
    try {
      const res = await api.get('/api/v1/admin/vendors?limit=100');
      if (res && res.items) {
        setVendorsList(res.items);
      }
    } catch (err) {
      console.error('Erreur chargement vendeurs:', err);
    }
  };

  const fetchReport = async () => {
    try {
      let url = `/api/v1/reports/sales?period=${period}`;
      if (selectedVendor) {
        url += `&vendorId=${encodeURIComponent(selectedVendor)}`;
      }
      const data = await api.get(url);
      setReportData(data);
      if (data?.currency) {
        setCurrency(data.currency);
      }
    } catch (err) {
      console.error('Erreur chargement rapport:', err);
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
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [period, selectedVendor]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReport();
  };

  const global = reportData?.global || {
    totalSales: 0,
    ticketsCount: 0,
    winningTicketsCount: 0,
    totalWonAmount: 0,
    prizesPaid: 0,
    prizesPaidCount: 0,
    netRevenue: 0,
  };

  const byDraw = reportData?.byDraw || [];
  const byVendor = reportData?.byVendor || [];

  // Filtrage local recherche
  const filteredDraws = byDraw.filter((d: any) =>
    d.gameName.toLowerCase().includes(searchFilter.toLowerCase()) ||
    d.drawNumber.toString().includes(searchFilter)
  );

  const filteredVendors = byVendor.filter((v: any) =>
    v.vendorName.toLowerCase().includes(searchFilter.toLowerCase()) ||
    v.vendorCode.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-roe-dark text-white overflow-hidden font-sans">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          title="Rapports des Ventes"
          onRefresh={handleRefresh}
          isRefreshing={refreshing}
          currency={currency}
        />

        <main className="p-4 sm:p-6 lg:p-8 space-y-6">
          {/* En-tête et Titre de page */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-roe-surface p-5 rounded-2xl border border-roe-border/60">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="text-roe-gold" size={24} />
                <h1 className="text-xl sm:text-2xl font-black text-roe-gold tracking-wide">
                  Rapports & Statistiques des Ventes
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-roe-textMuted mt-1">
                Analyse détaillée du chiffre d'affaires, des tirages et du rendement des vendeurs.
              </p>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-roe-card hover:bg-roe-border/50 border border-roe-border rounded-xl text-xs sm:text-sm font-semibold transition"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin text-roe-gold' : 'text-roe-gold'} />
              Actualiser
            </button>
          </div>

          {/* BARRE DE FILTRES : Période (Jour, Semaine, Mois) & Vendeur */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-roe-card/80 p-4 rounded-xl border border-roe-border/50">
            {/* Sélecteur de Période */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-roe-textMuted font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-roe-gold" /> Période :
              </span>
              <div className="inline-flex rounded-lg bg-roe-surface p-1 border border-roe-border/50">
                <button
                  onClick={() => setPeriod('day')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    period === 'day'
                      ? 'bg-roe-gold text-black shadow-md'
                      : 'text-roe-textMuted hover:text-white'
                  }`}
                >
                  Aujourd'hui (Jour)
                </button>
                <button
                  onClick={() => setPeriod('week')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    period === 'week'
                      ? 'bg-roe-gold text-black shadow-md'
                      : 'text-roe-textMuted hover:text-white'
                  }`}
                >
                  Cette Semaine
                </button>
                <button
                  onClick={() => setPeriod('month')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    period === 'month'
                      ? 'bg-roe-gold text-black shadow-md'
                      : 'text-roe-textMuted hover:text-white'
                  }`}
                >
                  Ce Mois
                </button>
              </div>
            </div>

            {/* Sélecteur de Vendeur */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-roe-textMuted font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Filter size={14} className="text-roe-gold" /> Vendeur :
              </span>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="bg-roe-surface border border-roe-border/70 rounded-lg px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-roe-gold"
              >
                <option value="">Tous les vendeurs (Global)</option>
                {vendorsList.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vendorCode} - {v.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* KPI CARDS (GLOBAL) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Chiffre d'Affaires Brut"
              value={formatCurrency(global.totalSales, currency)}
              subtitle={`${global.ticketsCount} tickets émis`}
              icon={TrendingUp}
              variant="gold"
            />
            <StatCard
              title="Tickets Gagnants"
              value={`${global.winningTicketsCount}`}
              subtitle={`Total gains : ${formatCurrency(global.totalWonAmount, currency)}`}
              icon={Trophy}
              variant="purple"
            />
            <StatCard
              title="Gains Payés aux Joueurs"
              value={formatCurrency(global.prizesPaid, currency)}
              subtitle={`${global.prizesPaidCount} paiements effectués`}
              icon={Coins}
              variant="amber"
            />
            <StatCard
              title="Chiffre d'Affaires Net"
              value={formatCurrency(global.netRevenue, currency)}
              subtitle="Ventes - Lots payés"
              icon={Receipt}
              variant="emerald"
            />
          </div>

          {/* ONGLETS DE DÉTAIL : PAR TIRAGE / PAR VENDEUR */}
          <div className="bg-roe-surface rounded-2xl border border-roe-border/60 overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-roe-border/60 gap-4 bg-roe-card/40">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('DRAWS')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                    activeTab === 'DRAWS'
                      ? 'bg-roe-gold text-black shadow-md'
                      : 'text-roe-textMuted hover:text-white bg-roe-surface'
                  }`}
                >
                  <Dices size={16} />
                  Ventes Par Tirage ({byDraw.length})
                </button>

                {!selectedVendor && (
                  <button
                    onClick={() => setActiveTab('VENDORS')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                      activeTab === 'VENDORS'
                        ? 'bg-roe-gold text-black shadow-md'
                        : 'text-roe-textMuted hover:text-white bg-roe-surface'
                    }`}
                  >
                    <Users size={16} />
                    Ventes Par Vendeur ({byVendor.length})
                  </button>
                )}
              </div>

              {/* Recherche locale */}
              <div className="relative w-full sm:w-64">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-roe-textMuted" />
                <input
                  type="text"
                  placeholder={activeTab === 'DRAWS' ? "Filtrer un tirage..." : "Filtrer un vendeur..."}
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-roe-dark border border-roe-border/70 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-roe-textMuted focus:outline-none focus:border-roe-gold"
                />
              </div>
            </div>

            {/* CONTENU ONGLETS */}
            {loading ? (
              <div className="p-12 text-center text-roe-textMuted">
                <RefreshCw size={28} className="animate-spin text-roe-gold mx-auto mb-2" />
                Chargement des rapports de ventes...
              </div>
            ) : activeTab === 'DRAWS' ? (
              /* TABLEAU PAR TIRAGE */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-roe-border/60 bg-roe-dark/40 text-[11px] font-black uppercase text-roe-textMuted tracking-wider">
                      <th className="py-3 px-4">Loterie / Tirage</th>
                      <th className="py-3 px-4">Heure Programmée</th>
                      <th className="py-3 px-4 text-center">Tickets Vendus</th>
                      <th className="py-3 px-4 text-right">Chiffre d'Affaires</th>
                      <th className="py-3 px-4 text-center">Gagnants</th>
                      <th className="py-3 px-4 text-right">Gains Remportés</th>
                      <th className="py-3 px-4 text-right">% Ventes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-roe-border/40 text-xs sm:text-sm">
                    {filteredDraws.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-roe-textMuted">
                          Aucun tirage trouvé pour les critères sélectionnés.
                        </td>
                      </tr>
                    ) : (
                      filteredDraws.map((d: any) => {
                        const pct = global.totalSales > 0 ? ((d.totalSales / global.totalSales) * 100).toFixed(1) : '0';
                        return (
                          <tr key={d.drawId} className="hover:bg-roe-card/40 transition">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-white flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-roe-gold" />
                                {d.gameName}
                              </div>
                              <span className="text-[11px] text-roe-textMuted font-mono">Tirage #{d.drawNumber}</span>
                            </td>
                            <td className="py-3.5 px-4 text-roe-textMuted text-xs font-mono">
                              {d.scheduledAt ? d.scheduledAt.replace('T', ' ').slice(0, 16) : '-'}
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-white">
                              {d.ticketsCount}
                            </td>
                            <td className="py-3.5 px-4 text-right font-black font-mono text-roe-gold">
                              {formatCurrency(d.totalSales, currency)}
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-purple-400">
                              {d.winningTicketsCount}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-roe-textMuted">
                              {formatCurrency(d.wonAmount, currency)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                              {pct}%
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* TABLEAU PAR VENDEUR */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-roe-border/60 bg-roe-dark/40 text-[11px] font-black uppercase text-roe-textMuted tracking-wider">
                      <th className="py-3 px-4">Vendeur</th>
                      <th className="py-3 px-4 text-center">Tickets Émis</th>
                      <th className="py-3 px-4 text-right">Chiffre d'Affaires</th>
                      <th className="py-3 px-4 text-center">Gagnants</th>
                      <th className="py-3 px-4 text-right">Gains Remportés</th>
                      <th className="py-3 px-4 text-right">Solde Actuel</th>
                      <th className="py-3 px-4 text-right">Part Ventes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-roe-border/40 text-xs sm:text-sm">
                    {filteredVendors.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-roe-textMuted">
                          Aucun vendeur enregistré pour cette période.
                        </td>
                      </tr>
                    ) : (
                      filteredVendors.map((v: any) => {
                        const pct = global.totalSales > 0 ? ((v.totalSales / global.totalSales) * 100).toFixed(1) : '0';
                        return (
                          <tr key={v.vendorId} className="hover:bg-roe-card/40 transition">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-white">{v.vendorName}</div>
                              <span className="text-[11px] text-roe-gold font-mono font-bold">{v.vendorCode}</span>
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-white">
                              {v.ticketsCount}
                            </td>
                            <td className="py-3.5 px-4 text-right font-black font-mono text-roe-gold">
                              {formatCurrency(v.totalSales, currency)}
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-purple-400">
                              {v.winningTicketsCount}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-roe-textMuted">
                              {formatCurrency(v.wonAmount, currency)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-black font-mono text-emerald-400">
                              {formatCurrency(v.currentBalance, currency)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold text-roe-gold">
                              {pct}%
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
