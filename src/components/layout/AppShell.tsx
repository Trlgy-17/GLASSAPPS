'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  MessageSquare,
  Calculator,
  FileText,
  LayoutDashboard,
  LogOut,
  Calendar,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { getPeriode } from '@/lib/closing-period';
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [userRole, setUserRole] = useState<'owner' | 'admin' | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);


  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const json = await res.json();
          if (json.user) {
            setUserEmail(json.user.email);
            setUserRole(json.user.peran);
            setUserName(json.user.nama);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat profil user:', err);
      }
    }
    loadUser();
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.push('/login');
    router.refresh();
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

  // Menu navigasi berdasarkan peran:
  // Owner HANYA melihat 2 menu: "Dasbor" (/dasbor) dan "Daftar penawaran" (/penawaran, baca saja)
  const navItems =
    userRole === 'owner'
      ? [
          { label: 'Dasbor', href: '/dasbor', icon: LayoutDashboard },
          { label: 'Daftar Penawaran', href: '/penawaran', icon: FileText },
        ]
      : [
          { label: 'Balas Chat', href: '/balas', icon: MessageSquare },
          { label: 'Kalkulator', href: '/penawaran/baru', icon: Calculator },
          { label: 'Penawaran', href: '/penawaran', icon: FileText },
        ];


  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col md:flex-row antialiased">
      {/* 1. Desktop Left Sidebar (232px) */}
      <aside className="hidden md:flex w-[232px] h-screen sticky top-0 shrink-0 bg-rail text-rail-ink flex-col justify-between p-4 border-r border-line/20 z-40 select-none overflow-hidden">
        {/* Bagian atas bisa di-scroll jika layar pendek (±900px) */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-6 pr-1">
          {/* Logo asli Putra Glass dalam kotak putih 40x40 */}
          <div className="flex items-center gap-3 px-2 pt-2">
            <div className="w-10 h-10 min-w-[40px] min-h-[40px] bg-white rounded-xl flex items-center justify-center p-1.5 shadow-sm shrink-0">
              <Image
                src="/logo-mark.png"
                alt="Putra Glass Logo"
                width={40}
                height={40}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white leading-none">
                Putra Glass
              </h1>
              <span className="text-[11px] text-rail-ink/70 leading-tight">
                {userRole === 'owner' ? 'Pemantauan Owner' : 'CS Assistant'}
              </span>
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

                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-led shadow-[0_0_8px_var(--led)] shrink-0" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bagian Bawah: Widget Periode Closing Bulanan */}
        <div className="shrink-0 space-y-4 pt-4 border-t border-surface/10">
          <div className="p-3 bg-surface/10 rounded-xl space-y-1.5 border border-surface/10">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Calendar className="w-3.5 h-3.5 text-led shrink-0" />
              <span className="truncate">{getPeriode().labelSidebar}</span>
            </div>
            {userRole === 'owner' && (
              <p className="text-[10px] text-rail-ink/60 leading-tight">
                Owner — hanya bisa melihat
              </p>
            )}
          </div>
          {/* User Info & Keluar */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-surface/15 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {userName ? userName[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{userName || 'Pengguna'}</p>
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
          <div className="flex items-center gap-3 md:hidden">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center p-1 shadow-xs border border-line">
              <Image
                src="/logo-mark.png"
                alt="Putra Glass Logo"
                width={36}
                height={36}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <span className="font-bold text-sm text-ink">Putra Glass</span>
          </div>

          <div className="hidden md:block">
            {/* Spacer */}
          </div>

          {/* Right Header: Theme Toggle & Mobile Logout */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Keluar dari aplikasi"
              title="Keluar"
              className="md:hidden w-9 h-9 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-raised text-muted hover:text-ink transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <ThemeToggle />
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* 3. Mobile Bottom Tab Bar (<768px): Owner hanya 2 tab, Admin 3 tab */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-rail text-rail-ink border-t border-line/20 flex items-center justify-around z-50 px-2">
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
