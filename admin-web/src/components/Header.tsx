'use client';

import React from 'react';
import { Menu, Wifi, WifiOff, RefreshCw, Coins } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
  title: string;
  isLive?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  currency?: string;
  onCurrencyChange?: (newCurrency: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  title,
  isLive = true,
  onRefresh,
  isRefreshing = false,
  currency = 'HTG',
  onCurrencyChange,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-3 sm:px-6 md:px-8 bg-roe-bg/90 backdrop-blur-md border-b border-roe-border/60">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          aria-label="Ouvrir le menu"
          className="p-2 -ml-1 text-roe-textMuted hover:text-white rounded-xl bg-roe-card/60 border border-roe-border/50 lg:hidden flex-shrink-0"
        >
          <Menu size={20} />
        </button>
        <h2 className="text-sm sm:text-base md:text-xl font-bold text-white tracking-tight truncate">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Sélecteur de Devise Officielle (HTG / USD - Priorité Gourde) */}
        <div className="flex items-center rounded-xl bg-roe-card border border-roe-border p-1 text-xs font-semibold shadow-inner">
          <button
            onClick={() => onCurrencyChange && onCurrencyChange('HTG')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
              currency === 'HTG'
                ? 'bg-gradient-to-r from-roe-gold to-amber-500 text-roe-bg font-extrabold shadow-md'
                : 'text-roe-textMuted hover:text-white'
            }`}
            title="Gourde Haïtienne (HTG) - Devise Prioritaire"
          >
            <span>🇭🇹</span>
            <span>HTG (G)</span>
          </button>
          <button
            onClick={() => onCurrencyChange && onCurrencyChange('USD')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
              currency === 'USD'
                ? 'bg-gradient-to-r from-roe-gold to-amber-500 text-roe-bg font-extrabold shadow-md'
                : 'text-roe-textMuted hover:text-white'
            }`}
            title="Dollar Américain (USD)"
          >
            <span>🇺🇸</span>
            <span>USD ($)</span>
          </button>
        </div>

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
