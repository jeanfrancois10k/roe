'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { api } from '@/lib/api';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Activity,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Server,
  Database,
  Radio,
  Cpu,
  X,
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  action: string;
  resource: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  oldPayload?: any;
  newPayload?: any;
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

interface SystemHealth {
  status: string;
  timestamp: string;
  uptimeSeconds: number;
  database: {
    status: string;
    latencyMs: number;
  };
  system: {
    nodeVersion: string;
    memoryRssMb: number;
    memoryHeapUsedMb: number;
    memoryHeapTotalMb: number;
  };
  realtime: {
    activeConnectedClients: number;
  };
}

export default function AuditPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal payload / diff
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Modal santé système
  const [healthOpen, setHealthOpen] = useState(false);
  const [healthData, setHealthData] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('roe_access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchActions();
    fetchLogs();
  }, [page, selectedAction]);

  const fetchActions = async () => {
    try {
      const res = await api.get<string[]>('/api/v1/audit/actions');
      setActions(res || []);
    } catch (err) {
      console.error('Erreur chargement actions', err);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', '25');
      if (selectedAction) params.append('action', selectedAction);
      if (search) params.append('search', search);

      const res = await api.get<{
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        items: AuditLogItem[];
      }>(`/api/v1/audit?${params.toString()}`);

      setLogs(res.items || []);
      setTotalPages(res.totalPages || 1);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Erreur chargement logs d’audit', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await api.get<SystemHealth>('/api/v1/health');
      setHealthData(res);
      setHealthOpen(true);
    } catch (err) {
      console.error('Erreur chargement santé système', err);
    } finally {
      setHealthLoading(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('SUSPEND') || action.includes('CANCEL') || action.includes('OVERRID')) {
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }
    if (action.includes('PAID') || action.includes('SOLD') || action.includes('DEPOSIT')) {
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
    if (action.includes('PUBLISH') || action.includes('ADJUST') || action.includes('SYNC')) {
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
    return 'bg-roe-purple/20 text-purple-300 border-roe-purple/40';
  };

  return (
    <div className="flex h-screen bg-roe-bg overflow-hidden text-white font-sans">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto lg:pl-72">
        <Header
          onToggleSidebar={() => setSidebarOpen(true)}
          title="Piste d’Audit & Sécurité"
          isLive={true}
          onRefresh={() => {
            setPage(1);
            fetchLogs();
          }}
          isRefreshing={loading}
        />

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-roe-border/60 pb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="text-roe-gold" size={26} />
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Piste d’Audit & Sécurité
                </h1>
              </div>
              <p className="text-sm text-roe-textMuted mt-1">
                Registre légal immuable des actions sensibles, contrôles à distance et écritures financières ({total} entrées)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchHealth}
                disabled={healthLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-roe-surface hover:bg-roe-card border border-roe-border text-sm font-semibold transition-all shadow-sm hover:border-roe-gold/50"
              >
                <Activity size={16} className="text-emerald-400 animate-pulse" />
                <span>Santé Système</span>
              </button>

              <button
                onClick={() => {
                  setPage(1);
                  fetchLogs();
                }}
                className="p-2.5 rounded-xl bg-roe-surface hover:bg-roe-card border border-roe-border text-roe-textMuted hover:text-white transition-all shadow-sm"
                title="Actualiser"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Filtres et Recherche */}
          <div className="bg-roe-surface border border-roe-border/80 rounded-2xl p-4 shadow-lg space-y-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-roe-textMuted" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher par action, ressource, adresse IP, nom d’utilisateur..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-roe-card border border-roe-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-roe-textMuted focus:outline-none focus:border-roe-gold transition-colors"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="relative min-w-[220px]">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-roe-textMuted" size={16} />
                  <select
                    value={selectedAction}
                    onChange={(e) => {
                      setSelectedAction(e.target.value);
                      setPage(1);
                    }}
                    className="w-full bg-roe-card border border-roe-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-roe-gold transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">Toutes les actions</option>
                    {actions.map((act) => (
                      <option key={act} value={act}>
                        {act}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-roe-gold text-roe-bg font-bold rounded-xl text-sm hover:brightness-110 transition-all shadow-md"
                >
                  Filtrer
                </button>
              </div>
            </form>
          </div>

          {/* Table des Logs */}
          <div className="bg-roe-surface border border-roe-border/80 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-roe-border/80 bg-roe-card/50 text-roe-textMuted uppercase text-[11px] font-bold tracking-wider">
                    <th className="py-3.5 px-4">Date & Heure</th>
                    <th className="py-3.5 px-4">Action</th>
                    <th className="py-3.5 px-4">Opérateur</th>
                    <th className="py-3.5 px-4">Ressource</th>
                    <th className="py-3.5 px-4">IP / Origine</th>
                    <th className="py-3.5 px-4 text-right">Détails Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-roe-border/50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-roe-textMuted">
                        <RefreshCw className="animate-spin mx-auto mb-2 text-roe-gold" size={24} />
                        Chargement de la piste d’audit...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-roe-textMuted">
                        Aucun journal d’audit correspondant aux filtres.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-roe-card/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-white/90 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border tracking-wider uppercase font-mono ${getActionBadgeColor(
                              log.action,
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.user ? (
                            <div>
                              <p className="font-semibold text-white leading-tight">
                                {log.user.username}
                              </p>
                              <span className="text-[10px] uppercase font-bold text-roe-gold">
                                {log.user.role}
                              </span>
                            </div>
                          ) : (
                            <span className="text-roe-textMuted italic text-xs">Système</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-white/80 whitespace-nowrap">
                          {log.resource}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-roe-textMuted whitespace-nowrap">
                          {log.ipAddress || '127.0.0.1'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-roe-card hover:bg-roe-purple/30 border border-roe-border text-xs font-semibold text-roe-gold transition-colors"
                          >
                            <Eye size={14} />
                            <span>Inspecter</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-roe-border/60 bg-roe-card/30 text-xs text-roe-textMuted">
                <div>
                  Page <span className="font-bold text-white">{page}</span> sur{' '}
                  <span className="font-bold text-white">{totalPages}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg bg-roe-card border border-roe-border text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-roe-surface transition-colors"
                  >
                    Précédent
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg bg-roe-card border border-roe-border text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-roe-surface transition-colors"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal Détail & Diff Payload */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-roe-surface border border-roe-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-roe-border/80 bg-roe-card/50">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <ShieldAlert className="text-roe-gold" size={20} />
                  Inspection Audit : {selectedLog.action}
                </h3>
                <p className="text-xs text-roe-textMuted font-mono mt-0.5">
                  Ressource : {selectedLog.resource} | {new Date(selectedLog.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-roe-textMuted hover:text-white rounded-lg hover:bg-roe-card transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Informations Générales */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-roe-card p-4 rounded-xl border border-roe-border text-xs">
                <div>
                  <span className="text-roe-textMuted block">Opérateur :</span>
                  <span className="font-semibold text-white">{selectedLog.user?.username || 'Système'}</span>
                </div>
                <div>
                  <span className="text-roe-textMuted block">Rôle :</span>
                  <span className="font-semibold text-roe-gold">{selectedLog.user?.role || 'SYSTEM'}</span>
                </div>
                <div>
                  <span className="text-roe-textMuted block">Adresse IP :</span>
                  <span className="font-mono text-white">{selectedLog.ipAddress || '127.0.0.1'}</span>
                </div>
                <div>
                  <span className="text-roe-textMuted block">Date :</span>
                  <span className="font-mono text-white">
                    {new Date(selectedLog.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Payloads Diff */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ancien Payload */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <XCircle size={14} /> État Antérieur (Old Payload)
                  </label>
                  <pre className="p-4 bg-roe-bg border border-roe-border rounded-xl text-xs font-mono text-white/80 overflow-x-auto max-h-72">
                    {selectedLog.oldPayload
                      ? JSON.stringify(selectedLog.oldPayload, null, 2)
                      : '// Aucun état antérieur (Création initiale)'}
                  </pre>
                </div>

                {/* Nouvel État */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Nouvel État (New Payload)
                  </label>
                  <pre className="p-4 bg-roe-bg border border-roe-border rounded-xl text-xs font-mono text-white/80 overflow-x-auto max-h-72">
                    {selectedLog.newPayload
                      ? JSON.stringify(selectedLog.newPayload, null, 2)
                      : '// Aucun nouvel état'}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-roe-border bg-roe-card/40 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 rounded-xl bg-roe-card hover:bg-roe-surface border border-roe-border text-sm font-semibold text-white transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Santé Système */}
      {healthOpen && healthData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-roe-surface border border-roe-border rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-roe-border bg-roe-card/50">
              <div className="flex items-center gap-2.5">
                <Activity className="text-emerald-400" size={22} />
                <h3 className="font-bold text-lg text-white">Monitoring & Santé Système</h3>
              </div>
              <button
                onClick={() => setHealthOpen(false)}
                className="p-1.5 text-roe-textMuted hover:text-white rounded-lg hover:bg-roe-card transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="flex items-center justify-between p-4 rounded-xl bg-roe-card border border-roe-border">
                <span className="font-semibold text-white">Statut Global :</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    healthData.status === 'HEALTHY'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  {healthData.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-roe-card border border-roe-border space-y-1">
                  <div className="flex items-center gap-2 text-roe-textMuted text-xs">
                    <Database size={15} className="text-roe-gold" />
                    <span>PostgreSQL</span>
                  </div>
                  <p className="text-lg font-bold text-white font-mono">
                    {healthData.database.status} ({healthData.database.latencyMs} ms)
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-roe-card border border-roe-border space-y-1">
                  <div className="flex items-center gap-2 text-roe-textMuted text-xs">
                    <Radio size={15} className="text-roe-purple" />
                    <span>Terminaux POS Actifs</span>
                  </div>
                  <p className="text-lg font-bold text-white font-mono">
                    {healthData.realtime.activeConnectedClients} connectés
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-roe-card border border-roe-border space-y-1">
                  <div className="flex items-center gap-2 text-roe-textMuted text-xs">
                    <Cpu size={15} className="text-blue-400" />
                    <span>Mémoire Heap</span>
                  </div>
                  <p className="text-lg font-bold text-white font-mono">
                    {healthData.system.memoryHeapUsedMb} MB / {healthData.system.memoryHeapTotalMb} MB
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-roe-card border border-roe-border space-y-1">
                  <div className="flex items-center gap-2 text-roe-textMuted text-xs">
                    <Clock size={15} className="text-amber-400" />
                    <span>Uptime Serveur</span>
                  </div>
                  <p className="text-lg font-bold text-white font-mono">
                    {Math.floor(healthData.uptimeSeconds / 60)} min {healthData.uptimeSeconds % 60} s
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-roe-border bg-roe-card/40 flex justify-end">
              <button
                onClick={() => setHealthOpen(false)}
                className="px-5 py-2 rounded-xl bg-roe-gold text-roe-bg font-bold text-sm hover:brightness-110 transition-all shadow-md"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
