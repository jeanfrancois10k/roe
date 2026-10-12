'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Plus,
  ShieldAlert,
  CheckCircle,
  Smartphone,
  Sliders,
  DollarSign,
  AlertCircle,
  MoreVertical,
  RefreshCw,
} from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { VendorModal } from '../../components/VendorModal';
import { AdjustBalanceModal } from '../../components/AdjustBalanceModal';
import { api } from '../../lib/api';
import { getAdminSocket } from '../../lib/socket';
import { formatCurrency } from '../../lib/currency';

export default function VendorsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<any[]>([]);
  const [currency, setCurrency] = useState<string>('HTG');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [vendorToEdit, setVendorToEdit] = useState<any>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [vendorToAdjust, setVendorToAdjust] = useState<any>(null);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      let query = `?search=${encodeURIComponent(search)}`;
      if (statusFilter) query += `&status=${statusFilter}`;
      const res = await api.get(`/api/v1/admin/vendors${query}`);
      setVendors(res.items || []);
    } catch (err: any) {
      console.error('Erreur chargement vendeurs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('roe_access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchVendors();

    api.get('/api/v1/settings')
      .then((res) => {
        if (res.defaultCurrency) setCurrency(res.defaultCurrency);
      })
      .catch(() => {});

    const socket = getAdminSocket();
    socket.on('vendor:status-change', () => fetchVendors());
    socket.on('vendor:suspended', () => fetchVendors());
    socket.on('vendor:reactivated', () => fetchVendors());

    return () => {
      socket.off('vendor:status-change');
      socket.off('vendor:suspended');
      socket.off('vendor:reactivated');
    };
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVendors();
  };

  const handleCurrencyChange = async (newCurr: string) => {
    setCurrency(newCurr);
    try {
      await api.patch('/api/v1/settings/currency', { currency: newCurr });
      fetchVendors();
    } catch (err) {
      console.error('Erreur changement devise:', err);
    }
  };

  // KILL SWITCH ACTION
  const handleToggleSuspend = async (vendor: any) => {
    const isSuspended = vendor.status === 'SUSPENDED';
    const actionName = isSuspended ? 'réactiver' : 'SUSPENDRE IMMÉDIATEMENT';
    const confirmMsg = `Êtes-vous sûr de vouloir ${actionName} le vendeur ${vendor.vendorCode} (${vendor.fullName}) ?\n${
      !isSuspended ? 'Le terminal sera verrouillé en moins d’une seconde.' : ''
    }`;

    if (!window.confirm(confirmMsg)) return;

    try {
      if (isSuspended) {
        await api.post(`/api/v1/admin/vendors/${vendor.id}/reactivate`);
      } else {
        await api.post(`/api/v1/admin/vendors/${vendor.id}/suspend`, {
          reason: 'Suspension manuelle par l’administrateur',
        });
      }
      fetchVendors();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-roe-bg flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen">
        <Header
          onToggleSidebar={() => setSidebarOpen(true)}
          title="Gestion des Vendeurs & Points de Vente"
          onRefresh={fetchVendors}
          isRefreshing={loading}
          currency={currency}
          onCurrencyChange={handleCurrencyChange}
        />

        <main className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Top Bar : Recherche & Bouton Nouveau Vendeur */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par code, nom, téléphone..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-roe-surface border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none placeholder:text-roe-textMuted"
              />
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-roe-textMuted"
              />
            </form>

            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-roe-surface border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
              >
                <option value="">Tous les statuts</option>
                <option value="ACTIVE">Actifs</option>
                <option value="SUSPENDED">Suspendus</option>
                <option value="INACTIVE">Inactifs</option>
              </select>

              <button
                onClick={() => {
                  setVendorToEdit(null);
                  setIsVendorModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-roe-gold to-roe-goldDark text-roe-bg text-sm font-bold shadow-lg hover:scale-105 transition-all whitespace-nowrap"
              >
                <Plus size={16} />
                <span>Nouveau Vendeur</span>
              </button>
            </div>
          </div>

          {/* Tableau des Vendeurs */}
          <div className="rounded-3xl bg-roe-surface border border-roe-border/70 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-roe-border/80 bg-roe-card/40 text-[11px] uppercase tracking-wider text-roe-textMuted font-bold">
                    <th className="p-4 pl-6">Code & Nom</th>
                    <th className="p-4">Point de Vente</th>
                    <th className="p-4">Statut & En Ligne</th>
                    <th className="p-4">Solde Actuel</th>
                    <th className="p-4">Plafonds</th>
                    <th className="p-4">Terminal Android</th>
                    <th className="p-4 pr-6 text-right">Contrôle à Distance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-roe-border/40">
                  {vendors.length > 0 ? (
                    vendors.map((v) => {
                      const isSuspended = v.status === 'SUSPENDED';
                      const device = v.devices?.[0];
                      const isOnline = device?.isOnline || false;

                      return (
                        <tr key={v.id} className="hover:bg-roe-card/30 transition-colors">
                          {/* Code & Nom */}
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-roe-card border border-roe-border flex items-center justify-center font-bold text-roe-gold font-mono text-xs">
                                {v.vendorCode?.replace('VEND-', '') || 'V'}
                              </div>
                              <div>
                                <p className="font-bold text-white text-sm">{v.fullName}</p>
                                <p className="text-xs text-roe-textMuted font-mono">{v.phone}</p>
                              </div>
                            </div>
                          </td>

                          {/* Point de Vente */}
                          <td className="p-4 text-roe-textMuted text-xs max-w-xs truncate">
                            {v.posAddress}
                          </td>

                          {/* Statut & En Ligne */}
                          <td className="p-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                                  isSuspended
                                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                                    : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                                }`}
                              >
                                {v.status}
                              </span>
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
                                  }`}
                                />
                                <span className={isOnline ? 'text-emerald-400' : 'text-slate-500'}>
                                  {isOnline ? 'Connecté' : 'Hors-ligne'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Solde */}
                          <td className="p-4">
                            <p className="font-mono font-bold text-roe-gold text-sm">
                              {formatCurrency(v.currentBalance, currency)}
                            </p>
                            <p className="text-[10px] text-roe-textMuted font-mono">
                              Découvert: {formatCurrency(v.creditLimit, currency)}
                            </p>
                          </td>

                          {/* Plafonds */}
                          <td className="p-4 text-xs font-mono text-roe-textMuted">
                            <p>Jour: {formatCurrency(v.dailySalesLimit, currency)}</p>
                            <p>Ticket: {formatCurrency(v.maxTicketAmount, currency)}</p>
                            <p className="text-roe-gold">Com: {Number(v.defaultCommissionRate)}%</p>
                          </td>

                          {/* Terminal Android */}
                          <td className="p-4">
                            {device ? (
                              <div className="flex items-center gap-2">
                                <Smartphone size={16} className="text-purple-400" />
                                <div className="text-xs">
                                  <p className="font-semibold text-white">{device.deviceModel}</p>
                                  <p className="text-[10px] text-roe-textMuted font-mono">
                                    {device.deviceUuid?.substring(0, 16)}...
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-roe-textMuted italic">Non lié</span>
                            )}
                          </td>

                          {/* Actions / Kill Switch */}
                          <td className="p-4 pr-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Bouton Régulariser */}
                              <button
                                onClick={() => {
                                  setVendorToAdjust(v);
                                  setIsAdjustModalOpen(true);
                                }}
                                title="Régulariser Solde"
                                className="p-2 rounded-xl bg-roe-card hover:bg-roe-cardHover text-roe-textMuted hover:text-white border border-roe-border transition-colors"
                              >
                                <DollarSign size={15} />
                              </button>

                              {/* Bouton Modifier */}
                              <button
                                onClick={() => {
                                  setVendorToEdit(v);
                                  setIsVendorModalOpen(true);
                                }}
                                title="Modifier Limites"
                                className="p-2 rounded-xl bg-roe-card hover:bg-roe-cardHover text-roe-textMuted hover:text-white border border-roe-border transition-colors"
                              >
                                <Sliders size={15} />
                              </button>

                              {/* KILL SWITCH BOUTON */}
                              <button
                                onClick={() => handleToggleSuspend(v)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                  isSuspended
                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                                    : 'bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20 shadow-sm'
                                }`}
                              >
                                <ShieldAlert size={14} />
                                <span>{isSuspended ? 'Réactiver' : 'SUSPENDRE'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-sm text-roe-textMuted">
                        {loading ? 'Chargement des vendeurs...' : 'Aucun vendeur trouvé.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Modales */}
      <VendorModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        onSuccess={fetchVendors}
        vendorToEdit={vendorToEdit}
        currency={currency}
      />

      <AdjustBalanceModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        onSuccess={fetchVendors}
        vendor={vendorToAdjust}
        currency={currency}
      />
    </div>
  );
}
