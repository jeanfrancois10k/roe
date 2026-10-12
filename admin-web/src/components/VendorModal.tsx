'use client';

import React, { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { getCurrencySymbol } from '../lib/currency';

interface VendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vendorToEdit?: any;
  currency?: string;
}

export const VendorModal: React.FC<VendorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vendorToEdit,
  currency = 'HTG',
}) => {
  const isEditing = !!vendorToEdit;

  const [formData, setFormData] = useState({
    fullName: vendorToEdit?.fullName || '',
    phone: vendorToEdit?.phone || '',
    posAddress: vendorToEdit?.posAddress || '',
    username: vendorToEdit?.user?.username || '',
    password: '',
    pin: '',
    creditLimit: vendorToEdit?.creditLimit || 0,
    dailySalesLimit: vendorToEdit?.dailySalesLimit || 5000,
    maxTicketAmount: vendorToEdit?.maxTicketAmount || 500,
    defaultCommissionRate: vendorToEdit?.defaultCommissionRate || 5.0,
    initialBalance: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditing) {
        await api.patch(`/api/v1/admin/vendors/${vendorToEdit.id}`, {
          fullName: formData.fullName,
          phone: formData.phone,
          posAddress: formData.posAddress,
          creditLimit: Number(formData.creditLimit),
          dailySalesLimit: Number(formData.dailySalesLimit),
          maxTicketAmount: Number(formData.maxTicketAmount),
          defaultCommissionRate: Number(formData.defaultCommissionRate),
        });
      } else {
        await api.post('/api/v1/admin/vendors', {
          ...formData,
          creditLimit: Number(formData.creditLimit),
          dailySalesLimit: Number(formData.dailySalesLimit),
          maxTicketAmount: Number(formData.maxTicketAmount),
          defaultCommissionRate: Number(formData.defaultCommissionRate),
          initialBalance: Number(formData.initialBalance),
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl my-8 bg-roe-surface border border-roe-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-roe-border bg-roe-card/50">
          <h3 className="text-lg font-bold text-white">
            {isEditing ? `Modifier Vendeur : ${vendorToEdit.vendorCode}` : 'Créer un Nouveau Vendeur'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-roe-textMuted hover:text-white rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                Nom Complet *
              </label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Ex: Jean Baptiste"
                className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                Téléphone *
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+509 3700 0000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
              Adresse du Point de Vente *
            </label>
            <input
              type="text"
              required
              value={formData.posAddress}
              onChange={(e) => setFormData({ ...formData, posAddress: e.target.value })}
              placeholder="Ex: Kiosque 01, Boulevard Jean-Jacques Dessalines"
              className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
            />
          </div>

          {!isEditing && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-roe-border/60">
                <div>
                  <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                    Identifiant *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="vendeur01"
                    className="w-full px-3 py-2 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                    Mot de passe *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min 6 caractères"
                    className="w-full px-3 py-2 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                    Code PIN POS
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    placeholder="4-6 chiffres"
                    className="w-full px-3 py-2 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                  Solde Initial Alloué ({getCurrencySymbol(currency)})
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.initialBalance}
                  onChange={(e) => setFormData({ ...formData, initialBalance: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
                />
              </div>
            </>
          )}

          {/* Plafonds financiers */}
          <div className="pt-2 border-t border-roe-border/60">
            <h4 className="text-xs font-bold text-roe-gold uppercase tracking-wider mb-3">
              Limites & Plafonds Financiers ({getCurrencySymbol(currency)})
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-roe-textMuted mb-1">
                  Découvert ({getCurrencySymbol(currency)})
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 rounded-lg bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-roe-textMuted mb-1">
                  Plafond Jour ({getCurrencySymbol(currency)})
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.dailySalesLimit}
                  onChange={(e) => setFormData({ ...formData, dailySalesLimit: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 rounded-lg bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-roe-textMuted mb-1">
                  Max / Ticket ({getCurrencySymbol(currency)})
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.maxTicketAmount}
                  onChange={(e) => setFormData({ ...formData, maxTicketAmount: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 rounded-lg bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-roe-textMuted mb-1">
                  Commission (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={formData.defaultCommissionRate}
                  onChange={(e) => setFormData({ ...formData, defaultCommissionRate: Number(e.target.value) })}
                  className="w-full px-2.5 py-2 rounded-lg bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-roe-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-roe-textMuted hover:text-white text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-roe-gold to-roe-goldDark text-roe-bg text-sm font-bold shadow-lg hover:shadow-roe-gold/20 hover:scale-[1.02] transition-all disabled:opacity-50"
            >
              <Check size={16} />
              <span>{loading ? 'Enregistrement...' : isEditing ? 'Sauvegarder' : 'Créer le Vendeur'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
