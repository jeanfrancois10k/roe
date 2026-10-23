'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, ArrowUpRight, ArrowDownRight, Sparkles, ShieldAlert } from 'lucide-react';
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
  const [reason, setReason] = useState('Couverture du gain client');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentBalance = Number(vendor?.currentBalance || 0);
  const unpaidPrizesAmount = Number(vendor?.unpaidPrizesAmount || 0);
  const centralCreditsAmount = Number(vendor?.centralCreditsAmount || 0);
  const shortfallAmount = Math.max(0, Number((unpaidPrizesAmount - currentBalance).toFixed(2)));

  useEffect(() => {
    if (isOpen && vendor) {
      setDirection('CREDIT');
      setError(null);
      if (shortfallAmount > 0) {
        setAmount(shortfallAmount);
        setReason('Couverture du gain client');
      } else {
        setAmount('');
        setReason('Couverture du gain client');
      }
    }
  }, [isOpen, vendor, shortfallAmount]);

  if (!isOpen || !vendor) return null;

  const numericAmount = Number(amount || 0);
  const signedAmount = direction === 'CREDIT' ? numericAmount : -numericAmount;
  const projectedBalance = Number((currentBalance + signedAmount).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Veuillez saisir un montant strictement positif');
      return;
    }
    if (!reason.trim()) {
      setError('Le motif de l’opération est obligatoire');
      return;
    }

    setLoading(true);
    setError(null);

    const finalAmount = direction === 'CREDIT' ? Number(amount) : -Number(amount);

    try {
      await api.post(`/api/v1/admin/vendors/${vendor.id}/adjust-balance`, {
        amount: finalAmount,
        reason: reason.trim(),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-roe-surface border border-roe-border rounded-2xl shadow-2xl overflow-hidden my-4">
        <div className="flex items-center justify-between p-5 border-b border-roe-border bg-roe-card/50">
          <div>
            <h3 className="text-base font-bold text-white">
              Crédit Central & Couverture des Gains Vendeur
            </h3>
            <p className="text-xs text-roe-textMuted font-mono">
              {vendor.vendorCode} — {vendor.fullName}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-roe-textMuted hover:text-white rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Synthèse Financière Distinctive : Solde disponible / Gains à payer / Crédits Central */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-roe-card border border-roe-border/60">
              <p className="text-[10px] text-roe-textMuted uppercase font-bold">Solde Disponible</p>
              <p className="text-sm sm:text-base font-black text-roe-gold font-mono mt-0.5">
                {formatCurrency(currentBalance, currency)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-roe-card border border-roe-border/60">
              <p className="text-[10px] text-amber-400 uppercase font-bold">Gains à Payer</p>
              <p className="text-sm sm:text-base font-black text-amber-300 font-mono mt-0.5">
                {formatCurrency(unpaidPrizesAmount, currency)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-roe-card border border-roe-border/60">
              <p className="text-[10px] text-cyan-400 uppercase font-bold">Crédits Central</p>
              <p className="text-sm sm:text-base font-black text-cyan-300 font-mono mt-0.5">
                {formatCurrency(centralCreditsAmount, currency)}
              </p>
            </div>
          </div>

          {/* Alerte et bouton 1-clic si le vendeur manque de fonds pour payer un gagnant */}
          {shortfallAmount > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-100 leading-relaxed">
                  <span className="font-black text-amber-300">Couverture de gain requise :</span> Le vendeur dispose de{' '}
                  <strong className="font-mono">{formatCurrency(currentBalance, currency)}</strong> mais doit payer{' '}
                  <strong className="font-mono">{formatCurrency(unpaidPrizesAmount, currency)}</strong> de gains. Il manque{' '}
                  <strong className="font-mono text-white underline">{formatCurrency(shortfallAmount, currency)}</strong>.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDirection('CREDIT');
                  setAmount(shortfallAmount);
                  setReason('Couverture du gain client');
                }}
                className="w-full py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-roe-bg font-black text-xs flex items-center justify-center gap-1.5 shadow transition"
              >
                <Sparkles size={14} />
                <span>Attribuer automatiquement les {formatCurrency(shortfallAmount, currency)} manquants</span>
              </button>
            </div>
          )}

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
              <span>Crédit du Central (+)</span>
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
              <span>Débit / Retrait (-)</span>
            </button>
          </div>

          {/* Montant */}
          <div>
            <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
              Montant à {direction === 'CREDIT' ? 'créditer' : 'débiter'} ({getCurrencySymbol(currency)}) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Ex: 35000"
              className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm font-mono font-bold focus:border-roe-gold focus:outline-none"
            />
          </div>

          {/* Aperçu du nouveau solde après confirmation */}
          {numericAmount > 0 && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
              <span className="text-emerald-200 font-semibold">Nouveau solde disponible après validation :</span>
              <span className="font-mono font-black text-sm text-emerald-400">
                {formatCurrency(projectedBalance, currency)}
              </span>
            </div>
          )}

          {/* Motif */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-roe-textMuted uppercase">
              Motif de l’opération (Traçabilité Grand Livre) *
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Couverture du gain client',
                'Avance de trésorerie centrale',
                'Dépôt espèces en agence',
                'Règlement de caisse',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                    reason === preset
                      ? 'bg-roe-gold/20 border-roe-gold text-roe-gold'
                      : 'bg-roe-card border-roe-border text-roe-textMuted hover:text-white'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Couverture du gain client"
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
              <span>{loading ? 'Validation...' : 'Confirmer le Crédit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
