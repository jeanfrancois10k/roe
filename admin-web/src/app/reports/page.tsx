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
  Printer,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { StatCard } from '../../components/StatCard';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/currency';
import { formatHaitiDateTime } from '../../lib/date';

export default function ReportsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtres
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'custom'>('day');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [selectedDraw, setSelectedDraw] = useState<string>('');
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [drawsList, setDrawsList] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [currency, setCurrency] = useState<string>('HTG');
  const [activeTab, setActiveTab] = useState<'DRAWS' | 'VENDORS' | 'WINNERS'>('DRAWS');
  const [searchFilter, setSearchFilter] = useState('');

  // Modal d'impression thermique (Photos 1 et 2)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printType, setPrintType] = useState<'SALES' | 'WINNERS'>('SALES');
  const [copied, setCopied] = useState(false);

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

  const fetchDraws = async () => {
    try {
      const res = await api.get('/api/v1/draws?limit=50');
      if (Array.isArray(res)) setDrawsList(res);
      else if (res?.items) setDrawsList(res.items);
    } catch (err) {
      console.error('Erreur chargement tirages:', err);
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      let url = `/api/v1/reports/sales?period=${period}`;
      if (period === 'custom' && startDate) {
        url += `&startDate=${encodeURIComponent(startDate)}`;
        if (endDate) {
          url += `&endDate=${encodeURIComponent(endDate)}`;
        }
      }
      if (selectedVendor) {
        url += `&vendorId=${encodeURIComponent(selectedVendor)}`;
      }
      if (selectedDraw) {
        url += `&drawId=${encodeURIComponent(selectedDraw)}`;
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
    fetchDraws();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [period, selectedVendor, selectedDraw]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReport();
  };

  const handleApplyCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) {
      alert('Veuillez sélectionner au moins une date de début.');
      return;
    }
    setPeriod('custom');
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
    nombreFichesVendues: 0,
    nombreFichesGagnantes: 0,
    ventesTotal: 0,
    ventesCash: 0,
    ventesMoncash: 0,
    paiementsPertes: 0,
    balanceCash: 0,
    commission: 0,
    commissionRate: 8,
    balanceTotale: 0,
  };

  const byDraw = reportData?.byDraw || [];
  const byVendor = reportData?.byVendor || [];
  const winningTickets = reportData?.winningTickets || [];

  const lotteryName = reportData?.lottery?.name || 'TOTAL CENTER LOTO';
  const vendorCodeDisplay = reportData?.vendor?.code || (selectedVendor ? 'Vendeur' : '404 (Global)');

  const formatDateDisplay = (isoStr: string) => {
    if (!isoStr) return '';
    const clean = isoStr.slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return clean;
  };

  const startDisplay = formatDateDisplay(reportData?.startDate || startDate);
  const endDisplay = formatDateDisplay(reportData?.endDate || endDate || startDate);
  const nowDisplay = formatHaitiDateTime(new Date());

  // Filtrage local recherche
  const filteredDraws = byDraw.filter((d: any) =>
    d.gameName.toLowerCase().includes(searchFilter.toLowerCase()) ||
    d.drawNumber.toString().includes(searchFilter)
  );

  const filteredVendors = byVendor.filter((v: any) =>
    v.vendorName.toLowerCase().includes(searchFilter.toLowerCase()) ||
    v.vendorCode.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredWinners = winningTickets.filter((w: any) =>
    w.ticketNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
    w.drawName?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Texte thermique pour copie / impression
  const thermalSalesReportText = `
${lotteryName.toUpperCase()}*****

Données MAJ : ${nowDisplay}
Rapo du ${startDisplay} au ${endDisplay}
${selectedDraw ? (drawsList.find(d => d.id === selectedDraw)?.game?.name || 'Tirage') : 'Tous les tirages'}
Banque : ${vendorCodeDisplay}
================================
Nombre fiches vendues :
${global.nombreFichesVendues || global.ticketsCount}
--------------------------------
Nombre fiches gagnantes :
${global.nombreFichesGagnantes || global.winningTicketsCount}
================================
Vant :
Total : ${Math.round(global.ventesTotal || global.totalSales)}
Cash : ${Math.round(global.ventesCash || global.totalSales)}
Moncash : 0
--------------------------------
Paiements pet :
${Math.round(global.paiementsPertes || global.prizesPaid)}
--------------------------------
Balance cash
(ventes - pertes)
${Math.round(global.balanceCash || (global.totalSales - global.prizesPaid))}
--------------------------------
Commission :
${Math.round(global.commission || 0)}
--------------------------------
Balance totale
(balance cash - commission)
${Math.round(global.balanceTotale || (global.totalSales - global.prizesPaid))}
================================
`.trim();

  const thermalWinnersReportText = `
${lotteryName.toUpperCase()}*****

${nowDisplay}
Tirage : ${selectedDraw ? (drawsList.find(d => d.id === selectedDraw)?.game?.name || 'Tirage') : 'Tous les tirages'}
Banque : ${vendorCodeDisplay}

Tickets gagnants (tous tirages)
--------------------------------
${winningTickets.length === 0 ? 'Aucun ticket gagnant enregistré.\n--------------------------------' : winningTickets.map((t: any) => `${t.ticketNumber} ${t.createdAt ? t.createdAt.slice(11, 16) + '-' + formatDateDisplay(t.createdAt) : ''}\nMise ${Math.round(t.totalAmount)} Gen ${Math.round(t.wonAmount)} ${t.payoutStatus}\n--------------------------------`).join('\n')}
`.trim();

  return (
    <div className="min-h-screen bg-roe-dark text-white font-sans flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          title="Rapports des Ventes & Balances"
          onRefresh={handleRefresh}
          isRefreshing={refreshing}
          currency={currency}
        />

        <main className="flex-1 p-3.5 sm:p-6 md:p-8 space-y-6 md:space-y-8 max-w-7xl w-full mx-auto">
          {/* En-tête et Titre de page */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-roe-surface p-5 rounded-2xl border border-roe-border/60 shadow-lg">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="text-roe-gold" size={24} />
                <h1 className="text-xl sm:text-2xl font-black text-roe-gold tracking-wide">
                  Rapports & Balances Périodiques
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-roe-textMuted mt-1">
                Génération, analyse et impression thermique conforme aux standards Borlette (Total Center).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setPrintType('SALES');
                  setIsPrintModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-roe-gold hover:bg-roe-goldDark text-roe-bg rounded-xl text-xs font-black shadow-md transition"
              >
                <Printer size={15} />
                <span>Imprimer Reçu Ventes</span>
              </button>

              <button
                onClick={() => {
                  setPrintType('WINNERS');
                  setIsPrintModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-roe-card hover:bg-roe-border/50 border border-roe-border text-roe-gold rounded-xl text-xs font-bold transition"
              >
                <Trophy size={15} />
                <span>Reçu Fiches Gagnantes</span>
              </button>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 bg-roe-card hover:bg-roe-border/50 border border-roe-border rounded-xl text-xs font-semibold text-roe-textMuted hover:text-white transition"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin text-roe-gold' : ''} />
              </button>
            </div>
          </div>

          {/* BARRE DE FILTRES : Période rapide vs Sélection personnalisée entre plusieurs dates */}
          <div className="bg-roe-card/80 p-4 sm:p-5 rounded-2xl border border-roe-border/60 space-y-4 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Sélecteur de Période Rapide */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-roe-textMuted font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-roe-gold" /> Période :
                </span>
                <div className="inline-flex rounded-xl bg-roe-surface p-1 border border-roe-border/50 text-xs">
                  <button
                    onClick={() => setPeriod('day')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${
                      period === 'day' ? 'bg-roe-gold text-black shadow' : 'text-roe-textMuted hover:text-white'
                    }`}
                  >
                    Aujourd'hui
                  </button>
                  <button
                    onClick={() => setPeriod('week')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${
                      period === 'week' ? 'bg-roe-gold text-black shadow' : 'text-roe-textMuted hover:text-white'
                    }`}
                  >
                    Cette Semaine
                  </button>
                  <button
                    onClick={() => setPeriod('month')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${
                      period === 'month' ? 'bg-roe-gold text-black shadow' : 'text-roe-textMuted hover:text-white'
                    }`}
                  >
                    Ce Mois
                  </button>
                  <button
                    onClick={() => setPeriod('custom')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition ${
                      period === 'custom' ? 'bg-roe-gold text-black shadow' : 'text-roe-textMuted hover:text-white'
                    }`}
                  >
                    📅 Entre Plusieurs Dates
                  </button>
                </div>
              </div>

              {/* Filtre Vendeur & Filtre Tirage */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-roe-textMuted font-bold uppercase">Vendeur :</span>
                  <select
                    value={selectedVendor}
                    onChange={(e) => setSelectedVendor(e.target.value)}
                    className="bg-roe-surface border border-roe-border/70 rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-roe-gold"
                  >
                    <option value="">Tous les vendeurs (Global)</option>
                    {vendorsList.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vendorCode} - {v.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-roe-textMuted font-bold uppercase">Tirage :</span>
                  <select
                    value={selectedDraw}
                    onChange={(e) => setSelectedDraw(e.target.value)}
                    className="bg-roe-surface border border-roe-border/70 rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-roe-gold"
                  >
                    <option value="">Tous les tirages</option>
                    {drawsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        #{d.drawNumber} - {d.game?.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Saisie de Dates Personnalisées (Entre Plusieurs Dates) */}
            {period === 'custom' && (
              <form onSubmit={handleApplyCustomDates} className="pt-3 border-t border-roe-border/40 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-roe-gold font-bold">Du :</span>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-roe-surface border border-roe-border rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-roe-gold focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-roe-gold font-bold">Au :</span>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-roe-surface border border-roe-border rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:border-roe-gold focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-roe-gold to-amber-500 text-roe-bg text-xs font-black shadow hover:opacity-90 transition"
                >
                  Appliquer la Plage
                </button>

                <span className="text-xs text-roe-textMuted font-mono">
                  (Rapo du {startDisplay || '--'} au {endDisplay || '--'})
                </span>
              </form>
            )}
          </div>

          {/* KPI CARDS (GLOBAL & THERMIQUE) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Chiffre d'Affaires Brut"
              value={formatCurrency(global.ventesTotal || global.totalSales, currency)}
              subtitle={`${global.nombreFichesVendues || global.ticketsCount} fiches vendues`}
              icon={TrendingUp}
              variant="gold"
            />
            <StatCard
              title="Fiches Gagnantes"
              value={`${global.nombreFichesGagnantes || global.winningTicketsCount}`}
              subtitle={`Pertes : ${formatCurrency(global.paiementsPertes || global.prizesPaid, currency)}`}
              icon={Trophy}
              variant="purple"
            />
            <StatCard
              title="Balance Cash (Ventes - Pertes)"
              value={formatCurrency(global.balanceCash || (global.totalSales - global.prizesPaid), currency)}
              subtitle="Cash net en caisse"
              icon={Coins}
              variant="amber"
            />
            <StatCard
              title="Balance Totale (- Commission)"
              value={formatCurrency(global.balanceTotale || (global.totalSales - global.prizesPaid), currency)}
              subtitle={`Commission : ${formatCurrency(global.commission || 0, currency)}`}
              icon={Receipt}
              variant="emerald"
            />
          </div>

          {/* ONGLETS DE DÉTAIL : PAR TIRAGE / FICHES GAGNANTES / PAR VENDEUR */}
          <div className="bg-roe-surface rounded-3xl border border-roe-border/60 overflow-hidden shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-roe-border/60 gap-4 bg-roe-card/40">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveTab('DRAWS')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                    activeTab === 'DRAWS'
                      ? 'bg-roe-gold text-black shadow-md'
                      : 'text-roe-textMuted hover:text-white bg-roe-surface border border-roe-border'
                  }`}
                >
                  <Dices size={16} />
                  <span>Ventes Par Tirage ({byDraw.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('WINNERS')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                    activeTab === 'WINNERS'
                      ? 'bg-roe-gold text-black shadow-md'
                      : 'text-roe-textMuted hover:text-white bg-roe-surface border border-roe-border'
                  }`}
                >
                  <Trophy size={16} />
                  <span>Fiches Gagnantes ({winningTickets.length})</span>
                </button>

                {!selectedVendor && (
                  <button
                    onClick={() => setActiveTab('VENDORS')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                      activeTab === 'VENDORS'
                        ? 'bg-roe-gold text-black shadow-md'
                        : 'text-roe-textMuted hover:text-white bg-roe-surface border border-roe-border'
                    }`}
                  >
                    <Users size={16} />
                    <span>Ventes Par Vendeur ({byVendor.length})</span>
                  </button>
                )}
              </div>

              {/* Recherche locale */}
              <div className="relative w-full sm:w-64">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-roe-textMuted" />
                <input
                  type="text"
                  placeholder="Rechercher..."
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
                Chargement des données du rapport...
              </div>
            ) : activeTab === 'DRAWS' ? (
              /* TABLEAU PAR TIRAGE */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="border-b border-roe-border/60 bg-roe-dark/40 text-[11px] font-black uppercase text-roe-textMuted tracking-wider">
                      <th className="py-3 px-4">Loterie / Tirage</th>
                      <th className="py-3 px-4">Date & Session</th>
                      <th className="py-3 px-4 text-center">Fiches Vendues</th>
                      <th className="py-3 px-4 text-right">Vente Totale</th>
                      <th className="py-3 px-4 text-center">Gagnants</th>
                      <th className="py-3 px-4 text-right">Lots Remportés</th>
                      <th className="py-3 px-4 text-right">% Ventes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-roe-border/40">
                    {filteredDraws.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-roe-textMuted">
                          Aucun tirage trouvé pour la période sélectionnée.
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
            ) : activeTab === 'WINNERS' ? (
              /* TABLEAU FICHES GAGNANTES (PHOTO 1) */
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="border-b border-roe-border/60 bg-roe-dark/40 text-[11px] font-black uppercase text-roe-textMuted tracking-wider">
                      <th className="py-3 px-4">N° Ticket</th>
                      <th className="py-3 px-4">Date & Heure</th>
                      <th className="py-3 px-4">Tirage</th>
                      <th className="py-3 px-4 text-right">Mise</th>
                      <th className="py-3 px-4 text-right">Gains Remportés</th>
                      <th className="py-3 px-4 text-center">Statut Paiement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-roe-border/40">
                    {filteredWinners.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-roe-textMuted">
                          Aucun ticket gagnant pour cette période.
                        </td>
                      </tr>
                    ) : (
                      filteredWinners.map((t: any, i: number) => {
                        const isPaid = t.payoutStatus === 'P';
                        return (
                          <tr key={i} className="hover:bg-roe-card/40 transition">
                            <td className="py-3 px-4 font-mono font-bold text-white">
                              {t.ticketNumber}
                            </td>
                            <td className="py-3 px-4 text-roe-textMuted font-mono">
                              {t.createdAt ? t.createdAt.slice(0, 16).replace('T', ' ') : '-'}
                            </td>
                            <td className="py-3 px-4 text-white">
                              {t.drawName || '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-white">
                              {formatCurrency(t.totalAmount, currency)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-roe-gold">
                              {formatCurrency(t.wonAmount, currency)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  isPaid
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                }`}
                              >
                                {isPaid ? 'P (Payé)' : 'NP (Non Payé)'}
                              </span>
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
                <table className="w-full text-left border-collapse text-xs md:text-sm">
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
                  <tbody className="divide-y divide-roe-border/40">
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
                              {formatCurrency(Math.abs(Number(v.currentBalance || 0)), currency)}
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

      {/* MODAL D'IMPRESSION REÇU THERMIQUE OFFICIEL (PHOTOS 1 & 2) */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-roe-surface border border-roe-border rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Printer size={18} className="text-roe-gold" />
                <span>{printType === 'SALES' ? 'Reçu Thermique : Ventes & Balances' : 'Reçu Thermique : Fiches Gagnantes'}</span>
              </h3>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="p-1 rounded-lg text-roe-textMuted hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Aperçu format papier thermique blanc */}
            <div className="p-4 rounded-xl bg-white text-black font-mono text-xs leading-relaxed max-h-[60vh] overflow-y-auto whitespace-pre-wrap select-all shadow-inner border border-gray-300">
              {printType === 'SALES' ? thermalSalesReportText : thermalWinnersReportText}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-roe-border/60">
              <button
                onClick={() => {
                  const textToCopy = printType === 'SALES' ? thermalSalesReportText : thermalWinnersReportText;
                  navigator.clipboard.writeText(textToCopy);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-roe-card hover:bg-roe-border/50 text-white text-xs font-bold border border-roe-border"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copied ? 'Copié !' : 'Copier'}</span>
              </button>

              <button
                onClick={() => {
                  window.print();
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-roe-gold to-amber-500 text-roe-bg text-xs font-black shadow-lg hover:opacity-90 transition"
              >
                <Printer size={15} />
                <span>Imprimer Reçu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
