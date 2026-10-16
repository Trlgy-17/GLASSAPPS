'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const hasDark = document.documentElement.classList.contains('dark');
      setIsDark(hasDark);
    } catch {}
  }, []);

  const toggleTheme = () => {
    try {
      const nextDark = !isDark;
      setIsDark(nextDark);
      if (nextDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    } catch (e) {
      console.warn('Gagal menyimpan tema:', e);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Ganti ke mode gelap/terang"
      className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-surface border border-line text-ink hover:bg-raised transition cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
    >
      {mounted && isDark ? (
        <Sun className="w-5 h-5 text-warn" />
      ) : (
        <Moon className="w-5 h-5 text-accent" />
      )}
    </button>
  );
}
