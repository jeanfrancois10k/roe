'use client';

import React from 'react';
import { Menu, Bell, Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
  title: string;
  isLive?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  title,
  isLive = true,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 bg-roe-bg/85 backdrop-blur-md border-b border-roe-border/60">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-roe-textMuted hover:text-white rounded-lg lg:hidden"
        >
          <Menu size={22} />
        </button>
        <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
      </div>

      <div className="flex items-center gap-3">
        {/* Live Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-roe-card border border-roe-border text-xs">
          {isLive ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-400 font-medium">Temps Réel WSS</span>
            </>
          ) : (
            <>
              <WifiOff size={14} className="text-rose-400" />
              <span className="text-rose-400 font-medium">Déconnecté</span>
            </>
          )}
        </div>

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-roe-card hover:bg-roe-cardHover text-roe-textMuted hover:text-white border border-roe-border text-xs font-medium transition-all"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-roe-gold' : ''} />
            <span className="hidden md:inline">Actualiser</span>
          </button>
        )}
      </div>
    </header>
  );
};
