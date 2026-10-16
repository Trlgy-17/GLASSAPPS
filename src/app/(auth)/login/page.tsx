'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('peran')
          .eq('id', user.id)
          .single();
        if (profile?.peran === 'owner') {
          router.push('/dasbor');
        } else {
          router.push('/balas');
        }
      } else {
        router.push('/balas');
      }
    }
  };

  return (
    <div className="max-w-md w-full bg-surface border border-line rounded-[20px] shadow-none p-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 bg-rail text-white rounded-xl shadow-none">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-ink tracking-tight">Putra Glass</h1>
        <p className="text-xs text-muted">
          Portal Internal CS Assistant &amp; Kalkulator Penawaran
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 bg-warn-bg border border-warn/30 text-warn text-xs rounded-xl">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-muted mb-1.5">
            Email Pengguna
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-muted absolute left-3.5 top-3.5" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@putraglass.id"
              className="w-full text-sm pl-10 pr-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink placeholder:text-muted/60 focus:bg-surface focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-muted absolute left-3.5 top-3.5" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-sm pl-10 pr-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink placeholder:text-muted/60 focus:bg-surface focus:outline-none focus:border-accent"
            />
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

      <div className="text-center pt-2 border-t border-line">
        <p className="text-xs text-muted">
          Hak akses: Admin CS (penawaran &amp; balas chat) • Owner (buku harga &amp; dasbor)
        </p>
      </div>
    </div>
  );
}
