import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'gold' | 'purple' | 'emerald' | 'amber' | 'rose';
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'gold',
  trend,
}) => {
  const variantStyles = {
    gold: {
      border: 'border-roe-gold/30 hover:border-roe-gold/60',
      iconBg: 'bg-amber-400/10 text-roe-gold',
      glow: 'hover:shadow-[0_0_20px_rgba(255,215,0,0.15)]',
    },
    purple: {
      border: 'border-purple-500/30 hover:border-purple-500/60',
      iconBg: 'bg-purple-500/10 text-purple-400',
      glow: 'hover:shadow-[0_0_20px_rgba(109,40,217,0.15)]',
    },
    emerald: {
      border: 'border-emerald-500/30 hover:border-emerald-500/60',
      iconBg: 'bg-emerald-500/10 text-emerald-400',
      glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    },
    amber: {
      border: 'border-amber-500/30 hover:border-amber-500/60',
      iconBg: 'bg-amber-500/10 text-amber-400',
      glow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    },
    rose: {
      border: 'border-rose-500/30 hover:border-rose-500/60',
      iconBg: 'bg-rose-500/10 text-rose-400',
      glow: 'hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]',
    },
  };

  const currentVariant = variantStyles[variant];

  return (
    <div
      className={`p-5 rounded-2xl bg-gradient-to-b from-roe-card to-roe-surface border ${currentVariant.border} ${currentVariant.glow} transition-all duration-300 shadow-lg`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-roe-textMuted">
          {title}
        </span>
        <div className={`p-2.5 rounded-xl ${currentVariant.iconBg}`}>
          <Icon size={20} />
        </div>
      </div>

      <div className="mt-3">
        <div className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">{value}</div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 mt-1.5 text-xs text-roe-textMuted font-medium">
            {trend && <span className="text-emerald-400 font-semibold">{trend}</span>}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
