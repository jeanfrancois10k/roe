'use client';

import React from 'react';
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
} from 'lucide-react';

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

  const navItems: NavItem[] = [
    { name: 'Tableau de bord', href: '/', icon: LayoutDashboard },
    { name: 'Vendeurs & POS', href: '/vendors', icon: Users },
    { name: 'Piste d’Audit', href: '/audit', icon: ShieldAlert },
    { name: 'Transactions Ledger', href: '/#ledger', icon: ReceiptText },
    { name: 'Jeux & Tirages', href: '/#draws', icon: Dices },
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
        <div className="p-4 border-t border-roe-border/60 bg-roe-card/40">
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
        </div>
      </aside>
    </>
  );
};
