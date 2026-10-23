'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Dices,
  ReceiptText,
  ShieldAlert,
  Sliders,
  LogOut,
  X,
  Smartphone,
  BarChart3,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const router = useRouter();

  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (!newPassword || newPassword.length < 6) {
      setPwdError('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setPwdLoading(true);
    try {
      const res = await api.patch('/api/v1/auth/change-password', {
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      setPwdSuccess(res?.message || 'Mot de passe Super Admin modifié avec succès !');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPwdSuccess(null);
        setIsPwdModalOpen(false);
      }, 2000);
    } catch (err: any) {
      setPwdError(err.message || 'Erreur lors du changement de mot de passe.');
    } finally {
      setPwdLoading(false);
    }
  };

  const navItems: NavItem[] = [
    { name: 'Tableau de bord', href: '/', icon: LayoutDashboard },
    { name: 'Rapports des Ventes', href: '/reports', icon: BarChart3 },
    { name: 'Vendeurs & POS', href: '/vendors', icon: Users },
    { name: 'Jeux & Tirages', href: '/draws', icon: Dices },
    { name: 'Transactions Ledger', href: '/transactions', icon: ReceiptText },
    { name: 'Paramètres Loterie', href: '/settings', icon: Sliders },
    { name: 'Télécharger APK POS', href: '/download', icon: Smartphone, badge: 'v1.0.3' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('roe_access_token');
    localStorage.removeItem('roe_user');
    router.push('/login');
  };

  return (
    <>
      {/* Overlay Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col w-72 bg-roe-surface border-r border-roe-border/60 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-5 border-b border-roe-border/60 bg-roe-surface">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="ROE BOLET"
              className="w-11 h-11 rounded-full border border-roe-gold/40 shadow-lg glow-gold object-cover"
            />
            <div>
              <h1 className="font-bold text-lg tracking-wider text-roe-gold">ROE BOLET</h1>
              <p className="text-xs text-roe-textMuted tracking-wider uppercase font-semibold">
                Supervision Centrale
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-roe-textMuted hover:text-white rounded-lg lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-roe-purple/40 to-roe-purpleDark/20 text-roe-gold border border-roe-gold/30 shadow-md'
                    : 'text-roe-textMuted hover:text-white hover:bg-roe-card/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-roe-gold' : 'text-roe-textMuted'} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-roe-card text-roe-textMuted border border-roe-border">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer / User Session */}
        <div className="p-4 border-t border-roe-border/60 bg-roe-card/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-roe-gold to-roe-goldDark text-roe-bg font-bold flex items-center justify-center text-xs shadow-md">
                SA
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">Super Admin</p>
                <p className="text-xs text-roe-gold/80 font-mono">admin@roebolet.com</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Se déconnecter"
              className="p-2 text-roe-textMuted hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setPwdError(null);
              setPwdSuccess(null);
              setIsPwdModalOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-roe-gold/15 hover:bg-roe-gold/25 text-roe-gold border border-roe-gold/40 text-xs font-bold transition-all"
          >
            <KeyRound size={14} />
            <span>Modifier Mot de Passe Admin</span>
          </button>
        </div>
      </aside>

      {/* Modal de Modification du Mot de Passe Super Admin */}
      {isPwdModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-roe-surface border border-roe-gold/50 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-roe-border bg-roe-card/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-roe-gold/20 text-roe-gold">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">Mot de Passe Super Admin</h3>
                  <p className="text-[11px] text-roe-textMuted">Sécurité du compte principal</p>
                </div>
              </div>
              <button
                onClick={() => setIsPwdModalOpen(false)}
                className="p-1.5 text-roe-textMuted hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangeAdminPassword} className="p-5 space-y-4">
              {pwdSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{pwdSuccess}</span>
                </div>
              )}

              {pwdError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{pwdError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-roe-textMuted mb-1.5">
                  Mot de passe actuel (optionnel)
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-roe-dark border border-roe-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-roe-gold mb-1.5">
                  Nouveau mot de passe Super Admin *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 caractères"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-roe-dark border border-roe-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white mb-1.5">
                  Confirmer le nouveau mot de passe *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Retapez le nouveau mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-roe-dark border border-roe-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-roe-border/60">
                <button
                  type="button"
                  onClick={() => setIsPwdModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-roe-textMuted hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-roe-gold to-amber-500 text-roe-bg text-xs font-black shadow-lg hover:scale-[1.02] transition"
                >
                  {pwdLoading ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                  <span>{pwdLoading ? 'Enregistrement...' : 'Enregistrer le Mot de Passe'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
