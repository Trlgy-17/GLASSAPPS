'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Settings, LogOut, User } from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<'owner' | 'admin' | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);
        const { data: profile } = await supabase
          .from('users')
          .select('peran')
          .eq('id', user.id)
          .single();
        setUserRole(profile?.peran || 'admin');
      }
    }
    loadUser();
  }, [pathname]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (pathname === '/login') return null;

  return (
    <header className="bg-[#253254] text-white border-b border-[#275087] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/penawaran" className="flex items-center gap-2 font-bold text-base tracking-wide text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-[#BFCBD9]" />
            PUTRA GLASS
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
            {userRole === 'owner' ? (
              <>
                <Link
                  href="/dasbor"
                  className={`px-3 py-1.5 rounded transition ${
                    pathname === '/dasbor'
                      ? 'bg-[#275087] text-white'
                      : 'text-[#BFCBD9] hover:text-white'
                  }`}
                >
                  Dasbor
                </Link>
                <Link
                  href="/penawaran"
                  className={`px-3 py-1.5 rounded transition ${
                    pathname === '/penawaran'
                      ? 'bg-[#275087] text-white'
                      : 'text-[#BFCBD9] hover:text-white'
                  }`}
                >
                  Penawaran (Baca Saja)
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/balas"
                  className={`px-3 py-1.5 rounded transition ${
                    pathname.startsWith('/balas')
                      ? 'bg-[#275087] text-white'
                      : 'text-[#BFCBD9] hover:text-white'
                  }`}
                >
                  Balas Chat
                </Link>
                <Link
                  href="/penawaran/baru"
                  className={`px-3 py-1.5 rounded transition ${
                    pathname.startsWith('/penawaran/baru')
                      ? 'bg-[#275087] text-white'
                      : 'text-[#BFCBD9] hover:text-white'
                  }`}
                >
                  Kalkulator
                </Link>
                <Link
                  href="/penawaran"
                  className={`px-3 py-1.5 rounded transition ${
                    pathname === '/penawaran'
                      ? 'bg-[#275087] text-white'
                      : 'text-[#BFCBD9] hover:text-white'
                  }`}
                >
                  Penawaran
                </Link>
                <Link
                  href="/pengaturan/buku-harga"
                  className={`px-3 py-1.5 rounded transition flex items-center gap-1.5 ${
                    pathname.startsWith('/pengaturan')
                      ? 'bg-[#275087] text-white'
                      : 'text-[#BFCBD9] hover:text-white'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Pengaturan
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {userEmail && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-[#BFCBD9]">
              <User className="w-3.5 h-3.5" />
              <span>{userEmail}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                userRole === 'owner' ? 'bg-[#E3A857] text-[#1B2233]' : 'bg-[#275087] text-white'
              }`}>
                {userRole?.toUpperCase()}
              </span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-[#BFCBD9] hover:text-white bg-[#1B2233] px-2.5 py-1.5 rounded transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
