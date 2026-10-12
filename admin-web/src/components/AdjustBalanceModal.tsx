'use client';

import React, { useState } from 'react';
import { X, Check, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, getCurrencySymbol } from '../lib/currency';

interface AdjustBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vendor: any;
  currency?: string;
}

export const AdjustBalanceModal: React.FC<AdjustBalanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vendor,
  currency = 'HTG',
}) => {
  const [direction, setDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !vendor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Veuillez saisir un montant positif');
      return;
    }
    if (!reason.trim()) {
      setError('Le motif de régularisation est obligatoire');
      return;
    }

    setLoading(true);
    setError(null);

    const finalAmount = direction === 'CREDIT' ? Number(amount) : -Number(amount);

    try {
      await api.post(`/api/v1/admin/vendors/${vendor.id}/adjust-balance`, {
        amount: finalAmount,
        reason,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la régularisation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-roe-surface border border-roe-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-roe-border bg-roe-card/50">
          <div>
            <h3 className="text-base font-bold text-white">Régularisation Comptable</h3>
            <p className="text-xs text-roe-textMuted font-mono">
              {vendor.vendorCode} - {vendor.fullName}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-roe-textMuted hover:text-white rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Solde actuel */}
          <div className="p-3.5 rounded-xl bg-roe-card border border-roe-border/60 flex items-center justify-between">
            <span className="text-xs text-roe-textMuted font-semibold">Solde Actuel</span>
            <span className="text-lg font-bold text-roe-gold font-mono">
              {formatCurrency(vendor.currentBalance, currency)}
            </span>
          </div>

          {/* Type : Crédit ou Débit */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('CREDIT')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                direction === 'CREDIT'
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-roe-card border-roe-border text-roe-textMuted hover:text-white'
              }`}
            >
              <ArrowUpRight size={16} />
              <span>Crédit (+)</span>
            </button>
            <button
              type="button"
              onClick={() => setDirection('DEBIT')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                direction === 'DEBIT'
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                  : 'bg-roe-card border-roe-border text-roe-textMuted hover:text-white'
              }`}
            >
              <ArrowDownRight size={16} />
              <span>Débit (-)</span>
            </button>
          </div>

          {/* Montant */}
          <div>
            <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
              Montant ({getCurrencySymbol(currency)}) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0.00"
              className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm font-mono focus:border-roe-gold focus:outline-none"
            />
          </div>

          {/* Motif */}
          <div>
            <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
              Motif de l’opération (Ledger Audit) *
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Dépôt espèces en agence, Rectification erreur..."
              className="w-full px-3.5 py-2 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-roe-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-roe-textMuted hover:text-white text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-roe-gold to-roe-goldDark text-roe-bg text-sm font-bold shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50"
            >
              <Check size={16} />
              <span>{loading ? 'Validation...' : 'Valider l’écriture'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
