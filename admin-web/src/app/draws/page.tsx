'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dices,
  Play,
  Lock,
  CheckCircle,
  Clock,
  Plus,
  RefreshCw,
  AlertCircle,
  Hash,
  ChevronRight,
  Send,
  Calendar,
  Sparkles,
  Trophy,
  ShieldAlert,
  Ban,
  Trash2,
} from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/currency';

export default function DrawsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [games, setGames] = useState<any[]>([]);
  const [draws, setDraws] = useState<any[]>([]);
  const [selectedGameFilter, setSelectedGameFilter] = useState('');
  const [currency, setCurrency] = useState('HTG');

  // Gestion des Numéros Bloqués & Plafonds
  const [activeTab, setActiveTab] = useState<'DRAWS' | 'LIMITS'>('DRAWS');
  const [blockedNumbers, setBlockedNumbers] = useState<any[]>([]);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockNumberInput, setBlockNumberInput] = useState('');
  const [blockGameId, setBlockGameId] = useState('');
  const [blockDrawId, setBlockDrawId] = useState('');
  const [blockMaxAmount, setBlockMaxAmount] = useState('');
  const [blockIsStrict, setBlockIsStrict] = useState(true);
  const [blockNote, setBlockNote] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);

  // Modal de Création de Tirage
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createGameId, setCreateGameId] = useState('');
  const [createDrawNumber, setCreateDrawNumber] = useState('');
  const [createClosingTime, setCreateClosingTime] = useState('');
  const [createActionLoading, setCreateActionLoading] = useState(false);

  // Modal de Saisie des Résultats Gagnants
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [selectedDrawForResults, setSelectedDrawForResults] = useState<any>(null);
  const [firstPrize, setFirstPrize] = useState('');
  const [secondPrize, setSecondPrize] = useState('');
  const [thirdPrize, setThirdPrize] = useState('');
  const [resultActionLoading, setResultActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [gamesRes, drawsRes, settingsRes, blockedRes] = await Promise.all([
        api.get('/api/v1/games'),
        api.get(`/api/v1/draws${selectedGameFilter ? `?gameId=${selectedGameFilter}` : ''}`),
        api.get('/api/v1/settings').catch(() => ({ defaultCurrency: 'HTG' })),
        api.get('/api/v1/games/rules/blocked-numbers').catch(() => []),
      ]);

      setGames(Array.isArray(gamesRes) ? gamesRes : []);
      setDraws(drawsRes?.items || []);
      setBlockedNumbers(Array.isArray(blockedRes) ? blockedRes : []);
      if (settingsRes?.defaultCurrency) {
        setCurrency(settingsRes.defaultCurrency);
      }
    } catch (err: any) {
      console.error('Erreur chargement Jeux & Tirages:', err);
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
    fetchData();
  }, [selectedGameFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Clôture manuelle d'un tirage (fermeture des ventes)
  const handleCloseDraw = async (drawId: string) => {
    if (!window.confirm('Voulez-vous clôturer les ventes pour ce tirage ? Aucun nouveau ticket ne pourra être vendu.')) return;
    try {
      await api.post(`/api/v1/draws/${drawId}/close`);
      fetchData();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // Activation / Réouverture manuelle d'un tirage
  const handleOpenDraw = async (drawId: string) => {
    if (!window.confirm('Voulez-vous activer ou réouvrir les ventes pour ce tirage ?')) return;
    try {
      await api.post(`/api/v1/draws/${drawId}/open`);
      fetchData();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    }
  };

  // Création d'un nouveau tirage
  const handleCreateDraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createGameId) {
      alert('Veuillez sélectionner une loterie');
      return;
    }

    setCreateActionLoading(true);
    try {
      const now = new Date();
      // Par défaut clôture dans 2 heures si non renseigné
      const closingDate = createClosingTime ? new Date(createClosingTime) : new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const scheduledDate = new Date(closingDate.getTime() + 15 * 60 * 1000);

      await api.post('/api/v1/draws', {
        gameId: createGameId,
        drawNumber: createDrawNumber ? Number(createDrawNumber) : undefined,
        salesClosingAt: closingDate.toISOString(),
        scheduledAt: scheduledDate.toISOString(),
      });

      setIsCreateModalOpen(false);
      setCreateDrawNumber('');
      setCreateClosingTime('');
      fetchData();
    } catch (err: any) {
      alert(`Erreur création tirage : ${err.message}`);
    } finally {
      setCreateActionLoading(false);
    }
  };

  // Saisie et enregistrement des 3 numéros gagnants
  const handleSaveResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDrawForResults) return;

    if (!firstPrize || !secondPrize || !thirdPrize) {
      setActionError('Les 3 lots gagnants sont obligatoires');
      return;
    }

    setResultActionLoading(true);
    setActionError(null);

    try {
      await api.post(`/api/v1/draws/${selectedDrawForResults.id}/results`, {
        firstPrize: firstPrize.trim(),
        secondPrize: secondPrize.trim(),
        thirdPrize: thirdPrize.trim(),
      });

      // Publication automatique et calcul immédiat des gains
      await api.post(`/api/v1/draws/${selectedDrawForResults.id}/publish`);

      setIsResultModalOpen(false);
      setSelectedDrawForResults(null);
      setFirstPrize('');
      setSecondPrize('');
      setThirdPrize('');
      fetchData();
    } catch (err: any) {
      setActionError(err.message || 'Erreur lors du calcul des résultats');
    } finally {
      setResultActionLoading(false);
    }
  };

  // Enregistrement d'un numéro bloqué ou plafonné
  const handleBlockNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockNumberInput.trim()) {
      alert('Veuillez saisir un numéro à bloquer ou limiter.');
      return;
    }

    setBlockLoading(true);
    try {
      await api.post('/api/v1/games/rules/blocked-numbers', {
        number: blockNumberInput.trim(),
        gameId: blockGameId || undefined,
        drawId: blockDrawId || undefined,
        isBlocked: blockIsStrict,
        maxAmount: !blockIsStrict && blockMaxAmount ? Number(blockMaxAmount) : undefined,
        note: blockNote || undefined,
      });

      setIsBlockModalOpen(false);
      setBlockNumberInput('');
      setBlockMaxAmount('');
      setBlockNote('');
      fetchData();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setBlockLoading(false);
    }
  };

  // Suppression d'une restriction sur un numéro
  const handleUnblockNumber = async (id: string, num: string) => {
    if (!window.confirm(`Voulez-vous lever la restriction sur le numéro [${num}] ?`)) return;
    try {
      await api.delete(`/api/v1/games/rules/blocked-numbers/${id}`);
      fetchData();
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
          title="Gestion des Jeux & Tirages Certifiés"
          onRefresh={handleRefresh}
          isRefreshing={refreshing}
          currency={currency}
          onCurrencyChange={(curr) => setCurrency(curr)}
        />

        <main className="flex-1 p-3.5 sm:p-6 md:p-8 space-y-6 md:space-y-8 max-w-7xl w-full mx-auto">
          {/* Bannière Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-roe-surface via-roe-card to-roe-surface border border-roe-border/60 shadow-xl">
            <div>
              <div className="flex items-center gap-2 text-roe-gold text-xs font-bold uppercase tracking-wider mb-1">
                <Dices size={16} />
                <span>Borlette Haïtienne & Loteries Certifiées</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Loteries, Tirages & Résultats</h2>
              <p className="text-xs sm:text-sm text-roe-textMuted mt-1">
                Gestion des cycles de vente, clôture automatique et calcul immuable des tickets gagnants.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (games.length > 0) setCreateGameId(games[0].id);
                  setIsCreateModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-roe-gold to-roe-goldDark text-roe-bg text-xs md:text-sm font-bold shadow-lg hover:scale-105 transition-all whitespace-nowrap"
              >
                <Plus size={16} />
                <span>Ouvrir un Tirage</span>
              </button>
            </div>
          </div>

          {/* Barre d'onglets : Tirages vs Numéros Bloqués & Plafonds */}
          <div className="flex items-center gap-3 border-b border-roe-border/60 pb-3">
            <button
              onClick={() => setActiveTab('DRAWS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'DRAWS'
                  ? 'bg-roe-gold text-roe-bg shadow-md'
                  : 'bg-roe-surface text-roe-textMuted hover:text-white border border-roe-border'
              }`}
            >
              <Trophy size={16} />
              <span>Tirages & Résultats</span>
            </button>

            <button
              onClick={() => setActiveTab('LIMITS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'LIMITS'
                  ? 'bg-roe-gold text-roe-bg shadow-md'
                  : 'bg-roe-surface text-roe-textMuted hover:text-white border border-roe-border'
              }`}
            >
              <Ban size={16} />
              <span>Numéros Bloqués & Plafonds ({blockedNumbers.length})</span>
            </button>
          </div>

          {/* CONTENU ONGLET 1 : TIRAGES & RÉSULTATS */}
          {activeTab === 'DRAWS' && (
            <>
              {/* Section 1 : Loteries Actives */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-roe-textMuted mb-3 flex items-center gap-2">
                  <Sparkles size={16} className="text-roe-gold" />
                  <span>Loteries Disponibles ({games.length})</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {games.map((game) => (
                    <div
                      key={game.id}
                      className="p-5 rounded-2xl bg-roe-surface border border-roe-border/80 shadow-md space-y-3 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-roe-card text-roe-gold border border-roe-border">
                            {game.code}
                          </span>
                          <h4 className="font-extrabold text-white text-base mt-2">{game.name}</h4>
                          <p className="text-xs text-roe-textMuted mt-0.5 line-clamp-2">{game.description}</p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-roe-border/40 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-roe-textMuted uppercase">Mise Min / Max</span>
                          <p className="font-mono text-white font-semibold">
                            {game.minBetAmount} - {game.maxBetAmount} {currency}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-roe-textMuted uppercase">Horaires Tirage</span>
                          <p className="text-roe-gold font-medium text-xs">{game.drawFrequency || 'Midi & Soir'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2 : Tableau & Cartes des Tirages */}
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/30 via-roe-card to-amber-950/20 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Clock size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Horloge Automatique & Contrôle Manuel des Tirages</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Actif (30s)
                        </span>
                      </h4>
                      <p className="text-xs text-roe-textMuted mt-0.5">
                        Les tirages (NY, FL, GA, TX, TN) s'ouvrent et se ferment automatiquement selon les horaires officiels. L'administrateur peut à tout instant forcer l'ouverture ou la clôture d'un tirage.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleRefresh}
                      className="px-3 py-2 rounded-xl bg-roe-surface hover:bg-roe-border/40 border border-roe-border text-xs font-semibold text-white flex items-center gap-1.5 transition-all"
                    >
                      <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                      <span>Actualiser</span>
                    </button>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-roe-gold to-amber-500 text-roe-bg text-xs font-bold shadow-md hover:scale-105 flex items-center gap-1.5 transition-all"
                    >
                      <Plus size={15} />
                      <span>Nouveau Tirage</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-roe-textMuted flex items-center gap-2">
                    <Trophy size={16} className="text-roe-gold" />
                    <span>Cycles de Tirage & Numéros Gagnants</span>
                  </h3>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedGameFilter}
                      onChange={(e) => setSelectedGameFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-roe-surface border border-roe-border text-white text-xs focus:border-roe-gold focus:outline-none"
                    >
                      <option value="">Toutes les loteries</option>
                      {games.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

            {/* Vue Cartes Mobile (< md) */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {draws.length > 0 ? (
                draws.map((d) => {
                  const isOpen = d.status === 'OPEN';
                  const isClosed = d.status === 'CLOSED';
                  const isPublished = d.status === 'PUBLISHED';
                  const winning = d.winningResults;

                  return (
                    <div
                      key={d.id}
                      className="p-5 rounded-2xl bg-roe-surface border border-roe-border/80 shadow-lg space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-xl bg-roe-card border border-roe-border flex items-center justify-center font-bold font-mono text-xs text-roe-gold">
                            #{d.drawNumber}
                          </span>
                          <div>
                            <p className="font-bold text-white text-sm">{d.game?.name}</p>
                            <p className="text-[10px] text-roe-textMuted font-mono">
                              Fermeture : {new Date(d.salesClosingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            isOpen
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                              : isClosed
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                              : 'bg-purple-500/10 border-purple-500/40 text-purple-300'
                          }`}
                        >
                          {isOpen ? 'En Vente' : isClosed ? 'Clôturé' : 'Publié'}
                        </span>
                      </div>

                      {/* Numéros gagnants s'ils existent */}
                      {winning && (
                        <div className="p-3 rounded-xl bg-roe-card border border-roe-border/50 flex items-center justify-around">
                          <div className="text-center">
                            <span className="text-[9px] uppercase text-roe-textMuted font-bold">1er Lot</span>
                            <p className="text-base font-black text-roe-gold font-mono">{winning.firstPrize || '--'}</p>
                          </div>
                          <div className="text-center">
                            <span className="text-[9px] uppercase text-roe-textMuted font-bold">2e Lot</span>
                            <p className="text-base font-black text-white font-mono">{winning.secondPrize || '--'}</p>
                          </div>
                          <div className="text-center">
                            <span className="text-[9px] uppercase text-roe-textMuted font-bold">3e Lot</span>
                            <p className="text-base font-black text-white font-mono">{winning.thirdPrize || '--'}</p>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="pt-2 border-t border-roe-border/50 flex items-center justify-end gap-2">
                        {!isOpen && d.status !== 'PUBLISHED' && (
                          <button
                            onClick={() => handleOpenDraw(d.id)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Ouvrir Tirage</span>
                          </button>
                        )}
                        {isOpen && (
                          <button
                            onClick={() => handleCloseDraw(d.id)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Clôturer Vente</span>
                          </button>
                        )}
                        {(isOpen || isClosed) && (
                          <button
                            onClick={() => {
                              setSelectedDrawForResults(d);
                              setIsResultModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-roe-gold to-amber-500 text-roe-bg text-xs font-bold shadow-md flex items-center gap-1"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Entrer Résultats</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-xs text-roe-textMuted bg-roe-surface rounded-2xl border border-roe-border/60">
                  Aucun tirage planifié pour le moment.
                </div>
              )}
            </div>

            {/* Vue Tableau Desktop (>= md) */}
            <div className="hidden md:block rounded-3xl bg-roe-surface border border-roe-border/70 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs md:text-sm">
                  <thead>
                    <tr className="border-b border-roe-border/80 bg-roe-card/40 text-[11px] uppercase tracking-wider text-roe-textMuted font-bold">
                      <th className="p-4 pl-6">N° & Loterie</th>
                      <th className="p-4">Clôture Ventes</th>
                      <th className="p-4">Statut</th>
                      <th className="p-4 text-center">Numéros Gagnants (1er / 2e / 3e)</th>
                      <th className="p-4 pr-6 text-right">Actions Administrateur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-roe-border/40">
                    {draws.length > 0 ? (
                      draws.map((d) => {
                        const isOpen = d.status === 'OPEN';
                        const isClosed = d.status === 'CLOSED';
                        const winning = d.winningResults;

                        return (
                          <tr key={d.id} className="hover:bg-roe-card/30 transition-colors">
                            <td className="p-4 pl-6">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-roe-card border border-roe-border flex items-center justify-center font-bold text-roe-gold font-mono text-xs">
                                  #{d.drawNumber}
                                </div>
                                <div>
                                  <p className="font-bold text-white text-sm">{d.game?.name}</p>
                                  <p className="text-xs text-roe-textMuted font-mono">{d.game?.code}</p>
                                </div>
                              </div>
                            </td>

                            <td className="p-4 text-xs font-mono text-roe-textMuted">
                              {new Date(d.salesClosingAt).toLocaleString([], {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </td>

                            <td className="p-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                  isOpen
                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                                    : isClosed
                                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                                    : 'bg-purple-500/10 border-purple-500/40 text-purple-300'
                                }`}
                              >
                                {isOpen ? 'En Vente' : isClosed ? 'Clôturé' : 'Publié'}
                              </span>
                            </td>

                            <td className="p-4 text-center">
                              {winning ? (
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-roe-card border border-roe-border/60 font-mono text-sm">
                                  <span className="font-extrabold text-roe-gold">{winning.firstPrize}</span>
                                  <span className="text-roe-border">•</span>
                                  <span className="font-bold text-white">{winning.secondPrize}</span>
                                  <span className="text-roe-border">•</span>
                                  <span className="font-bold text-white">{winning.thirdPrize}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-roe-textMuted italic">En attente des résultats</span>
                              )}
                            </td>

                            <td className="p-4 pr-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {!isOpen && d.status !== 'PUBLISHED' && (
                                  <button
                                    onClick={() => handleOpenDraw(d.id)}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                                    title="Activer ou réouvrir les ventes pour ce tirage"
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                    <span>Ouvrir / Activer</span>
                                  </button>
                                )}
                                {isOpen && (
                                  <button
                                    onClick={() => handleCloseDraw(d.id)}
                                    className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1.5"
                                    title="Fermer immédiatement les ventes pour ce tirage"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Clôturer Vente</span>
                                  </button>
                                )}
                                {(isOpen || isClosed) && (
                                  <button
                                    onClick={() => {
                                      setSelectedDrawForResults(d);
                                      setIsResultModalOpen(true);
                                    }}
                                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-roe-gold to-amber-500 text-roe-bg text-xs font-bold shadow-md hover:scale-105 transition-all flex items-center gap-1.5"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Entrer Résultats</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-sm text-roe-textMuted">
                          {loading ? 'Chargement des tirages...' : 'Aucun tirage disponible.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
            </>
          )}

          {/* CONTENU ONGLET 2 : NUMÉROS BLOQUÉS & PLAFONDS */}
          {activeTab === 'LIMITS' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <ShieldAlert size={18} className="text-rose-400" />
                    <span>Contrôle des Risques : Numéros Bloqués & Plafonds</span>
                  </h3>
                  <p className="text-xs text-rose-200/80 mt-1">
                    Bloquez un numéro à 100% ou définissez un plafond maximum d'exposition en Gourdes ({currency}). Tout ticket dépassant la limite sera automatiquement rejeté par le terminal POS.
                  </p>
                </div>

                <button
                  onClick={() => setIsBlockModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white text-xs font-bold shadow-lg hover:scale-105 transition-all whitespace-nowrap self-start sm:self-center"
                >
                  <Plus size={16} />
                  <span>Ajouter une Restriction</span>
                </button>
              </div>

              {/* Tableau / Cartes des Numéros Bloqués */}
              <div className="rounded-3xl bg-roe-surface border border-roe-border/70 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="border-b border-roe-border/80 bg-roe-card/40 text-[11px] uppercase tracking-wider text-roe-textMuted font-bold">
                        <th className="p-4 pl-6">Numéro</th>
                        <th className="p-4">Portée (Loterie / Tirage)</th>
                        <th className="p-4">Type de Restriction</th>
                        <th className="p-4">Plafond Max Autorisé</th>
                        <th className="p-4">Note / Motif</th>
                        <th className="p-4 pr-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-roe-border/40">
                      {blockedNumbers.length > 0 ? (
                        blockedNumbers.map((b) => (
                          <tr key={b.id} className="hover:bg-roe-card/30 transition-colors">
                            <td className="p-4 pl-6">
                              <span className="inline-flex items-center justify-center w-12 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono font-black text-lg">
                                {b.number}
                              </span>
                            </td>

                            <td className="p-4 text-xs">
                              <p className="font-semibold text-white">
                                {b.game ? b.game.name : 'Toutes les loteries (Global)'}
                              </p>
                              {b.draw && (
                                <p className="text-[10px] text-roe-textMuted font-mono">
                                  Tirage #{b.draw.drawNumber}
                                </p>
                              )}
                            </td>

                            <td className="p-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                  b.isBlocked || !b.maxAmount
                                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                                    : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                                }`}
                              >
                                {b.isBlocked || !b.maxAmount ? 'Bloqué à 100%' : 'Plafond Limité'}
                              </span>
                            </td>

                            <td className="p-4 font-mono font-bold text-white text-sm">
                              {b.isBlocked || !b.maxAmount ? (
                                <span className="text-rose-400 font-bold">0,00 {currency}</span>
                              ) : (
                                <span className="text-roe-gold">{formatCurrency(b.maxAmount, currency)}</span>
                              )}
                            </td>

                            <td className="p-4 text-xs text-roe-textMuted italic">
                              {b.note || 'Aucune note'}
                            </td>

                            <td className="p-4 pr-6 text-right">
                              <button
                                onClick={() => handleUnblockNumber(b.id, b.number)}
                                className="p-2 rounded-xl bg-roe-card hover:bg-rose-500/20 text-roe-textMuted hover:text-rose-400 border border-roe-border hover:border-rose-500/30 transition-colors"
                                title="Supprimer la restriction"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-sm text-roe-textMuted">
                            Aucun numéro bloqué ou plafonné. Toutes les combinaisons sont ouvertes à la vente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL 3 : AJOUTER UN NUMÉRO BLOQUÉ OU PLAFONNÉ */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-roe-surface border border-roe-border/80 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Ban size={20} className="text-rose-400" />
              <span>Bloquer ou Plafonner un Numéro</span>
            </h3>

            <form onSubmit={handleBlockNumber} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                  Numéro à Restreindre (Ex: 45, 88, 123)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 45"
                  value={blockNumberInput}
                  onChange={(e) => setBlockNumberInput(e.target.value)}
                  className="w-full text-center font-mono font-black text-2xl py-2.5 rounded-xl bg-roe-card border border-rose-500/60 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                  Loterie Concernée
                </label>
                <select
                  value={blockGameId}
                  onChange={(e) => setBlockGameId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
                >
                  <option value="">Toutes les loteries (Règle Globale)</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-2">
                  Type de Restriction
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBlockIsStrict(true)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      blockIsStrict
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-roe-card border-roe-border text-roe-textMuted'
                    }`}
                  >
                    🚫 Blocage Total (0 G)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlockIsStrict(false)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      !blockIsStrict
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-roe-card border-roe-border text-roe-textMuted'
                    }`}
                  >
                    ⚠️ Plafond Maximum
                  </button>
                </div>
              </div>

              {!blockIsStrict && (
                <div>
                  <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                    Montant Maximum Autorisé ({currency})
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 500"
                    value={blockMaxAmount}
                    onChange={(e) => setBlockMaxAmount(e.target.value)}
                    required={!blockIsStrict}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
                  />
                  <p className="text-[10px] text-roe-textMuted mt-1">
                    Au-delà de ce montant, la mise sur ce numéro sera rejetée par le terminal.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                  Motif / Note (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Exposition excessive / Numéro fétiche"
                  value={blockNote}
                  onChange={(e) => setBlockNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-roe-border/50">
                <button
                  type="button"
                  onClick={() => setIsBlockModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-roe-card text-roe-textMuted hover:text-white text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={blockLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white text-xs font-extrabold shadow-lg disabled:opacity-50"
                >
                  {blockLoading ? 'Application...' : 'Appliquer la Restriction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1 : OUVRIR UN TIRAGE */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-roe-surface border border-roe-border/80 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Dices size={20} className="text-roe-gold" />
              <span>Ouvrir un Nouveau Tirage</span>
            </h3>

            <form onSubmit={handleCreateDraw} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                  Loterie
                </label>
                <select
                  value={createGameId}
                  onChange={(e) => setCreateGameId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
                  required
                >
                  <option value="">Sélectionner une loterie (NY, FL, GA, TX, TN)</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                  Numéro du Tirage (Optionnel)
                </label>
                <input
                  type="number"
                  placeholder="Ex: 102 (Auto-incrémenté si vide)"
                  value={createDrawNumber}
                  onChange={(e) => setCreateDrawNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                  Heure Limite de Clôture des Ventes
                </label>
                <input
                  type="datetime-local"
                  value={createClosingTime}
                  onChange={(e) => setCreateClosingTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
                />
                <p className="text-[10px] text-roe-textMuted mt-1">
                  Après cette heure, les terminaux Android refuseront les ventes pour ce tirage.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-roe-border/50">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-roe-card text-roe-textMuted hover:text-white text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createActionLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-roe-gold to-amber-500 text-roe-bg text-xs font-extrabold shadow-lg disabled:opacity-50"
                >
                  {createActionLoading ? 'Ouverture...' : 'Ouvrir le Tirage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2 : SAISIE DES RÉSULTATS GAGNANTS */}
      {isResultModalOpen && selectedDrawForResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-roe-surface border border-roe-border/80 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Trophy size={20} className="text-roe-gold" />
              <span>Proclamer les Résultats Gagnants</span>
            </h3>
            <p className="text-xs text-roe-textMuted mb-4">
              Tirage #{selectedDrawForResults.drawNumber} — {selectedDrawForResults.game?.name}
            </p>

            {actionError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-400 text-xs">
                {actionError}
              </div>
            )}

            <form onSubmit={handleSaveResults} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-center text-xs font-bold text-roe-gold uppercase mb-1">
                    1er Lot
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="Ex: 45"
                    value={firstPrize}
                    onChange={(e) => setFirstPrize(e.target.value)}
                    required
                    className="w-full text-center font-mono font-black text-xl py-3 rounded-xl bg-roe-card border border-roe-gold text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-center text-xs font-bold text-white uppercase mb-1">
                    2e Lot
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="Ex: 88"
                    value={secondPrize}
                    onChange={(e) => setSecondPrize(e.target.value)}
                    required
                    className="w-full text-center font-mono font-black text-xl py-3 rounded-xl bg-roe-card border border-roe-border text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-center text-xs font-bold text-white uppercase mb-1">
                    3e Lot
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="Ex: 12"
                    value={thirdPrize}
                    onChange={(e) => setThirdPrize(e.target.value)}
                    required
                    className="w-full text-center font-mono font-black text-xl py-3 rounded-xl bg-roe-card border border-roe-border text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                ⚠️ <strong>Important :</strong> La validation déclenchera le calcul mathématique automatique de tous les tickets vendus, l’attribution des gains aux gagnants et le calcul des commissions vendeurs.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-roe-border/50">
                <button
                  type="button"
                  onClick={() => setIsResultModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-roe-card text-roe-textMuted hover:text-white text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={resultActionLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-roe-gold to-amber-500 text-roe-bg text-xs font-extrabold shadow-lg disabled:opacity-50"
                >
                  {resultActionLoading ? 'Calcul des Gains...' : 'Proclamer les Résultats'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
