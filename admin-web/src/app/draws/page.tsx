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
  Sliders,
  Check,
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

  // Modal de Paramétrage Permanent des Horaires & Multiplicateurs par Loterie
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedGameForSchedule, setSelectedGameForSchedule] = useState<any>(null);
  const [midiCloseTime, setMidiCloseTime] = useState('14:15');
  const [soirCloseTime, setSoirCloseTime] = useState('22:20');
  const [firstLotMultiplier, setFirstLotMultiplier] = useState(50);
  const [secondLotMultiplier, setSecondLotMultiplier] = useState(20);
  const [thirdLotMultiplier, setThirdLotMultiplier] = useState(10);
  const [mariageMultiplier, setMariageMultiplier] = useState(1000);
  const [scheduleSaveLoading, setScheduleSaveLoading] = useState(false);

  // Modal de Saisie des Résultats Gagnants
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [selectedDrawForResults, setSelectedDrawForResults] = useState<any>(null);
  const [firstPrize, setFirstPrize] = useState('');
  const [secondPrize, setSecondPrize] = useState('');
  const [thirdPrize, setThirdPrize] = useState('');
  const [quickResultInput, setQuickResultInput] = useState('');
  const [resultActionLoading, setResultActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleQuickResultChange = (val: string) => {
    setQuickResultInput(val);
    const parts = val.trim().replace(/[^0-9]/g, ' ').split(/\s+/).filter(Boolean);
    if (parts.length >= 3) {
      setFirstPrize(parts[0].slice(0, 3));
      setSecondPrize(parts[1].slice(0, 2));
      setThirdPrize(parts[2].slice(0, 2));
    } else if (parts.length === 1 && parts[0].length >= 7) {
      setFirstPrize(parts[0].slice(0, 3));
      setSecondPrize(parts[0].slice(3, 5));
      setThirdPrize(parts[0].slice(5, 7));
    }
  };

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

  // Calcul automatique de la prochaine heure de clôture selon les horaires enregistrés
  const calculateDefaultClosingTime = (game: any): string => {
    if (!game) return '';
    const now = new Date();

    const customSchedules = game.gameRules?.schedules;
    let schedules: { closeHour: number; closeMinute: number }[] = [];

    if (Array.isArray(customSchedules) && customSchedules.length > 0) {
      schedules = customSchedules;
    } else {
      const defaultSchedules: Record<string, { closeHour: number; closeMinute: number }[]> = {
        BOLET_CHI: [
          { closeHour: 13, closeMinute: 38 },
          { closeHour: 22, closeMinute: 18 },
        ],
        BOLET_FL: [
          { closeHour: 13, closeMinute: 28 },
          { closeHour: 21, closeMinute: 43 },
        ],
        BOLET_GA: [
          { closeHour: 12, closeMinute: 27 },
          { closeHour: 18, closeMinute: 57 },
        ],
        BOLET_NY: [
          { closeHour: 14, closeMinute: 28 },
          { closeHour: 22, closeMinute: 28 },
        ],
        BOLET_TN: [
          { closeHour: 10, closeMinute: 9 },
          { closeHour: 19, closeMinute: 9 },
        ],
        BOLET_TX: [
          { closeHour: 10, closeMinute: 58 },
          { closeHour: 18, closeMinute: 58 },
        ],
      };
      schedules = defaultSchedules[game.code] || [
        { closeHour: 13, closeMinute: 0 },
        { closeHour: 21, closeMinute: 0 },
      ];
    }

    let targetDate: Date | null = null;
    for (const s of schedules) {
      const candidate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        s.closeHour,
        s.closeMinute,
        0
      );
      if (candidate.getTime() > now.getTime()) {
        targetDate = candidate;
        break;
      }
    }

    if (!targetDate) {
      const first = schedules[0];
      targetDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        first.closeHour,
        first.closeMinute,
        0
      );
    }

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const hours = String(targetDate.getHours()).padStart(2, '0');
    const minutes = String(targetDate.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Sélection d'une loterie dans le modal : pré-remplissage automatique immédiat
  const handleSelectGameForCreate = (gameId: string) => {
    setCreateGameId(gameId);
    const game = games.find((g) => g.id === gameId);
    if (game) {
      const autoTime = calculateDefaultClosingTime(game);
      setCreateClosingTime(autoTime);
    } else {
      setCreateClosingTime('');
    }
  };

  // Informations officielles des horaires des loteries certifiées (Heure d'Haïti)
  const LOTTERY_SCHEDULE_INFO: Record<string, { midiClose: string; midiDraw: string; soirClose: string; soirDraw: string }> = {
    BOLET_CHI: { midiClose: '13:38', midiDraw: '13:45 (01:45 PM)', soirClose: '22:18', soirDraw: '22:30 (10:30 PM)' },
    BOLET_FL: { midiClose: '13:28', midiDraw: '13:35 (01:35 PM)', soirClose: '21:43', soirDraw: '21:50 (09:50 PM)' },
    BOLET_GA: { midiClose: '12:27', midiDraw: '12:35 (12:35 PM)', soirClose: '18:57', soirDraw: '19:05 (07:05 PM)' },
    BOLET_NY: { midiClose: '14:28', midiDraw: '14:35 (02:35 PM)', soirClose: '22:28', soirDraw: '22:35 (10:35 PM)' },
    BOLET_TN: { midiClose: '10:09', midiDraw: '10:15 (10:15 AM)', soirClose: '19:09', soirDraw: '19:15 (07:15 PM)' },
    BOLET_TX: { midiClose: '10:58', midiDraw: '11:05 (11:05 AM)', soirClose: '18:58', soirDraw: '19:05 (07:05 PM)' },
  };

  // Ouverture du modal de modification des horaires et multiplicateurs d'une loterie
  const handleOpenScheduleModal = (game: any) => {
    setSelectedGameForSchedule(game);
    const customSchedules = game.gameRules?.schedules;
    if (Array.isArray(customSchedules) && customSchedules.length >= 2) {
      setMidiCloseTime(
        `${String(customSchedules[0].closeHour).padStart(2, '0')}:${String(customSchedules[0].closeMinute).padStart(2, '0')}`
      );
      setSoirCloseTime(
        `${String(customSchedules[1].closeHour).padStart(2, '0')}:${String(customSchedules[1].closeMinute).padStart(2, '0')}`
      );
    } else {
      const def = LOTTERY_SCHEDULE_INFO[game.code] || { midiClose: '14:15', soirClose: '22:20' };
      setMidiCloseTime(def.midiClose);
      setSoirCloseTime(def.soirClose);
    }

    // Chargement des multiplicateurs configurés pour cette loterie
    const rules = game.gameRules || {};
    const mults = rules.multipliers || rules.borlette || {};
    setFirstLotMultiplier(Number(mults.firstPrize || mults.firstPrizeMultiplier || 50));
    setSecondLotMultiplier(Number(mults.secondPrize || mults.secondPrizeMultiplier || 20));
    setThirdLotMultiplier(Number(mults.thirdPrize || mults.thirdPrizeMultiplier || 10));
    setMariageMultiplier(Number(rules.mariage?.multiplier || 1000));

    setIsScheduleModalOpen(true);
  };

  // Enregistrement permanent des nouveaux horaires et multiplicateurs dans la base de données
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGameForSchedule) return;

    setScheduleSaveLoading(true);
    try {
      const [mH, mM] = midiCloseTime.split(':').map(Number);
      const [sH, sM] = soirCloseTime.split(':').map(Number);

      const midiDrawTotal = mH * 60 + mM + 15;
      const soirDrawTotal = sH * 60 + sM + 10;

      const existingRules = selectedGameForSchedule.gameRules || {};
      const updatedSchedules = [
        {
          name: 'Midi',
          closeHour: mH,
          closeMinute: mM,
          drawHour: Math.floor(midiDrawTotal / 60) % 24,
          drawMinute: midiDrawTotal % 60,
        },
        {
          name: 'Soir',
          closeHour: sH,
          closeMinute: sM,
          drawHour: Math.floor(soirDrawTotal / 60) % 24,
          drawMinute: soirDrawTotal % 60,
        },
      ];

      const updatedMultipliers = {
        firstPrize: Number(firstLotMultiplier),
        secondPrize: Number(secondLotMultiplier),
        thirdPrize: Number(thirdLotMultiplier),
        mariage: Number(mariageMultiplier),
      };

      await api.patch(`/api/v1/games/${selectedGameForSchedule.id}`, {
        gameRules: {
          ...existingRules,
          schedules: updatedSchedules,
          multipliers: updatedMultipliers,
          borlette: {
            firstPrizeMultiplier: Number(firstLotMultiplier),
            secondPrizeMultiplier: Number(secondLotMultiplier),
            thirdPrizeMultiplier: Number(thirdLotMultiplier),
          },
          mariage: {
            ...existingRules.mariage,
            multiplier: Number(mariageMultiplier),
            mariageGratis: Number(mariageMultiplier),
          },
        },
        drawFrequency: `Midi ${midiCloseTime} & Soir ${soirCloseTime}`,
      });

      setIsScheduleModalOpen(false);
      fetchData();
      alert(`✅ Paramètres pour ${selectedGameForSchedule.name} (Horaires & Multiplicateurs 1er: x${firstLotMultiplier}, 2e: x${secondLotMultiplier}, 3e: x${thirdLotMultiplier}) enregistrés avec succès !`);
    } catch (err: any) {
      alert(`Erreur enregistrement : ${err.message}`);
    } finally {
      setScheduleSaveLoading(false);
    }
  };


  // Création d'un nouveau tirage (avec heure pré-remplie automatiquement)
  const handleCreateDraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createGameId) {
      alert('Veuillez sélectionner une loterie');
      return;
    }

    setCreateActionLoading(true);
    try {
      const selectedGame = games.find((g) => g.id === createGameId);
      const closingDate = createClosingTime
        ? new Date(createClosingTime)
        : new Date(calculateDefaultClosingTime(selectedGame));
      const scheduledDate = new Date(closingDate.getTime() + 10 * 60 * 1000);

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

    const rawFirst = firstPrize.trim();
    const rawSecond = secondPrize.trim();
    const rawThird = thirdPrize.trim();

    if (!rawFirst || !rawSecond || !rawThird) {
      setActionError('Les 3 lots gagnants sont obligatoires');
      return;
    }

    const normFirst = rawFirst.padStart(3, '0');
    const normSecond = rawSecond.padStart(2, '0');
    const normThird = rawThird.padStart(2, '0');

    if (normFirst.length !== 3 || normSecond.length !== 2 || normThird.length !== 2) {
      setActionError('Format attendu : 3 chiffres pour le 1er lot/Lòt 3 (ex: 040), 2 chiffres pour le 2e lot (ex: 22) et 2 chiffres pour le 3e lot (ex: 36).');
      return;
    }

    setResultActionLoading(true);
    setActionError(null);

    try {
      await api.post(`/api/v1/draws/${selectedDrawForResults.id}/results`, {
        winningResults: {
          firstPrize: normFirst,
          secondPrize: normSecond,
          thirdPrize: normThird,
        },
        firstPrize: normFirst,
        secondPrize: normSecond,
        thirdPrize: normThird,
        publishImmediately: true,
      });

      // Publication automatique de secours au cas où publishImmediately n'a pas été exécuté
      await api.post(`/api/v1/draws/${selectedDrawForResults.id}/publish`).catch(() => {});

      setIsResultModalOpen(false);
      setSelectedDrawForResults(null);
      setFirstPrize('');
      setSecondPrize('');
      setThirdPrize('');
      setQuickResultInput('');
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
                        <button
                          onClick={() => handleOpenScheduleModal(game)}
                          className="p-2 rounded-xl bg-roe-card hover:bg-roe-gold/10 text-roe-textMuted hover:text-roe-gold border border-roe-border/60 hover:border-roe-gold/40 transition-all shrink-0"
                          title="Modifier les horaires de fermeture permanents de cette loterie"
                        >
                          <Sliders size={15} />
                        </button>
                      </div>

                      <div className="pt-2 border-t border-roe-border/40 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-roe-textMuted uppercase">Mise Min / Max</span>
                          <p className="font-mono text-white font-semibold">
                            {game.minBetAmount} - {game.maxBetAmount} {currency}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-roe-textMuted uppercase">Horaires Clôture</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {(() => {
                              const s = game.gameRules?.schedules;
                              const label = Array.isArray(s) && s.length >= 2
                                ? `Midi ${String(s[0].closeHour).padStart(2, '0')}:${String(s[0].closeMinute).padStart(2, '0')} · Soir ${String(s[1].closeHour).padStart(2, '0')}:${String(s[1].closeMinute).padStart(2, '0')}`
                                : (LOTTERY_SCHEDULE_INFO[game.code]
                                    ? `Midi ${LOTTERY_SCHEDULE_INFO[game.code].midiClose} · Soir ${LOTTERY_SCHEDULE_INFO[game.code].soirClose}`
                                    : (game.drawFrequency || 'Midi & Soir'));
                              return (
                                <p className="text-roe-gold font-bold text-xs truncate" title={label}>
                                  {label}
                                </p>
                              );
                            })()}
                            <button
                              onClick={() => handleOpenScheduleModal(game)}
                              className="text-[10px] text-roe-textMuted hover:text-roe-gold underline shrink-0"
                            >
                              Éditer
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Multiplicateurs de gains configurés */}
                      {(() => {
                        const m = game.gameRules?.multipliers || game.gameRules?.borlette || {};
                        const p1 = m.firstPrize || m.firstPrizeMultiplier || 50;
                        const p2 = m.secondPrize || m.secondPrizeMultiplier || 20;
                        const p3 = m.thirdPrize || m.thirdPrizeMultiplier || 10;
                        const mar = game.gameRules?.mariage?.multiplier || 1000;
                        return (
                          <div className="pt-2 border-t border-roe-border/30 flex items-center justify-between text-[11px]">
                            <span className="text-roe-textMuted font-mono">1er: <strong className="text-roe-gold">x{p1}</strong> · 2e: <strong className="text-white">x{p2}</strong> · 3e: <strong className="text-white">x{p3}</strong></span>
                            <span className="text-roe-gold font-mono font-bold">Maryaj: x{mar}</span>
                          </div>
                        );
                      })()}
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
                        Règle stricte des sessions : Entre 05h00 et 13h00, c'est la session Midi (les ventes Soir sont verrouillées). À partir de 13h00, la session Soir s'ouvre automatiquement.
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

                        {(() => {
                          const isMidi = new Date(d.salesClosingAt).getHours() < 16;
                          return (
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border flex items-center gap-1 ${
                                isOpen
                                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                                  : isClosed
                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                                  : 'bg-purple-500/10 border-purple-500/40 text-purple-300'
                              }`}
                            >
                              <span className="font-mono text-roe-gold">[{isMidi ? 'Midi' : 'Soir'}]</span>
                              <span>{isOpen ? 'En Vente' : isClosed ? 'Clôturé' : 'Publié'}</span>
                            </span>
                          );
                        })()}
                      </div>

                      {/* Numéros gagnants s'ils existent */}
                      {winning && (
                        <div className="p-3 rounded-xl bg-roe-card border border-roe-border/50 space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="text-roe-textMuted uppercase">Résultats Officiels</span>
                            <span className="font-mono text-roe-gold">Lòt 3 : {winning.firstPrize}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded-xl bg-roe-surface border border-roe-gold/40">
                              <span className="text-[9px] uppercase text-roe-gold font-bold">1er & Lòt 3</span>
                              <p className="text-base font-black text-roe-gold font-mono">{winning.firstPrize || '--'}</p>
                              <span className="text-[8px] text-roe-textMuted font-mono">Lot : {winning.firstPrize ? winning.firstPrize.slice(-2) : '--'}</span>
                            </div>
                            <div className="p-2 rounded-xl bg-roe-surface border border-roe-border/60">
                              <span className="text-[9px] uppercase text-roe-textMuted font-bold">2e Lot</span>
                              <p className="text-base font-black text-white font-mono">{winning.secondPrize || '--'}</p>
                              <span className="text-[8px] text-transparent select-none font-mono">-</span>
                            </div>
                            <div className="p-2 rounded-xl bg-roe-surface border border-roe-border/60">
                              <span className="text-[9px] uppercase text-roe-textMuted font-bold">3e Lot</span>
                              <p className="text-base font-black text-white font-mono">{winning.thirdPrize || '--'}</p>
                              <span className="text-[8px] text-transparent select-none font-mono">-</span>
                            </div>
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
                      <th className="p-4 text-center">Numéros Gagnants (Lòt 3 & 1er / 2e / 3e)</th>
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
                              {(() => {
                                const isMidi = new Date(d.salesClosingAt).getHours() < 16;
                                return (
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border inline-flex items-center gap-1 ${
                                      isOpen
                                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                                        : isClosed
                                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                                        : 'bg-purple-500/10 border-purple-500/40 text-purple-300'
                                    }`}
                                  >
                                    <span className="font-mono text-roe-gold">[{isMidi ? 'Midi' : 'Soir'}]</span>
                                    <span>{isOpen ? 'En Vente' : isClosed ? 'Clôturé' : 'Publié'}</span>
                                  </span>
                                );
                              })()}
                            </td>

                            <td className="p-4 text-center">
                              {winning ? (
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-roe-card border border-roe-border/60 font-mono text-sm">
                                  <div className="flex items-center gap-1.5 bg-roe-gold/15 px-2 py-0.5 rounded-lg border border-roe-gold/30">
                                    <span className="text-[10px] text-roe-gold font-black uppercase">Lòt 3</span>
                                    <span className="font-black text-roe-gold text-base">{winning.firstPrize}</span>
                                    <span className="text-[10px] text-roe-textMuted font-mono">({winning.firstPrize ? winning.firstPrize.slice(-2) : '--'})</span>
                                  </div>
                                  <span className="text-roe-border">•</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-roe-textMuted uppercase font-bold">2e</span>
                                    <span className="font-bold text-white text-base">{winning.secondPrize}</span>
                                  </div>
                                  <span className="text-roe-border">•</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-roe-textMuted uppercase font-bold">3e</span>
                                    <span className="font-bold text-white text-base">{winning.thirdPrize}</span>
                                  </div>
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
                  onChange={(e) => handleSelectGameForCreate(e.target.value)}
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-roe-textMuted uppercase">
                    Heure Limite de Clôture des Ventes
                  </label>
                  {createGameId && (
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <Sparkles size={12} />
                      Pré-remplie automatiquement
                    </span>
                  )}
                </div>
                <input
                  type="datetime-local"
                  value={createClosingTime}
                  onChange={(e) => setCreateClosingTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none font-mono"
                />
                <p className="text-[10px] text-roe-textMuted mt-1">
                  ⚡ Heure officielle calculée selon les paramètres de la loterie. Modifiable si besoin.
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
          <div className="relative w-full max-w-lg bg-roe-surface border border-roe-border/80 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Trophy size={20} className="text-roe-gold" />
                <span>Proclamer les Résultats Gagnants</span>
              </h3>
              {(() => {
                const isMidi = new Date(selectedDrawForResults.salesClosingAt).getHours() < 16;
                return (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-roe-gold/15 border border-roe-gold/40 text-roe-gold font-mono">
                    {isMidi ? 'Tirage Midi' : 'Tirage Soir'}
                  </span>
                );
              })()}
            </div>
            <p className="text-xs text-roe-textMuted mb-4">
              Tirage #{selectedDrawForResults.drawNumber} — <strong className="text-white">{selectedDrawForResults.game?.name}</strong> ({selectedDrawForResults.game?.code})
            </p>

            {actionError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-400 text-xs">
                {actionError}
              </div>
            )}

            {/* Saisie Rapide / Collage Intelligent */}
            <div className="mb-4 p-3 rounded-2xl bg-roe-card border border-roe-border/70 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-roe-gold uppercase flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>Saisie Rapide (Collage ou Frappe)</span>
                </label>
                <span className="text-[10px] text-roe-textMuted font-mono">Format : 040 22 36</span>
              </div>
              <input
                type="text"
                placeholder="Tapez ou collez ici (ex: 040 22 36 ou 040-22-36)..."
                value={quickResultInput}
                onChange={(e) => handleQuickResultChange(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-roe-surface border border-roe-border text-white text-xs font-mono placeholder:text-roe-textMuted/50 focus:border-roe-gold focus:outline-none"
              />
              <p className="text-[10px] text-roe-textMuted">
                💡 Les 3 champs ci-dessous se rempliront automatiquement dès la saisie.
              </p>
            </div>

            {/* Bouton de Récupération Automatique via API */}
            <div className="mb-4 p-3 rounded-2xl bg-roe-card/80 border border-roe-gold/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-roe-gold shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">Récupération Automatique API</p>
                  <p className="text-[10px] text-roe-textMuted">Interroge les flux officiels de la loterie d'État</p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setActionError(null);
                    setResultActionLoading(true);
                    const res = await api.post(`/api/v1/draws/${selectedDrawForResults.id}/auto-fetch`);
                    if (res?.winningResults) {
                      setFirstPrize(res.winningResults.firstPrize || '');
                      setSecondPrize(res.winningResults.secondPrize || '');
                      setThirdPrize(res.winningResults.thirdPrize || '');
                      setQuickResultInput(`${res.winningResults.firstPrize || ''} ${res.winningResults.secondPrize || ''} ${res.winningResults.thirdPrize || ''}`.trim());
                    } else if (res?.message) {
                      setActionError(res.message);
                    }
                  } catch (e: any) {
                    setActionError(e.message || 'Impossible de joindre l’API officielle');
                  } finally {
                    setResultActionLoading(false);
                  }
                }}
                disabled={resultActionLoading}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-roe-gold to-amber-500 text-roe-bg text-xs font-extrabold hover:opacity-90 disabled:opacity-50 shrink-0"
              >
                {resultActionLoading ? 'Recherche...' : 'Remplir via API'}
              </button>
            </div>

            <form onSubmit={handleSaveResults} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {/* 1ER LOT & LÒT 3 (3 CHIFFRES) */}
                <div className="space-y-1">
                  <div className="text-center">
                    <span className="block text-[10px] font-black text-roe-gold uppercase tracking-wider">
                      1er Lot & Lòt 3
                    </span>
                    <span className="text-[9px] text-roe-gold/80 font-bold uppercase">(3 Chiffres)</span>
                  </div>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="Ex: 040"
                    value={firstPrize}
                    onChange={(e) => setFirstPrize(e.target.value.replace(/[^0-9]/g, ''))}
                    required
                    className="w-full text-center font-mono font-black text-xl py-3 rounded-xl bg-roe-card border-2 border-roe-gold text-roe-gold focus:outline-none shadow-md"
                  />
                  <div className="text-center text-[9px] text-roe-textMuted font-mono">
                    {firstPrize.length >= 2 ? (
                      <span className="text-emerald-400 font-bold">
                        L3: {firstPrize.padStart(3, '0')} · 1er: {firstPrize.slice(-2)}
                      </span>
                    ) : (
                      'Pick 3 officiel'
                    )}
                  </div>
                </div>

                {/* 2E LOT (2 CHIFFRES) */}
                <div className="space-y-1">
                  <div className="text-center">
                    <span className="block text-[10px] font-bold text-white uppercase tracking-wider">
                      2e Lot
                    </span>
                    <span className="text-[9px] text-roe-textMuted uppercase">(2 Chiffres)</span>
                  </div>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="Ex: 22"
                    value={secondPrize}
                    onChange={(e) => setSecondPrize(e.target.value.replace(/[^0-9]/g, ''))}
                    required
                    className="w-full text-center font-mono font-black text-xl py-3 rounded-xl bg-roe-card border border-roe-border text-white focus:outline-none"
                  />
                  <div className="text-center text-[9px] text-roe-textMuted font-mono">
                    Borlette 2e
                  </div>
                </div>

                {/* 3E LOT (2 CHIFFRES) */}
                <div className="space-y-1">
                  <div className="text-center">
                    <span className="block text-[10px] font-bold text-white uppercase tracking-wider">
                      3e Lot
                    </span>
                    <span className="text-[9px] text-roe-textMuted uppercase">(2 Chiffres)</span>
                  </div>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="Ex: 36"
                    value={thirdPrize}
                    onChange={(e) => setThirdPrize(e.target.value.replace(/[^0-9]/g, ''))}
                    required
                    className="w-full text-center font-mono font-black text-xl py-3 rounded-xl bg-roe-card border border-roe-border text-white focus:outline-none"
                  />
                  <div className="text-center text-[9px] text-roe-textMuted font-mono">
                    Borlette 3e
                  </div>
                </div>
              </div>

              {/* Aperçu Visuel Certifié */}
              <div className="p-3.5 rounded-2xl bg-roe-card border border-roe-gold/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Trophy size={13} className="text-roe-gold" />
                    <span>Aperçu Tirage Borlette Haïtienne</span>
                  </span>
                  <span className="text-[10px] text-roe-gold font-mono font-bold">Standard Officiel</span>
                </div>

                <div className="flex items-center justify-center gap-2 py-1">
                  <div className="flex flex-col items-center">
                    <span className="px-3.5 py-1.5 rounded-xl bg-roe-gold text-roe-bg font-mono font-black text-lg shadow-md">
                      {firstPrize ? firstPrize.padStart(3, '0') : '040'}
                    </span>
                    <span className="text-[9px] text-roe-gold mt-1 font-bold">
                      Lòt 3 : {firstPrize ? firstPrize.padStart(3, '0') : '040'}
                    </span>
                    <span className="text-[9px] text-white/80 font-mono">
                      1er Lot : {firstPrize ? firstPrize.slice(-2).padStart(2, '0') : '40'}
                    </span>
                  </div>

                  <span className="text-xl font-bold text-roe-textMuted pb-6">-</span>

                  <div className="flex flex-col items-center">
                    <span className="px-3.5 py-1.5 rounded-xl bg-roe-surface border border-roe-border text-white font-mono font-black text-lg shadow-md">
                      {secondPrize ? secondPrize.padStart(2, '0') : '22'}
                    </span>
                    <span className="text-[9px] text-roe-textMuted mt-1 font-bold">2e Lot</span>
                    <span className="text-[9px] text-white/80 font-mono">
                      {secondPrize ? secondPrize.padStart(2, '0') : '22'}
                    </span>
                  </div>

                  <span className="text-xl font-bold text-roe-textMuted pb-6">-</span>

                  <div className="flex flex-col items-center">
                    <span className="px-3.5 py-1.5 rounded-xl bg-roe-surface border border-roe-border text-white font-mono font-black text-lg shadow-md">
                      {thirdPrize ? thirdPrize.padStart(2, '0') : '36'}
                    </span>
                    <span className="text-[9px] text-roe-textMuted mt-1 font-bold">3e Lot</span>
                    <span className="text-[9px] text-white/80 font-mono">
                      {thirdPrize ? thirdPrize.padStart(2, '0') : '36'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                ⚠️ <strong>Important :</strong> La validation déclenchera le calcul mathématique automatique de tous les tickets vendus (Borlette, Lòt 3, Maryaj, Lòt 4, Lòt 5), l’attribution des gains aux gagnants et le calcul des commissions vendeurs.
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

      {/* MODAL 4 : PARAMÉTRAGE PERMANENT DES HORAIRES D'UNE LOTERIE */}
      {isScheduleModalOpen && selectedGameForSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-roe-surface border border-roe-border/80 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders size={20} className="text-roe-gold" />
                <span>Horaires : {selectedGameForSchedule.name}</span>
              </h3>
            </div>

            <p className="text-xs text-roe-textMuted mb-4">
              Enregistrez les heures de fermeture pour cette loterie. Une fois sauvegardées, le système automatique ouvrira et fermera chaque jour à ces heures exactes sans intervention manuelle.
            </p>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div className="p-4 rounded-2xl bg-roe-card border border-roe-border/60 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1">
                    Fermeture Tirage Midi (HH:mm)
                  </label>
                  <input
                    type="time"
                    required
                    value={midiCloseTime}
                    onChange={(e) => setMidiCloseTime(e.target.value)}
                    className="w-full text-center font-mono font-bold text-lg py-2 rounded-xl bg-roe-surface border border-roe-border text-white focus:outline-none focus:border-roe-gold"
                  />
                  <p className="text-[10px] text-roe-textMuted mt-1">
                    {LOTTERY_SCHEDULE_INFO[selectedGameForSchedule.code]
                      ? `Tirage officiel : ${LOTTERY_SCHEDULE_INFO[selectedGameForSchedule.code].midiDraw} (Clôture recommandée : ${LOTTERY_SCHEDULE_INFO[selectedGameForSchedule.code].midiClose})`
                      : 'Fermeture des ventes avant le tirage officiel.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-roe-border/40">
                  <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1">
                    Fermeture Tirage Soir (HH:mm)
                  </label>
                  <input
                    type="time"
                    required
                    value={soirCloseTime}
                    onChange={(e) => setSoirCloseTime(e.target.value)}
                    className="w-full text-center font-mono font-bold text-lg py-2 rounded-xl bg-roe-surface border border-roe-border text-white focus:outline-none focus:border-roe-gold"
                  />
                  <p className="text-[10px] text-roe-textMuted mt-1">
                    {LOTTERY_SCHEDULE_INFO[selectedGameForSchedule.code]
                      ? `Tirage officiel : ${LOTTERY_SCHEDULE_INFO[selectedGameForSchedule.code].soirDraw} (Clôture recommandée : ${LOTTERY_SCHEDULE_INFO[selectedGameForSchedule.code].soirClose})`
                      : 'Fermeture des ventes avant le tirage officiel.'}
                  </p>
                </div>
              </div>

              {/* Multiplicateurs de Gains Personnalisables (1er, 2e, 3e lot) */}
              <div className="p-4 rounded-2xl bg-roe-card border border-roe-gold/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-roe-gold uppercase tracking-wider">
                    Multiplicateurs de Gains (Bòlèt)
                  </span>
                  <span className="text-[10px] text-roe-textMuted font-mono">Modifiable par l'Admin</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <label className="block text-[11px] font-bold text-roe-gold uppercase mb-1">
                      1er Lot
                    </label>
                    <div className="flex items-center justify-center bg-roe-surface border border-roe-gold/50 rounded-xl px-2 py-1.5">
                      <span className="text-xs font-bold text-roe-gold mr-1">X</span>
                      <input
                        type="number"
                        min={1}
                        value={firstLotMultiplier}
                        onChange={(e) => setFirstLotMultiplier(Number(e.target.value))}
                        className="w-12 text-center font-mono font-black text-sm bg-transparent text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white uppercase mb-1">
                      2e Lot
                    </label>
                    <div className="flex items-center justify-center bg-roe-surface border border-roe-border rounded-xl px-2 py-1.5">
                      <span className="text-xs font-bold text-roe-textMuted mr-1">X</span>
                      <input
                        type="number"
                        min={1}
                        value={secondLotMultiplier}
                        onChange={(e) => setSecondLotMultiplier(Number(e.target.value))}
                        className="w-12 text-center font-mono font-black text-sm bg-transparent text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white uppercase mb-1">
                      3e Lot
                    </label>
                    <div className="flex items-center justify-center bg-roe-surface border border-roe-border rounded-xl px-2 py-1.5">
                      <span className="text-xs font-bold text-roe-textMuted mr-1">X</span>
                      <input
                        type="number"
                        min={1}
                        value={thirdLotMultiplier}
                        onChange={(e) => setThirdLotMultiplier(Number(e.target.value))}
                        className="w-12 text-center font-mono font-black text-sm bg-transparent text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-roe-border/40 flex items-center justify-between">
                  <span className="text-[11px] text-roe-textMuted font-bold">Maryaj (Multiplicateur) :</span>
                  <div className="flex items-center bg-roe-surface border border-roe-border rounded-xl px-2.5 py-1">
                    <span className="text-xs font-bold text-roe-textMuted mr-1">X</span>
                    <input
                      type="number"
                      min={100}
                      value={mariageMultiplier}
                      onChange={(e) => setMariageMultiplier(Number(e.target.value))}
                      className="w-16 text-center font-mono font-black text-xs bg-transparent text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>


              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-start gap-2">
                <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Ces heures sont enregistrées dans la base de données et restent actives en permanence jusqu'à modification future.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-roe-border/50">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-roe-card text-roe-textMuted hover:text-white text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={scheduleSaveLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-roe-gold to-amber-500 text-roe-bg text-xs font-extrabold shadow-lg disabled:opacity-50 flex items-center gap-1.5"
                >
                  {scheduleSaveLoading ? 'Enregistrement...' : 'Enregistrer Définitivement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
