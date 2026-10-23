'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sliders,
  Building2,
  Phone,
  MapPin,
  FileText,
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  QrCode,
  Sparkles,
  Image as ImageIcon,
  Upload,
  Trash2,
  Sun,
  Moon,
  KeyRound,
  Lock,
} from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { api } from '../../lib/api';

export default function SettingsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Configuration Loterie / Borlette
  const [companyName, setCompanyName] = useState('ROE BOLET');
  const [companySlogan, setCompanySlogan] = useState('Juétwèt');
  const [companyPhone, setCompanyPhone] = useState('42327120');
  const [companyAddress, setCompanyAddress] = useState('Port-au-Prince, Haïti');
  const [bankRef, setBankRef] = useState('Bank 6');
  const [logoUrl, setLogoUrl] = useState('');
  const [ticketHeaderNote, setTicketHeaderNote] = useState('*** ORIGINAL FICHE ***');
  const [ticketFooterNote, setTicketFooterNote] = useState('FICH SA VALAB SELMAN POU 90 JOU. FICHE PAYABLE AU PORTEUR.');
  const [ticketProviderInfo, setTicketProviderInfo] = useState('ROE-TECH');
  const [ticketValidityDays, setTicketValidityDays] = useState(90);
  const [mariageGratuitNote, setMariageGratuitNote] = useState('MARYAJ GRATIS 1500 GDES');

  // Devise
  const [activeCurrency, setActiveCurrency] = useState('HTG');

  // Période de prévisualisation du ticket (Midi vs Soir)
  const [previewPeriod, setPreviewPeriod] = useState<'MIDI' | 'SOIR'>('MIDI');

  // Changement de mot de passe administrateur
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Remise à zéro de la base de données (Plateforme Vierge)
  const [resetDeleteVendors, setResetDeleteVendors] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetResultMessage, setResetResultMessage] = useState<string | null>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/api/v1/settings');
      if (res) {
        if (res.defaultCurrency) setActiveCurrency(res.defaultCurrency);
        if (res.lottery) {
          setCompanyName(res.lottery.companyName || 'ROE BOLET');
          setCompanySlogan(res.lottery.companySlogan || 'Juétwèt');
          setCompanyPhone(res.lottery.companyPhone || '42327120');
          setCompanyAddress(res.lottery.companyAddress || 'Port-au-Prince, Haïti');
          setBankRef(res.lottery.bankRef || 'Bank 6');
          setLogoUrl(res.lottery.logoUrl || '');
          setTicketHeaderNote(res.lottery.ticketHeaderNote || '*** ORIGINAL FICHE ***');
          setTicketFooterNote(res.lottery.ticketFooterNote || 'FICH SA VALAB SELMAN POU 90 JOU. FICHE PAYABLE AU PORTEUR.');
          setTicketProviderInfo(res.lottery.ticketProviderInfo || 'ROE-TECH');
          setTicketValidityDays(res.lottery.ticketValidityDays || 90);
          setMariageGratuitNote(res.lottery.mariageGratuitNote || 'MARYAJ GRATIS 1500 GDES');
        }
      }
    } catch (err: any) {
      console.error('Erreur chargement paramètres:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('roe_access_token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await api.patch('/api/v1/settings/lottery', {
        companyName,
        companySlogan,
        companyPhone,
        companyAddress,
        bankRef,
        logoUrl,
        ticketHeaderNote,
        ticketFooterNote,
        ticketProviderInfo,
        ticketValidityDays: Number(ticketValidityDays),
        mariageGratuitNote,
      });

      setSuccessMessage('✅ Paramètres de la Loterie enregistrés avec succès ! Tous les tickets POS appliqueront ces informations immédiatement.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de l’enregistrement des paramètres');
    } finally {
      setSaving(false);
    }
  };

  const handleCurrencyChange = async (currency: 'HTG' | 'USD') => {
    try {
      await api.patch('/api/v1/settings/currency', { currency });
      setActiveCurrency(currency);
    } catch (err: any) {
      alert(err.message || 'Impossible de changer la devise');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await api.patch('/api/v1/auth/change-password', {
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      setPasswordSuccess(res?.message || 'Mot de passe modifié avec succès !');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 6000);
    } catch (err: any) {
      setPasswordError(err.message || 'Erreur lors du changement de mot de passe.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleResetPlatform = async () => {
    setResetLoading(true);
    setResetResultMessage(null);
    setErrorMessage(null);

    try {
      const res = await api.post('/api/v1/settings/reset-platform', {
        deleteVendors: resetDeleteVendors,
      });
      setShowResetConfirmModal(false);
      setResetResultMessage(
        res?.message ||
          '✅ Base de données vidée avec succès ! Toutes les transactions et fiches ont été effacées.',
      );
      setTimeout(() => setResetResultMessage(null), 10000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la remise à zéro de la base de données.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-roe-dark text-white font-sans flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          title="Paramètres de la Loterie"
          onRefresh={fetchSettings}
          currency={activeCurrency}
          onCurrencyChange={handleCurrencyChange}
        />

        <main className="flex-1 p-3.5 sm:p-6 md:p-8 space-y-6 md:space-y-8 max-w-7xl w-full mx-auto">
          {/* Bannière et Titre */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-roe-surface p-5 rounded-2xl border border-roe-border/60 shadow-xl">
            <div>
              <div className="flex items-center gap-2">
                <Sliders className="text-roe-gold" size={26} />
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  Configuration Loterie & Impression des Fiches
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-roe-textMuted mt-1">
                Personnalisez le nom commercial de la borlette, l'entête, les coordonnées et les mentions légales pour les reçus thermiques.
              </p>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-roe-gold to-roe-goldDark text-roe-bg font-black text-xs sm:text-sm shadow-lg hover:scale-105 transition"
            >
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Enregistrement...' : 'Enregistrer les Modifications'}
            </button>
          </div>

          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm flex items-center gap-3">
              <CheckCircle2 size={20} className="flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs sm:text-sm flex items-center gap-3">
              <AlertTriangle size={20} className="flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* DEUX COLONNES : FORMULAIRE À GAUCHE & APERÇU TICKET THERMIQUE À DROITE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLONNE GAUCHE (7 COLONNES) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Carte 0 (En haut) : Sécurité & Mot de passe Super Admin */}
              <form onSubmit={handleChangePassword} className="bg-roe-surface p-5 sm:p-6 rounded-2xl border border-roe-gold/50 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm sm:text-base font-bold text-roe-gold flex items-center gap-2">
                    <KeyRound size={18} /> Sécurité & Modification du Mot de Passe Super Admin
                  </h2>
                  <span className="text-[11px] font-bold text-roe-gold bg-roe-gold/15 px-2.5 py-1 rounded-lg border border-roe-gold/40">
                    Super Admin
                  </span>
                </div>

                <p className="text-xs text-roe-textMuted">
                  Modifiez le mot de passe de connexion du compte Super Administrateur principal.
                </p>

                {passwordSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="flex-shrink-0" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                {passwordError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
                    <AlertTriangle size={16} className="flex-shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-roe-textMuted mb-1.5">
                      Mot de passe actuel (optionnel)
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-roe-gold mb-1.5">
                      Nouveau mot de passe *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Min. 6 caractères"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white mb-1.5">
                      Confirmer nouveau *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Confirmer"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-roe-gold text-roe-bg font-black text-xs shadow-md hover:scale-[1.02] transition"
                  >
                    {passwordLoading ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                    {passwordLoading ? 'Mise à jour...' : 'Modifier le mot de passe Super Admin'}
                  </button>
                </div>
              </form>

              {/* FORMULAIRE DE CONFIGURATION */}
              <form onSubmit={handleSaveSettings} className="space-y-6">
              {/* Carte 1 : Identité de la Loterie / Borlette */}
              <div className="bg-roe-surface p-5 sm:p-6 rounded-2xl border border-roe-border/60 space-y-4 shadow-xl">
                <h2 className="text-sm sm:text-base font-bold text-roe-gold flex items-center gap-2">
                  <Building2 size={18} /> Identité de la Loterie / Borlette
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-roe-textMuted mb-1.5">
                      Nom de la Borlette / Loterie *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: ST JN BAPTISTE LOTTO ou ROE BOLET"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-roe-gold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-roe-textMuted mb-1.5">
                      Slogan / Sous-titre
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Juétwèt ou La Reine des Loteries"
                      value={companySlogan}
                      onChange={(e) => setCompanySlogan(e.target.value)}
                      className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-roe-textMuted mb-1.5">
                      Téléphone / Contact POS
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 42327120 ou +509 3700-0000"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-roe-textMuted mb-1.5">
                      Banque / Succursale / Réf
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: bank 6 ou 145-106"
                      value={bankRef}
                      onChange={(e) => setBankRef(e.target.value)}
                      className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-roe-textMuted mb-1.5">
                    Adresse ou Siège Central
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Port-au-Prince, Haïti"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                  />
                </div>

                {/* Logo Officiel de la Borlette */}
                <div className="pt-3 border-t border-roe-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <ImageIcon size={15} className="text-roe-gold" /> Logo Officiel de la Borlette
                    </label>
                    <span className="text-[11px] text-roe-textMuted">PNG, JPG, SVG, WebP (Max 5 Mo)</span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 bg-roe-dark/70 rounded-xl border border-roe-border/60">
                    {/* Zone de prévisualisation du Logo */}
                    <div className="w-20 h-20 rounded-xl bg-white/5 border border-dashed border-roe-border flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                      <img
                        src={logoUrl || '/logo.png'}
                        alt="Logo Borlette"
                        className="w-full h-full object-contain p-1"
                      />
                    </div>

                    {/* Actions d'upload et URL */}
                    <div className="flex-1 w-full space-y-2.5">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-roe-gold/15 hover:bg-roe-gold/25 text-roe-gold border border-roe-gold/40 text-xs font-bold cursor-pointer transition">
                          <Upload size={14} />
                          <span>Choisir un logo...</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 5 * 1024 * 1024) {
                                  alert('L’image ne doit pas dépasser 5 Mo.');
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const result = ev.target?.result as string;
                                  if (result) setLogoUrl(result);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>

                        {logoUrl && (
                          <button
                            type="button"
                            onClick={() => setLogoUrl('')}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition"
                          >
                            <Trash2 size={13} />
                            <span>Supprimer</span>
                          </button>
                        )}
                      </div>

                      <input
                        type="url"
                        placeholder="Ou collez une URL d'image directe (https://...)"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        className="w-full bg-roe-dark border border-roe-border/70 rounded-lg px-3 py-2 text-xs text-white placeholder-roe-textMuted/60 focus:outline-none focus:border-roe-gold font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Carte 2 : En-tête & Pied de page Ticket Thermique */}
              <div className="bg-roe-surface p-5 sm:p-6 rounded-2xl border border-roe-border/60 space-y-4 shadow-xl">
                <h2 className="text-sm sm:text-base font-bold text-roe-gold flex items-center gap-2">
                  <Printer size={18} /> Modèle du Ticket Thermique
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-roe-textMuted mb-1.5">
                      Mention d'En-tête Ticket
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: *** ORIGINAL FICHE ***"
                      value={ticketHeaderNote}
                      onChange={(e) => setTicketHeaderNote(e.target.value)}
                      className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-roe-gold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-roe-textMuted mb-1.5">
                      Validité du Ticket (Jours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={ticketValidityDays}
                      onChange={(e) => setTicketValidityDays(Number(e.target.value))}
                      className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-roe-gold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-roe-textMuted mb-1.5">
                    Mention Spéciale Mariage Gratuit
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: MARYAJ GRATIS 1500 GDES"
                    value={mariageGratuitNote}
                    onChange={(e) => setMariageGratuitNote(e.target.value)}
                    className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-roe-textMuted mb-1.5">
                    Texte Légal de Pied de Page (Footer)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ex: FICH SA VALAB SELMAN POU 90 JOU. FICHE PAYABLE AU PORTEUR."
                    value={ticketFooterNote}
                    onChange={(e) => setTicketFooterNote(e.target.value)}
                    className="w-full bg-roe-dark border border-roe-border/70 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-roe-gold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-roe-textMuted mb-1.5">
                    Signature Fournisseur Informatique (Crédit Système)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: SGL-TECH / ROE-TECH"
                    value={ticketProviderInfo}
                    onChange={(e) => setTicketProviderInfo(e.target.value)}
                    className="w-full bg-roe-dark border border-roe-border/70 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-roe-gold"
                  />
                </div>
              </div>
            </form>

            {/* Carte 3 : Remise à Zéro de la Base de Données (Plateforme Vierge) */}
            <div className="bg-roe-surface p-5 sm:p-6 rounded-2xl border border-rose-500/40 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-bold text-rose-400 flex items-center gap-2">
                  <Trash2 size={18} /> Remise à Zéro de la Base de Données (Plateforme Vierge)
                </h2>
                <span className="text-[11px] font-bold text-rose-400 bg-rose-500/15 px-2.5 py-1 rounded-lg border border-rose-500/30">
                  Production
                </span>
              </div>

              <p className="text-xs text-roe-textMuted leading-relaxed">
                Effacez toutes les transactions financières, toutes les fiches vendues/annulées/payées, les anciens tirages, les numéros bloqués et les journaux d'audit afin de livrer une plateforme propre et vierge.
              </p>

              {resetResultMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="flex-shrink-0" />
                  <span>{resetResultMessage}</span>
                </div>
              )}

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-roe-dark/80 border border-roe-border/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetDeleteVendors}
                  onChange={(e) => setResetDeleteVendors(e.target.checked)}
                  className="w-4 h-4 accent-rose-500 rounded"
                />
                <span className="text-xs text-white font-semibold">
                  Supprimer également tous les comptes Vendeurs & Terminaux de test (Conserver uniquement le Super Admin et les 6 Loteries officielles)
                </span>
              </label>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg transition"
                >
                  <Trash2 size={14} />
                  Vider la Base de Données & Effacer les Transactions
                </button>
              </div>
            </div>

            {showResetConfirmModal && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-roe-surface border border-rose-500/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                  <div className="flex items-center gap-3 text-rose-400">
                    <AlertTriangle size={26} />
                    <h3 className="text-base font-black text-white">
                      Confirmer la Remise à Zéro ?
                    </h3>
                  </div>
                  <p className="text-xs text-roe-textMuted leading-relaxed">
                    Cette action va supprimer définitivement toutes les transactions, tous les tickets, l'historique des tirages de test{resetDeleteVendors ? ' ainsi que tous les comptes vendeurs de test' : ' et remettre les soldes vendeurs à 0 HTG'}.
                    Le compte Super Admin et les 6 loteries officielles seront conservés.
                  </p>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResetConfirmModal(false)}
                      disabled={resetLoading}
                      className="px-4 py-2 rounded-xl bg-roe-dark border border-roe-border text-xs font-bold text-white hover:bg-white/5"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleResetPlatform}
                      disabled={resetLoading}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg"
                    >
                      {resetLoading ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      {resetLoading ? 'Nettoyage en cours...' : 'Oui, Vider Maintenant'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* APERÇU THERMIQUE EN TEMPS RÉEL (5 COLONNES) */}
          <div className="lg:col-span-5 sticky top-24 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-roe-gold uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={15} /> Aperçu Reçu Thermique POS
                </span>

                {/* Switcher de Période (Midi vs Soir) */}
                <div className="flex items-center bg-roe-surface rounded-xl p-0.5 border border-roe-border/60">
                  <button
                    type="button"
                    onClick={() => setPreviewPeriod('MIDI')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      previewPeriod === 'MIDI'
                        ? 'bg-amber-400 text-black shadow'
                        : 'text-roe-textMuted hover:text-white'
                    }`}
                  >
                    <Sun size={12} /> MIDI
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPeriod('SOIR')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      previewPeriod === 'SOIR'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-roe-textMuted hover:text-white'
                    }`}
                  >
                    <Moon size={12} /> SOIR
                  </button>
                </div>
              </div>

              {/* SIMULATEUR DE PAPIER THERMIQUE EXACT */}
              <div className="bg-[#f8f9fa] text-black font-mono text-xs p-5 rounded-2xl shadow-2xl border border-gray-300 relative select-none">
                {/* Logo Officiel de la Loterie */}
                <div className="text-center mb-2">
                  <div className="flex justify-center mb-1.5">
                    <img
                      src={logoUrl || '/logo.png'}
                      alt="Logo Borlette"
                      className="max-h-16 max-w-[150px] object-contain"
                    />
                  </div>
                  <div className="text-[11px] font-bold tracking-widest text-gray-700 mt-1">
                    {ticketHeaderNote || '*** ORIGINAL FICHE ***'}
                  </div>
                  <div className="text-base font-black tracking-wide uppercase mt-1">
                    {companyName || 'ROE BOLET'}
                  </div>
                  {companySlogan && (
                    <div className="text-[11px] font-semibold text-gray-700">{companySlogan}</div>
                  )}
                  <div className="text-[11px] text-gray-600 mt-0.5">
                    {bankRef ? `${bankRef} • ` : ''}Tel: {companyPhone || '42327120'}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    POS: 0b274983f3351707
                  </div>
                  <div className="text-[10px] text-gray-700 font-bold">
                    Dat & Lè: {new Date().toISOString().slice(0, 10)} {previewPeriod === 'MIDI' ? '13:45:00' : '20:15:00'}
                  </div>
                </div>

                <div className="text-center my-1.5 font-bold tracking-widest text-gray-400">
                  ********************************
                </div>

                {/* Nom du Tirage avec Identification Claire MIDI / SOIR */}
                <div className="text-center font-bold text-sm uppercase">
                  NEW YORK - {previewPeriod}
                </div>
                <div className="flex justify-center my-1">
                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded tracking-wider ${
                      previewPeriod === 'MIDI'
                        ? 'bg-amber-100 text-amber-950 border border-amber-300'
                        : 'bg-indigo-100 text-indigo-950 border border-indigo-300'
                    }`}
                  >
                    [ TIRAJ {previewPeriod} ]
                  </span>
                </div>
                <div className="text-center text-[11px] text-gray-600 font-bold">
                  #Ticket: ROE-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}-8B0677C9
                </div>

                <div className="text-center my-1.5 font-bold tracking-widest text-gray-400">
                  ********************************
                </div>

                {/* Grille de Jeux Joués */}
                <div className="space-y-1 my-2 text-[11px]">
                  <div className="flex justify-between font-bold text-black">
                    <span>Borlette 95</span>
                    <span className="font-black">4 000 HTG</span>
                  </div>
                  <div className="flex justify-between font-bold text-black">
                    <span>Borlette 86</span>
                    <span className="font-black">4 000 HTG</span>
                  </div>
                  <div className="flex justify-between font-bold text-black">
                    <span>Mariage 95*86</span>
                    <span className="font-black">5 000 HTG</span>
                  </div>

                  <div className="text-center pt-1 font-bold text-[11px] text-black">
                    Mariage Gratuit
                  </div>
                  <div className="flex justify-between font-bold text-black">
                    <span>Mariage 45*00</span>
                    <span className="font-black">GRATUIT</span>
                  </div>
                  <div className="flex justify-between font-bold text-black">
                    <span>Mariage 09*11</span>
                    <span className="font-black">GRATUIT</span>
                  </div>
                </div>

                <div className="text-center my-1.5 font-bold tracking-widest text-gray-400">
                  ********************************
                </div>

                {/* Total */}
                <div className="flex justify-between items-center text-sm font-black pt-0.5">
                  <span>TOTAL</span>
                  <span>13 000 HTG</span>
                </div>

                <div className="text-center my-1.5 font-bold tracking-widest text-gray-400">
                  ********************************
                </div>

                {/* Code barre / Empreinte de sécurité */}
                <div className="text-center text-[9px] text-gray-500 font-mono tracking-tighter truncate">
                  Siyati: 1BAA9D6E-5097170826-0071
                </div>

                {/* Mentions Légales & Footer */}
                <div className="text-center text-[9px] text-gray-700 uppercase leading-tight mt-2 space-y-0.5">
                  <div>{ticketFooterNote || 'FICH SA VALAB SELMAN POU 90 JOU, FICHE PAYABLE AU PORTEUR'}</div>
                  {mariageGratuitNote && <div className="font-bold">{mariageGratuitNote}</div>}
                  <div className="text-[8px] text-gray-500 font-bold pt-1">{ticketProviderInfo || 'ROE-TECH'}</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
