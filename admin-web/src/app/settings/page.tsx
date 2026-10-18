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
  Coins,
  QrCode,
  Sparkles,
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
            {/* FORMULAIRE DE CONFIGURATION (7 COLONNES) */}
            <form onSubmit={handleSaveSettings} className="lg:col-span-7 space-y-6">
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

            {/* APERÇU THERMIQUE EN TEMPS RÉEL (5 COLONNES) */}
            <div className="lg:col-span-5 sticky top-24 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-roe-gold uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={15} /> Aperçu Reçu Thermique POS
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-roe-card border border-roe-border text-roe-textMuted font-mono">
                  Format 58mm / 80mm
                </span>
              </div>

              {/* SIMULATEUR DE PAPIER THERMIQUE EXACT (Comme dans la photo de l'utilisateur) */}
              <div className="bg-[#f8f9fa] text-black font-mono text-xs p-5 rounded-2xl shadow-2xl border border-gray-300 relative select-none">
                {/* Icône Croissant de Lune / Logo */}
                <div className="text-center mb-2">
                  <div className="text-3xl font-black">🌙</div>
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
                  <div className="text-[10px] text-gray-500">
                    Date: {new Date().toISOString().slice(0, 10).replace(/-/g, '/')}  10h29 AM
                  </div>
                </div>

                <div className="text-center my-1.5 font-bold tracking-widest text-gray-400">
                  ********************************
                </div>

                {/* Nom du Tirage */}
                <div className="text-center font-bold text-sm uppercase">
                  New york midi
                </div>
                <div className="text-center text-[11px] text-gray-600">
                  #Ticket: 511666212356
                </div>

                <div className="text-center my-1.5 font-bold tracking-widest text-gray-400">
                  ********************************
                </div>

                {/* Grille de Jeux Joués */}
                <div className="space-y-1 my-2 text-[11px]">
                  <div className="flex justify-between">
                    <span>Borlette 95</span>
                    <span className="font-bold">4 000 HTG</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Borlette 86</span>
                    <span className="font-bold">4 000 HTG</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mariage 95*86</span>
                    <span className="font-bold">5 000 HTG</span>
                  </div>

                  <div className="text-center pt-1 font-bold text-[10px] text-gray-700">
                    Mariage Gratuit
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Mariage 45*00</span>
                    <span>xxxx HTG</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Mariage 09*11</span>
                    <span>xxxx HTG</span>
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
