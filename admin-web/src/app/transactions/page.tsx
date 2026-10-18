'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReceiptText,
  Filter,
  RefreshCw,
  Search,
  Download,
  Calendar,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  PlusCircle,
  MinusCircle,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Scale,
  X,
} from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { StatCard } from '../../components/StatCard';
import { api } from '../../lib/api';
import { formatCurrency, getCurrencySymbol } from '../../lib/currency';

interface TransactionItem {
  id: string;
  reference: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description?: string;
  createdAt: string;
  vendor?: {
    id: string;
    vendorCode: string;
    fullName: string;
  };
  operator?: {
    id: string;
    username: string;
  };
  ticket?: {
    id: string;
    ticketNumber: string;
    totalAmount: number;
  };
}

export default function TransactionsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Données
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(25);
  const [vendorsList, setVendorsList] = useState<any[]>([]);
  const [currency, setCurrency] = useState<string>('HTG');

  // Filtres
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [actionVendorId, setActionVendorId] = useState('');
  const [actionAmount, setActionAmount] = useState<number | ''>('');
  const [actionDescription, setActionDescription] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modal Réconciliation
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);

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

  const fetchTransactions = async () => {
    try {
      let queryParams = `?page=${page}&limit=${limit}`;
      if (selectedType) queryParams += `&type=${encodeURIComponent(selectedType)}`;
      if (selectedVendor) queryParams += `&vendorId=${encodeURIComponent(selectedVendor)}`;
      if (startDate) queryParams += `&startDate=${encodeURIComponent(startDate)}`;
      if (endDate) queryParams += `&endDate=${encodeURIComponent(endDate)}`;
      if (searchQuery.trim()) queryParams += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await api.get(`/api/v1/transactions${queryParams}`);
      if (res) {
        setTransactions(res.items || []);
        setTotalCount(res.total || 0);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err: any) {
      console.error('Erreur chargement transactions:', err);
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
    fetchTransactions();
  }, [page, limit, selectedType, selectedVendor, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  // Soumission Dépôt ou Retrait
  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionVendorId) {
      setActionError('Veuillez sélectionner un vendeur');
      return;
    }
    if (!actionAmount || Number(actionAmount) <= 0) {
      setActionError('Veuillez saisir un montant valide');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      const endpoint = actionType === 'DEPOSIT' ? '/api/v1/transactions/deposit' : '/api/v1/transactions/withdraw';
      await api.post(endpoint, {
        vendorId: actionVendorId,
        amount: Number(actionAmount),
        description: actionDescription || (actionType === 'DEPOSIT' ? 'Dépôt / Rechargement solde' : 'Retrait / Règlement caisse'),
      });

      setActionModalOpen(false);
      setActionAmount('');
      setActionDescription('');
      setActionVendorId('');
      fetchTransactions();
    } catch (err: any) {
      setActionError(err.message || 'Erreur lors de l’opération financière');
    } finally {
      setActionLoading(false);
    }
  };

  // Réconciliation Grand Livre
  const handleReconcile = async (vendorId: string) => {
    setReconcileLoading(true);
    setReconcileModalOpen(true);
    try {
      const res = await api.get(`/api/v1/transactions/reconcile/${vendorId}`);
      setReconcileResult(res);
    } catch (err: any) {
      setReconcileResult({ error: err.message || 'Impossible de réconcilier' });
    } finally {
      setReconcileLoading(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['Date', 'Reference', 'Vendeur', 'Type', 'Montant', 'Solde Avant', 'Solde Apres', 'Description', 'Operateur'];
    const rows = transactions.map((t) => [
      t.createdAt ? t.createdAt.replace('T', ' ').slice(0, 19) : '',
      t.reference,
      t.vendor ? `${t.vendor.vendorCode} - ${t.vendor.fullName}` : 'Système',
      t.type,
      t.amount,
      t.balanceBefore,
      t.balanceAfter,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.operator?.username || 'Système',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ledger_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculs synthétiques pour les KPI
  const totalVolumeIn = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalVolumeOut = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'TICKET_SALE':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Vente Ticket</span>;
      case 'TICKET_PAYOUT':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">Gain Payé</span>;
      case 'TICKET_CANCEL':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">Annulation Ticket</span>;
      case 'COMMISSION':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-roe-gold/10 text-roe-gold border border-roe-gold/30">Commission</span>;
      case 'DEPOSIT':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">Dépôt / Rechargement</span>;
      case 'WITHDRAWAL':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">Retrait Caisse</span>;
      case 'ADJUSTMENT':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">Ajustement Manuel</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-roe-surface text-roe-textMuted border border-roe-border/60">{type}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-roe-dark text-white font-sans flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          title="Transactions Ledger"
          onRefresh={handleRefresh}
          isRefreshing={refreshing}
          currency={currency}
        />

        <main className="flex-1 p-3.5 sm:p-6 md:p-8 space-y-6 md:space-y-8 max-w-7xl w-full mx-auto">
          {/* Bannière et Titre */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-roe-surface p-5 rounded-2xl border border-roe-border/60 shadow-xl">
            <div>
              <div className="flex items-center gap-2">
                <ReceiptText className="text-roe-gold" size={26} />
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  Grand Livre Comptable (Ledger)
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-roe-textMuted mt-1">
                Écritures financières immuables en temps réel : ventes, règlements, dépôts, retraits et commissions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => {
                  setActionType('DEPOSIT');
                  setActionModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md"
              >
                <PlusCircle size={15} />
                Nouveau Dépôt
              </button>

              <button
                onClick={() => {
                  setActionType('WITHDRAW');
                  setActionModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md"
              >
                <MinusCircle size={15} />
                Nouveau Retrait
              </button>

              <button
                onClick={handleExportCSV}
                disabled={transactions.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-roe-card hover:bg-roe-border/50 border border-roe-border text-white text-xs font-semibold transition"
              >
                <Download size={15} />
                Export CSV
              </button>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-xl bg-roe-card hover:bg-roe-border/50 border border-roe-border text-roe-gold transition"
                title="Actualiser"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* STATS SYNTHÉTIQUES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Écritures"
              value={`${totalCount}`}
              subtitle="Enregistrements dans le Ledger"
              icon={ReceiptText}
              variant="gold"
            />
            <StatCard
              title="Crédits Comptabilisés"
              value={formatCurrency(totalVolumeIn, currency)}
              subtitle="Ventes & Dépôts de la page"
              icon={ArrowUpRight}
              variant="purple"
            />
            <StatCard
              title="Débits Comptabilisés"
              value={formatCurrency(totalVolumeOut, currency)}
              subtitle="Retraits & Lots payés"
              icon={ArrowDownRight}
              variant="amber"
            />
            <StatCard
              title="Page Active"
              value={`Page ${page} / ${totalPages}`}
              subtitle={`${transactions.length} écritures affichées`}
              icon={Scale}
              variant="gold"
            />
          </div>

          {/* BARRE DE FILTRES AVANCÉE */}
          <div className="bg-roe-surface p-4 sm:p-5 rounded-2xl border border-roe-border/60 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-roe-gold uppercase tracking-wider flex items-center gap-2">
                <Filter size={15} /> Filtres du Grand Livre
              </span>

              {/* Recherche textuelle */}
              <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-roe-textMuted" />
                <input
                  type="text"
                  placeholder="Recherche réf, desc, ticket..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-roe-dark border border-roe-border/70 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-roe-textMuted focus:outline-none focus:border-roe-gold"
                />
              </form>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Type de transaction */}
              <div>
                <label className="block text-[11px] font-bold text-roe-textMuted mb-1">Type d'Écriture</label>
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-roe-gold"
                >
                  <option value="">Tous les types</option>
                  <option value="TICKET_SALE">Vente de Ticket</option>
                  <option value="TICKET_PAYOUT">Gain Payé au Joueur</option>
                  <option value="TICKET_CANCEL">Annulation Ticket</option>
                  <option value="COMMISSION">Commission Vendeur</option>
                  <option value="DEPOSIT">Dépôt / Rechargement</option>
                  <option value="WITHDRAWAL">Retrait / Règlement</option>
                  <option value="ADJUSTMENT">Ajustement Manuel</option>
                </select>
              </div>

              {/* Vendeur */}
              <div>
                <label className="block text-[11px] font-bold text-roe-textMuted mb-1">Vendeur Cible</label>
                <select
                  value={selectedVendor}
                  onChange={(e) => {
                    setSelectedVendor(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-roe-gold"
                >
                  <option value="">Tous les vendeurs</option>
                  {vendorsList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vendorCode} - {v.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Début */}
              <div>
                <label className="block text-[11px] font-bold text-roe-textMuted mb-1">Date Début</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                />
              </div>

              {/* Date Fin */}
              <div>
                <label className="block text-[11px] font-bold text-roe-textMuted mb-1">Date Fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                />
              </div>
            </div>

            {/* Réinitialisation rapide des filtres */}
            {(selectedType || selectedVendor || startDate || endDate || searchQuery) && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    setSelectedType('');
                    setSelectedVendor('');
                    setStartDate('');
                    setEndDate('');
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="text-xs text-roe-gold hover:underline font-semibold"
                >
                  Réinitialiser tous les filtres
                </button>
              </div>
            )}
          </div>

          {/* TABLEAU DES TRANSACTIONS */}
          <div className="bg-roe-surface rounded-2xl border border-roe-border/60 overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-16 text-center text-roe-textMuted">
                <RefreshCw size={32} className="animate-spin text-roe-gold mx-auto mb-3" />
                Chargement des écritures du Grand Livre...
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-16 text-center text-roe-textMuted">
                <ReceiptText size={40} className="text-roe-gold/50 mx-auto mb-3" />
                <p className="text-base font-bold text-white">Aucune transaction trouvée</p>
                <p className="text-xs text-roe-textMuted mt-1">
                  Modifiez vos critères de recherche ou réinitialisez les filtres.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-roe-border/60 bg-roe-dark/40 text-[11px] font-black uppercase text-roe-textMuted tracking-wider">
                      <th className="py-3.5 px-4">Date & Heure</th>
                      <th className="py-3.5 px-4">Référence</th>
                      <th className="py-3.5 px-4">Vendeur</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4 text-right">Montant</th>
                      <th className="py-3.5 px-4 text-right">Solde Avant</th>
                      <th className="py-3.5 px-4 text-right">Solde Après</th>
                      <th className="py-3.5 px-4">Description / Ticket</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-roe-border/40 text-xs">
                    {transactions.map((t) => {
                      const isPositive = t.amount > 0;
                      return (
                        <tr key={t.id} className="hover:bg-roe-card/50 transition">
                          {/* Date */}
                          <td className="py-3.5 px-4 text-roe-textMuted font-mono whitespace-nowrap">
                            {t.createdAt ? t.createdAt.replace('T', ' ').slice(0, 19) : '-'}
                          </td>

                          {/* Référence */}
                          <td className="py-3.5 px-4 font-mono font-bold text-roe-gold whitespace-nowrap">
                            {t.reference}
                          </td>

                          {/* Vendeur */}
                          <td className="py-3.5 px-4">
                            {t.vendor ? (
                              <div>
                                <div className="font-bold text-white">{t.vendor.fullName}</div>
                                <div className="text-[11px] text-roe-textMuted font-mono">{t.vendor.vendorCode}</div>
                              </div>
                            ) : (
                              <span className="text-roe-textMuted italic">Système</span>
                            )}
                          </td>

                          {/* Type */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {getTypeBadge(t.type)}
                          </td>

                          {/* Montant */}
                          <td className={`py-3.5 px-4 text-right font-black font-mono whitespace-nowrap text-sm ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {isPositive ? '+' : ''}{formatCurrency(t.amount, currency)}
                          </td>

                          {/* Solde Avant */}
                          <td className="py-3.5 px-4 text-right font-mono text-roe-textMuted whitespace-nowrap">
                            {formatCurrency(t.balanceBefore, currency)}
                          </td>

                          {/* Solde Après */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                            {formatCurrency(t.balanceAfter, currency)}
                          </td>

                          {/* Description */}
                          <td className="py-3.5 px-4 max-w-xs truncate text-roe-textMuted" title={t.description || ''}>
                            {t.description || '-'}
                            {t.ticket && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-roe-card text-[10px] font-mono text-roe-gold">
                                #{t.ticket.ticketNumber}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {t.vendor && (
                              <button
                                onClick={() => handleReconcile(t.vendor!.id)}
                                className="px-2.5 py-1 rounded-lg bg-roe-card hover:bg-roe-border/60 text-[11px] text-roe-gold font-bold transition border border-roe-border/50"
                                title="Réconcilier le solde de ce vendeur"
                              >
                                Réconcilier
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* PAGINATION */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-roe-border/60 bg-roe-dark/30 text-xs text-roe-textMuted">
              <div>
                Affichage de <span className="font-bold text-white">{transactions.length}</span> sur <span className="font-bold text-white">{totalCount}</span> transactions
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg bg-roe-card hover:bg-roe-border/50 border border-roe-border disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-bold text-white px-2">
                  Page {page} sur {totalPages || 1}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg bg-roe-card hover:bg-roe-border/50 border border-roe-border disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* MODAL DÉPÔT / RETRAIT */}
      {actionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-roe-surface border border-roe-border/80 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setActionModalOpen(false)}
              className="absolute right-4 top-4 text-roe-textMuted hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              {actionType === 'DEPOSIT' ? (
                <PlusCircle className="text-emerald-400" size={24} />
              ) : (
                <MinusCircle className="text-rose-400" size={24} />
              )}
              <h2 className="text-lg font-black text-white">
                {actionType === 'DEPOSIT' ? 'Nouveau Dépôt / Crédit Vendeur' : 'Nouveau Retrait / Récupération Caisse'}
              </h2>
            </div>

            {actionError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleActionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-roe-textMuted mb-1.5">Vendeur Bénéficiaire</label>
                <select
                  value={actionVendorId}
                  onChange={(e) => setActionVendorId(e.target.value)}
                  required
                  className="w-full bg-roe-dark border border-roe-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                >
                  <option value="">Sélectionnez un vendeur...</option>
                  {vendorsList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vendorCode} - {v.fullName} (Solde actuel : {formatCurrency(v.currentBalance, currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-roe-textMuted mb-1.5">
                  Montant ({getCurrencySymbol(currency)})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="Ex: 5000"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-roe-dark border border-roe-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-roe-gold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-roe-textMuted mb-1.5">Motif / Description</label>
                <input
                  type="text"
                  placeholder={actionType === 'DEPOSIT' ? 'Rechargement de compte' : 'Règlement de caisse'}
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  className="w-full bg-roe-dark border border-roe-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setActionModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-roe-card border border-roe-border text-xs font-bold text-roe-textMuted hover:text-white transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition shadow-lg ${
                    actionType === 'DEPOSIT'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {actionLoading ? 'Validation...' : actionType === 'DEPOSIT' ? 'Valider le Dépôt' : 'Valider le Retrait'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RÉCONCILIATION */}
      {reconcileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-roe-surface border border-roe-border/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setReconcileModalOpen(false);
                setReconcileResult(null);
              }}
              className="absolute right-4 top-4 text-roe-textMuted hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <Scale className="text-roe-gold" size={24} />
              <h2 className="text-lg font-black text-white">Audit & Réconciliation Ledger</h2>
            </div>

            {reconcileLoading ? (
              <div className="p-8 text-center text-roe-textMuted">
                <RefreshCw size={28} className="animate-spin text-roe-gold mx-auto mb-2" />
                Vérification de la somme cryptographique des écritures...
              </div>
            ) : reconcileResult?.error ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {reconcileResult.error}
              </div>
            ) : reconcileResult ? (
              <div className="space-y-4 text-xs">
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                  reconcileResult.isBalanced
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}>
                  {reconcileResult.isBalanced ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                  <div>
                    <div className="font-black text-sm">
                      {reconcileResult.isBalanced ? 'Grand Livre 100% Équilibré' : 'Écart Détecté'}
                    </div>
                    <div>{reconcileResult.status || (reconcileResult.isBalanced ? 'Le solde actuel concorde parfaitement avec la somme des écritures.' : 'Une divergence existe entre le solde calculé et les écritures.')}</div>
                  </div>
                </div>

                <div className="bg-roe-card p-4 rounded-xl border border-roe-border/60 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-roe-textMuted">Vendeur :</span>
                    <span className="font-bold text-white">{reconcileResult.vendorCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-roe-textMuted">Solde Enregistré :</span>
                    <span className="font-mono font-bold text-roe-gold">{formatCurrency(reconcileResult.currentBalance || 0, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-roe-textMuted">Somme des Transactions :</span>
                    <span className="font-mono font-bold text-white">{formatCurrency(reconcileResult.calculatedBalance || 0, currency)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-roe-border/50">
                    <span className="text-roe-textMuted">Écart (Delta) :</span>
                    <span className={`font-mono font-black ${
                      (reconcileResult.difference || 0) === 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {formatCurrency(reconcileResult.difference || 0, currency)}
                    </span>
                  </div>
                </div>

                <div className="text-right pt-2">
                  <button
                    onClick={() => {
                      setReconcileModalOpen(false);
                      setReconcileResult(null);
                    }}
                    className="px-5 py-2 rounded-xl bg-roe-card hover:bg-roe-border/60 text-white font-bold border border-roe-border"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
