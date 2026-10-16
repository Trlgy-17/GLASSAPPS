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
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('users').select('peran').eq('id', user.id).single();
        if (profile?.peran === 'owner') {
          router.push('/dasbor');
        } else {
          router.push('/penawaran/baru');
        }
      } else {
        router.push('/penawaran/baru');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2] px-4">
      <div className="max-w-md w-full bg-white border border-[#BFCBD9] rounded-xl shadow-sm p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-[#273154] text-white rounded-lg shadow-sm">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-[#273154] tracking-tight">
            PUTRA GLASS
          </h1>
          <p className="text-xs text-[#555]">
            Portal Internal CS Assistant & Kalkulator Penawaran
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#555] mb-1">
              Email Pengguna
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#888] absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@putraglass.id"
                className="w-full text-sm pl-9 pr-3 py-2 border border-[#BFCBD9] rounded bg-[#F7F5F2] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#273154]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#555] mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#888] absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm pl-9 pr-3 py-2 border border-[#BFCBD9] rounded bg-[#F7F5F2] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#273154]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-[#273154] hover:bg-[#1f2845] text-white font-medium py-2.5 rounded shadow-sm transition disabled:opacity-50 cursor-pointer text-sm"
          >
            {isLoading ? 'Memverifikasi...' : 'Masuk ke Aplikasi'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-[#F7F5F2]">
          <p className="text-[11px] text-[#777]">
            Hak akses: Admin CS (penawaran & balas) • Owner (buku harga & persetujuan)
          </p>
        </div>
      </div>
    </div>
  );
}
