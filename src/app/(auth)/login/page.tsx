'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const form = e.currentTarget;
    const emailInput = form.elements.namedItem('email') as HTMLInputElement | null;
    const passwordInput = form.elements.namedItem('password') as HTMLInputElement | null;
    const cleanEmail = (emailInput?.value || email || '').trim();
    const cleanPassword = passwordInput?.value || password || '';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setErrorMessage(
          data.error || 'Email atau password salah.'
        );
        setIsLoading(false);
        return;
      }

      router.push(data.redirectTo || '/balas');
      router.refresh();
    } catch {
      setErrorMessage('Tidak bisa terhubung ke server. Cek internet lalu coba lagi.');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-surface border border-line rounded-[20px] shadow-none p-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 bg-rail text-white rounded-2xl shadow-none">
          <Image
            src="/logo-mark.png"
            alt="Putra Glass Logo"
            width={40}
            height={40}
            className="w-10 h-10 object-contain"
            priority
          />
        </div>
        <h1 className="text-2xl font-extrabold text-ink tracking-tight">Putra Glass</h1>
        <p className="text-xs text-muted">
          Portal Internal CS Assistant &amp; Kalkulator Penawaran
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 bg-warn-bg border border-warn/30 text-warn text-xs rounded-xl flex items-center gap-2">
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-semibold text-muted mb-1.5">
            Email Pengguna
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-muted absolute left-3.5 top-3.5" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              defaultValue=""
              placeholder="admin@putraglass.id"
              className="w-full text-sm pl-10 pr-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink placeholder:text-muted/60 focus:bg-surface focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-muted mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-muted absolute left-3.5 top-3.5" />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              defaultValue=""
              placeholder="••••••••"
              className="w-full text-sm pl-10 pr-11 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink placeholder:text-muted/60 focus:bg-surface focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              className="absolute right-3 top-2.5 p-1 text-muted hover:text-ink transition cursor-pointer min-h-[28px] min-w-[28px] flex items-center justify-center rounded-lg"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-accent text-accent-ink font-bold py-2.5 rounded-xl shadow-none transition hover:opacity-95 disabled:opacity-50 cursor-pointer text-sm"
        >
          {isLoading ? 'Memverifikasi...' : 'Masuk ke Aplikasi'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
