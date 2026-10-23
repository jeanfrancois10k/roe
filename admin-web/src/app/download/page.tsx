'use client';

import React from 'react';
import { Smartphone, Download, CheckCircle, ShieldCheck, ArrowRight, Dices } from 'lucide-react';

export default function DownloadAppPage() {
  return (
    <div className="min-h-screen bg-roe-bg text-white flex flex-col justify-between p-4 sm:p-6 md:p-10 font-sans">
      {/* En-tête */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-4 border-b border-roe-border/60">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="ROE Bolet" className="w-10 h-10 rounded-xl object-contain shadow-lg border border-roe-gold/40" />
          <div>
            <h1 className="text-lg font-black tracking-wider text-white">ROE BOLET</h1>
            <p className="text-[10px] text-roe-gold font-bold uppercase tracking-widest">Application Vendeur POS</p>
          </div>
        </div>

        <a
          href="/login"
          className="text-xs text-roe-textMuted hover:text-white transition-colors font-semibold"
        >
          Espace Admin →
        </a>
      </header>

      {/* Contenu Principal */}
      <main className="max-w-xl w-full mx-auto my-auto py-10 flex flex-col items-center text-center">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-roe-gold to-amber-500 p-1 shadow-2xl shadow-roe-gold/20 flex items-center justify-center">
            <img src="/logo.png" alt="ROE Logo" className="w-full h-full rounded-[22px] object-cover bg-roe-surface" />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1.5 shadow-lg border-2 border-roe-bg">
            <CheckCircle size={16} />
          </div>
        </div>

        <span className="px-3 py-1 rounded-full bg-roe-gold/10 border border-roe-gold/30 text-roe-gold text-xs font-black uppercase tracking-wider mb-3">
          Version Officielle v1.0.3 (Production)
        </span>

        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
          Téléchargez le Terminal de Vente Android
        </h2>

        <p className="text-sm text-roe-textMuted max-w-md mb-8 leading-relaxed">
          Application POS certifiée pour tous les smartphones, tablettes et terminaux de vente Android (Sunmi, Pax, etc.). Émission de tickets, vérification et paiement des gains en temps réel.
        </p>

        {/* Bouton de Téléchargement Principal */}
        <a
          href="/download/roe-bolet-vendor.apk?v=1.0.3"
          download="roe-bolet-vendor.apk"
          className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-roe-gold via-amber-400 to-roe-gold text-roe-bg font-black text-base shadow-xl shadow-roe-gold/25 hover:scale-105 active:scale-95 transition-all mb-4"
        >
          <Download size={22} className="stroke-[2.5]" />
          <span>TÉLÉCHARGER L'APPLICATION (APK)</span>
        </a>

        <p className="text-[11px] text-roe-textMuted flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Fichier APK v1.0.3 vérifié & sécurisé (17.7 Mo) • Prêt à l'installation</span>
        </p>

        {/* Guide d'installation rapide en 3 étapes */}
        <div className="w-full mt-12 p-6 rounded-2xl bg-roe-surface border border-roe-border/60 text-left">
          <h3 className="text-xs font-black uppercase tracking-wider text-roe-gold mb-4 flex items-center gap-2">
            <Smartphone size={16} />
            <span>Guide d'installation rapide :</span>
          </h3>

          <ol className="space-y-3 text-xs text-roe-textMuted">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-roe-card border border-roe-border text-white text-[10px] font-bold flex items-center justify-center">1</span>
              <span>Cliquez sur le bouton ci-dessus pour télécharger le fichier <strong>roe-bolet-vendor.apk</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-roe-card border border-roe-border text-white text-[10px] font-bold flex items-center justify-center">2</span>
              <span>Ouvrez le fichier téléchargé et appuyez sur <strong>Installer</strong> (autorisez l'installation d'applications si votre appareil le demande).</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-roe-card border border-roe-border text-white text-[10px] font-bold flex items-center justify-center">3</span>
              <span>Ouvrez l'application et connectez-vous avec votre <strong>Code Vendeur</strong> et <strong>Code PIN</strong>.</span>
            </li>
          </ol>
        </div>
      </main>

      {/* Pied de page */}
      <footer className="max-w-4xl w-full mx-auto py-4 border-t border-roe-border/60 text-center text-xs text-roe-textMuted">
        <p>© 2026 ROE BOLET • Plateforme Sécurisée de Borlette & Loteries Certifiées</p>
      </footer>
    </div>
  );
}
