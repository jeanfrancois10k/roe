'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/api/v1/auth/login', { username: username.trim(), password });
      localStorage.setItem('roe_access_token', res.accessToken);
      localStorage.setItem('roe_refresh_token', res.refreshToken);
      localStorage.setItem('roe_user', JSON.stringify(res.user));
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#07030C] relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-roe-purple/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-amber-500/15 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative w-full max-w-md bg-roe-surface/90 backdrop-blur-xl border border-roe-border/80 rounded-3xl p-8 shadow-2xl">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-1 rounded-full bg-gradient-to-tr from-roe-gold via-roe-purple to-roe-goldDark glow-gold shadow-2xl mb-4">
            <img
              src="/logo.png"
              alt="ROE BOLET"
              className="w-20 h-20 rounded-full object-cover"
            />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wider">ROE BOLET</h1>
          <p className="text-xs uppercase font-bold tracking-widest text-roe-gold mt-1">
            Console d’Administration
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 flex items-center gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
              Identifiant ou E-mail Administrateur
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-roe-textMuted">
                <User size={17} />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="haitibolet2026 ou haitibolet2026@gmail.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-roe-textMuted uppercase mb-1.5">
              Mot de Passe
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-roe-textMuted">
                <Lock size={17} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-roe-card border border-roe-border text-white text-sm focus:border-roe-gold focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-roe-gold via-roe-goldDark to-amber-600 text-roe-bg font-extrabold text-sm tracking-wide shadow-xl hover:shadow-roe-gold/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
          >
            <span>{loading ? 'Connexion en cours...' : 'Accéder au Dashboard'}</span>
            <ArrowRight size={17} />
          </button>
        </form>

        <p className="mt-8 text-center text-[11px] text-roe-textMuted">
          Accès strictement réservé aux administrateurs autorisés.
          <br />
          Toutes les connexions sont auditées et géoréférencées.
        </p>
      </div>
    </div>
  );
}
