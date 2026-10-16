'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  MessageSquare,
  Calculator,
  FileText,
  LayoutDashboard,
  Settings,
  LogOut,
  User,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [userRole, setUserRole] = useState<'owner' | 'admin' | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [aiUsageCount, setAiUsageCount] = useState<number>(18);
  const [maxAiQuota, setMaxAiQuota] = useState<number>(300);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);
        const { data: profile } = await supabase
          .from('users')
          .select('nama, peran')
          .eq('id', user.id)
          .single();
        setUserRole(profile?.peran || 'admin');
        setUserName(profile?.nama || user.email?.split('@')[0] || 'Admin');
      }
    }
    loadUser();
  }, [pathname]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (pathname === '/login') {
    return (
      <div className="min-h-screen bg-bg text-ink flex flex-col justify-between">
        <header className="p-6 flex justify-end">
          <ThemeToggle />
        </header>
        <main className="flex-1 flex items-center justify-center p-4">{children}</main>
        <footer className="p-4 text-center text-xs text-muted">
          Putra Glass &copy; 2026. Hak cipta dilindungi.
        </footer>
      </div>
    );
  }

  const navItems = [
    { label: 'Balas Chat', href: '/balas', icon: MessageSquare },
    { label: 'Kalkulator', href: '/penawaran/baru', icon: Calculator },
    { label: 'Penawaran', href: '/penawaran', icon: FileText },
    ...(userRole === 'owner'
      ? [{ label: 'Dasbor Owner', href: '/dasbor', icon: LayoutDashboard }]
      : []),
    ...(userRole === 'owner'
      ? [{ label: 'Pengaturan', href: '/pengaturan/buku-harga', icon: Settings }]
      : []),
  ];

  const quotaPercent = Math.min(100, Math.round((aiUsageCount / maxAiQuota) * 100));

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col md:flex-row antialiased">
      {/* 1. Desktop Left Sidebar (232px) */}
      <aside className="hidden md:flex w-[232px] shrink-0 bg-rail text-rail-ink flex-col justify-between p-4 border-r border-line/20 z-40 select-none">
        <div className="space-y-6">
          {/* Logo dalam kotak putih */}
          <div className="flex items-center gap-3 px-2 pt-2">
            <div className="w-9 h-9 bg-surface rounded-xl flex items-center justify-center shadow-sm shrink-0">
              <span className="font-extrabold text-accent text-sm tracking-tight">PG</span>
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white leading-none">
                Putra Glass
              </h1>
              <span className="text-[11px] text-rail-ink/70 leading-tight">CS Assistant</span>
            </div>
          </div>

          {/* Navigasi Utama */}
          <nav className="space-y-1.5 pt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/penawaran'
                  ? pathname === '/penawaran'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer focus-visible:outline-2 focus-visible:outline-accent ${
                    isActive
                      ? 'bg-surface/15 text-white font-semibold'
                      : 'text-rail-ink/80 hover:bg-surface/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>

                  {/* Titik LED bercahaya kecil untuk menu aktif */}
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-led shadow-[0_0_8px_var(--led)] shrink-0" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bagian Bawah: Meter Kuota AI + User Profile + Keluar */}
        <div className="space-y-4 pt-6 border-t border-surface/10">
          {/* Meter Kuota AI Hari Ini */}
          <div className="p-3 bg-surface/10 rounded-xl space-y-2 border border-surface/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-rail-ink/80 font-medium">Kuota AI hari ini</span>
              <span className="tabular-nums font-semibold text-white">
                {aiUsageCount} / {maxAiQuota}
              </span>
            </div>
            <div className="w-full h-1.5 bg-surface/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-led rounded-full transition-all duration-300 shadow-[0_0_6px_var(--led)]"
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          </div>

          {/* User Info & Keluar */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-surface/15 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {userName ? userName[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{userName || 'Admin'}</p>
                <p className="text-[11px] text-rail-ink/70 capitalize leading-none">
                  {userRole || 'admin'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Keluar dari aplikasi"
              className="w-9 h-9 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-surface/15 text-rail-ink/70 hover:text-white transition cursor-pointer"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* Top Header Bar */}
        <header className="h-16 px-6 bg-surface border-b border-line flex items-center justify-between shrink-0 sticky top-0 z-30">
          {/* Mobile Brand */}
          <div className="flex items-center gap-2.5 md:hidden">
            <div className="w-8 h-8 bg-rail text-white rounded-lg flex items-center justify-center font-bold text-xs">
              PG
            </div>
            <span className="font-bold text-sm text-ink">Putra Glass</span>
          </div>

          <div className="hidden md:block">
            {/* Breadcrumb / Title spacer */}
          </div>

          {/* Right Header: Theme Toggle */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* 3. Mobile Bottom Tab Bar (<768px) dengan 4 Ikon */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-rail text-rail-ink border-t border-line/20 flex items-center justify-around z-50 px-2">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/penawaran'
              ? pathname === '/penawaran'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-2 py-1 relative text-xs ${
                isActive ? 'text-white font-semibold' : 'text-rail-ink/70'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[10px]">{item.label.split(' ')[0]}</span>
              {isActive && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-led shadow-[0_0_6px_var(--led)]" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
