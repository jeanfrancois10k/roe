'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Sparkles, KeyRound, Shield, Sliders, Smartphone } from 'lucide-react';
import { api } from '../lib/api';
import { getCurrencySymbol } from '../lib/currency';

interface VendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vendorToEdit?: any;
  currency?: string;
}

export function combineNameToUsername(name: string, pin: string): string {
  const cleanName = (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  const cleanPin = (pin || '').trim();
  return `${cleanName}${cleanPin}`;
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
    vendorCode: vendorToEdit?.vendorCode || '',
    fullName: vendorToEdit?.fullName || '',
    phone: vendorToEdit?.phone || '',
    posAddress: vendorToEdit?.posAddress || '',
    username: vendorToEdit?.user?.username || '',
    password: '',
    pin: '',
    status: vendorToEdit?.status || 'ACTIVE',
    creditLimit: vendorToEdit?.creditLimit || 0,
    dailySalesLimit: vendorToEdit?.dailySalesLimit || 5000,
    maxTicketAmount: vendorToEdit?.maxTicketAmount || 500,
    defaultCommissionRate: vendorToEdit?.defaultCommissionRate || 5.0,
    initialBalance: 0,
  });

  const [isUsernameManuallyEdited, setIsUsernameManuallyEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (vendorToEdit) {
      setFormData({
        vendorCode: vendorToEdit.vendorCode || '',
        fullName: vendorToEdit.fullName || '',
        phone: vendorToEdit.phone || '',
        posAddress: vendorToEdit.posAddress || '',
        username: vendorToEdit.user?.username || '',
        password: '',
        pin: '',
        status: vendorToEdit.status || 'ACTIVE',
        creditLimit: vendorToEdit.creditLimit || 0,
        dailySalesLimit: vendorToEdit.dailySalesLimit || 5000,
        maxTicketAmount: vendorToEdit.maxTicketAmount || 500,
        defaultCommissionRate: vendorToEdit.defaultCommissionRate || 5.0,
        initialBalance: 0,
      });
      setIsUsernameManuallyEdited(true);
    } else {
      setFormData({
        vendorCode: '',
        fullName: '',
        phone: '',
        posAddress: '',
        username: '',
        password: '',
        pin: '',
        status: 'ACTIVE',
        creditLimit: 0,
        dailySalesLimit: 5000,
        maxTicketAmount: 500,
        defaultCommissionRate: 5.0,
        initialBalance: 0,
      });
      setIsUsernameManuallyEdited(false);
    }
    setError(null);
  }, [vendorToEdit, isOpen]);

  if (!isOpen) return null;

  // Auto-combinaison Nom + PIN si l'identifiant n'a pas été tapé sur mesure
  const handleFullNameChange = (val: string) => {
    const updated = { ...formData, fullName: val };
    if (!isUsernameManuallyEdited || !formData.username) {
      updated.username = combineNameToUsername(val, formData.pin);
    }
    setFormData(updated);
  };

  const handlePinChange = (val: string) => {
    const cleanPin = val.replace(/[^0-9]/g, '');
    const updated = { ...formData, pin: cleanPin };
    if (!isUsernameManuallyEdited || !formData.username) {
      updated.username = combineNameToUsername(formData.fullName, cleanPin);
    }
    setFormData(updated);
  };

  const handleAutoCombineUsername = () => {
    const combined = combineNameToUsername(formData.fullName, formData.pin);
    setFormData({ ...formData, username: combined });
    setIsUsernameManuallyEdited(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation préalable du nom d'utilisateur
    const effectiveUsername = formData.username.trim() || combineNameToUsername(formData.fullName, formData.pin);
    if (!effectiveUsername) {
      setError("Le nom d'utilisateur est obligatoire (combinaison Nom + PIN)");
      setLoading(false);
      return;
    }

    try {
      if (isEditing) {
        const payload: any = {
          vendorCode: formData.vendorCode.trim(),
          fullName: formData.fullName.trim(),
          phone: formData.phone.trim(),
          posAddress: formData.posAddress.trim(),
          username: effectiveUsername,
          status: formData.status,
          creditLimit: Number(formData.creditLimit),
          dailySalesLimit: Number(formData.dailySalesLimit),
          maxTicketAmount: Number(formData.maxTicketAmount),
          defaultCommissionRate: Number(formData.defaultCommissionRate),
        };

        if (formData.password.trim()) {
          payload.password = formData.password.trim();
        }
        if (formData.pin.trim()) {
          payload.pin = formData.pin.trim();
        }

        await api.patch(`/api/v1/admin/vendors/${vendorToEdit.id}`, payload);
      } else {
        await api.post('/api/v1/admin/vendors', {
          vendorCode: formData.vendorCode.trim() || undefined,
          fullName: formData.fullName.trim(),
          phone: formData.phone.trim(),
          posAddress: formData.posAddress.trim(),
          username: effectiveUsername,
          password: formData.password,
          pin: formData.pin.trim() || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl my-6 bg-roe-surface border border-roe-border/80 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-roe-border/80 bg-roe-card/60 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders size={20} className="text-roe-gold" />
              <span>
                {isEditing
                  ? `Modifier Toutes les Informations : ${vendorToEdit.fullName} (${vendorToEdit.vendorCode})`
                  : 'Créer un Nouveau Compte Vendeur POS'}
              </span>
            </h3>
            <p className="text-xs text-roe-textMuted mt-0.5">
              {isEditing
                ? 'Coordonnées, identifiant (Nom + PIN), mot de passe, limites de vente et statut.'
                : 'Identifiant auto-généré sous forme de combinaison Nom + Code PIN.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-roe-textMuted hover:text-white rounded-xl bg-roe-card border border-roe-border transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION 1 : COORDONNÉES PRINCIPALES */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>1. Coordonnées & Point de Vente</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                  Nom Complet du Vendeur *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => handleFullNameChange(e.target.value)}
                  placeholder="Ex: Jean Baptiste"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                  Numéro de Téléphone *
                </label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+509 3700 0000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                  Adresse du Point de Vente (Kiosque / Succursale) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.posAddress}
                  onChange={(e) => setFormData({ ...formData, posAddress: e.target.value })}
                  placeholder="Ex: Kiosque 01, Rue Capois, Port-au-Prince"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                  Code Vendeur (ID Unique POS)
                </label>
                <input
                  type="text"
                  value={formData.vendorCode}
                  onChange={(e) => setFormData({ ...formData, vendorCode: e.target.value.toUpperCase() })}
                  placeholder={isEditing ? vendorToEdit.vendorCode : 'Auto-généré si vide (ex: VEND-001 ou NOM+PIN)'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none font-mono uppercase"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2 : ACCÈS, IDENTIFIANT (COMBINAISON NOM + PIN) & SÉCURITÉ */}
          <div className="p-4 rounded-2xl bg-roe-card/50 border border-roe-gold/30 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-roe-gold uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound size={15} />
                <span>2. Identifiants de Connexion & Sécurité POS</span>
              </h4>
              <button
                type="button"
                onClick={handleAutoCombineUsername}
                className="text-[11px] text-roe-gold hover:underline flex items-center gap-1 font-semibold"
                title="Régénérer automatiquement comme Nom + PIN"
              >
                <Sparkles size={13} />
                <span>Auto-Combiner (Nom + PIN)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Nom d'utilisateur (Combinaison Nom + PIN) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-roe-textMuted uppercase">
                    Nom d'Utilisateur *
                  </label>
                  <span className="text-[9px] text-amber-400 font-bold font-mono">NOM + PIN</span>
                </div>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => {
                    setFormData({ ...formData, username: e.target.value.toUpperCase() });
                    setIsUsernameManuallyEdited(true);
                  }}
                  placeholder="Ex: JEAN1234"
                  className="w-full px-3 py-2 rounded-xl bg-roe-surface border-2 border-roe-gold/60 text-roe-gold font-mono font-bold text-sm focus:border-roe-gold focus:outline-none uppercase"
                />
                <p className="text-[10px] text-roe-textMuted leading-tight">
                  ⚡ Combinaison du nom et du PIN pour faciliter la connexion.
                </p>
              </div>

              {/* Code PIN POS */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-roe-textMuted uppercase">
                  Code PIN POS (4-6 Chiffres)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={formData.pin}
                  onChange={(e) => handlePinChange(e.target.value)}
                  placeholder={isEditing ? 'Laisser vide si inchangé' : 'Ex: 1234'}
                  className="w-full px-3 py-2 rounded-xl bg-roe-surface border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none font-mono"
                />
                <p className="text-[10px] text-roe-textMuted leading-tight">
                  Utilisé par le terminal pour la saisie et validation rapide.
                </p>
              </div>

              {/* Mot de passe */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-roe-textMuted uppercase">
                  {isEditing ? 'Nouveau Mot de Passe' : 'Mot de Passe *'}
                </label>
                <input
                  type="password"
                  required={!isEditing}
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={isEditing ? 'Laisser vide si inchangé' : 'Min 6 caractères'}
                  className="w-full px-3 py-2 rounded-xl bg-roe-surface border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none"
                />
                <p className="text-[10px] text-roe-textMuted leading-tight">
                  {isEditing ? 'Optionnel (modifier uniquement si besoin)' : 'Pour connexion au portail'}
                </p>
              </div>
            </div>

            {/* Statut du Compte Vendeur */}
            <div className="pt-2 border-t border-roe-border/40 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-roe-textMuted uppercase">
                Statut du Compte :
              </span>
              <div className="flex items-center gap-2">
                {(['ACTIVE', 'SUSPENDED', 'BLOCKED'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFormData({ ...formData, status: st })}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                      formData.status === st
                        ? st === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                          : st === 'SUSPENDED'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500'
                        : 'bg-roe-surface text-roe-textMuted border-roe-border'
                    }`}
                  >
                    {st === 'ACTIVE' ? 'Actif' : st === 'SUSPENDED' ? 'Suspendu' : 'Bloqué'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 3 : LIMITES FINANCIÈRES & COMMISSIONS */}
          <div className="space-y-3 pt-2 border-t border-roe-border/60">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Shield size={15} className="text-roe-gold" />
              <span>3. Limites Financières & Paramètres de Vente ({getCurrencySymbol(currency)})</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-roe-textMuted mb-1">
                  Découvert ({getCurrencySymbol(currency)})
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none font-mono"
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
                  className="w-full px-3 py-2 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none font-mono"
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
                  className="w-full px-3 py-2 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none font-mono"
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
                  className="w-full px-3 py-2 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none font-mono"
                />
              </div>
            </div>

            {!isEditing && (
              <div>
                <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
                  Solde Initial Alloué ({getCurrencySymbol(currency)})
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.initialBalance}
                  onChange={(e) => setFormData({ ...formData, initialBalance: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none font-mono"
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-roe-border/60 shrink-0">
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
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-roe-gold to-amber-500 text-roe-bg text-sm font-extrabold shadow-lg hover:scale-105 transition-all disabled:opacity-50"
            >
              <Check size={16} />
              <span>{loading ? 'Enregistrement...' : isEditing ? 'Sauvegarder les Modifications' : 'Créer le Vendeur'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
