'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import { MapPin, Search, History, ChevronDown, Check, AlertCircle } from 'lucide-react';
import type { WilayahKota } from '@/lib/wilayah/kota';

interface CityComboboxProps {
  value: string; // nama kota atau kode
  kodeWilayah?: string;
  onChange: (city: { nama: string; kode?: string; isCustom?: boolean }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const RECENT_CITIES_KEY = 'pg_recent_cities_v1';

export function CityCombobox({
  value,
  kodeWilayah,
  onChange,
  placeholder = 'Ketik atau pilih kabupaten/kota...',
  className = '',
  disabled = false,
}: CityComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<WilayahKota[]>([]);
  const [recentCities, setRecentCities] = useState<WilayahKota[]>([]);
  const [allCities, setAllCities] = useState<WilayahKota[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const comboboxId = useId();

  // Sinkronkan value prop ke query input jika berubah dari luar
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Muat data kota hanya saat komponen disentuh / fokus (dynamic import)
  const ensureDataLoaded = async () => {
    if (isDataLoaded) return;
    try {
      const { KOTA_INDONESIA } = await import('@/lib/wilayah/kota');
      setAllCities(KOTA_INDONESIA);
      setIsDataLoaded(true);

      // Muat 5 recent cities dari localStorage
      try {
        const stored = localStorage.getItem(RECENT_CITIES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as WilayahKota[];
          if (Array.isArray(parsed)) {
            setRecentCities(parsed.slice(0, 5));
          }
        }
      } catch {}
    } catch (err) {
      console.error('Gagal memuat data kota:', err);
    }
  };

  const saveRecentCity = (city: WilayahKota) => {
    try {
      const stored = localStorage.getItem(RECENT_CITIES_KEY);
      const prev: WilayahKota[] = stored ? JSON.parse(stored) : [];
      const filtered = prev.filter((c) => c.kode !== city.kode);
      const updated = [city, ...filtered].slice(0, 5);
      localStorage.setItem(RECENT_CITIES_KEY, JSON.stringify(updated));
      setRecentCities(updated);
    } catch {}
  };

  // Filter saran saat query berubah
  useEffect(() => {
    if (!isOpen || !isDataLoaded) return;

    if (!query.trim()) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    import('@/lib/wilayah/kota').then(({ searchKota }) => {
      const found = searchKota(query, 12);
      setSuggestions(found);
      setHighlightedIndex(found.length > 0 ? 0 : -1);
    });
  }, [query, isOpen, isDataLoaded]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCity = (city: WilayahKota) => {
    setQuery(city.nama);
    onChange({ nama: city.nama, kode: city.kode, isCustom: false });
    saveRecentCity(city);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleSelectCustom = (customText: string) => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    onChange({ nama: trimmed, isCustom: true });
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  // Keyboard navigation ARIA combobox
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        ensureDataLoaded();
        setIsOpen(true);
      }
      return;
    }

    const totalItems = query.trim()
      ? suggestions.length + 1 // + 1 untuk opsi custom
      : recentCities.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim()) {
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelectCity(suggestions[highlightedIndex]);
        } else {
          // Opsi custom
          handleSelectCustom(query);
        }
      } else if (highlightedIndex >= 0 && highlightedIndex < recentCities.length) {
        handleSelectCity(recentCities[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        <MapPin className="absolute left-3 w-4 h-4 text-muted pointer-events-none" />
        <input
          ref={inputRef}
          id={`city-combobox-${comboboxId}`}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={`city-listbox-${comboboxId}`}
          aria-autocomplete="list"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            ensureDataLoaded();
            setIsOpen(true);
          }}
          onClick={() => {
            ensureDataLoaded();
            setIsOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full text-xs sm:text-sm pl-9 pr-8 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent font-semibold transition"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (disabled) return;
            ensureDataLoaded();
            setIsOpen(!isOpen);
            inputRef.current?.focus();
          }}
          className="absolute right-2.5 p-1 text-muted hover:text-ink transition cursor-pointer"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown Suggestions Listbox */}
      {isOpen && (
        <div
          id={`city-listbox-${comboboxId}`}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 max-h-64 sm:max-h-72 overflow-y-auto rounded-xl border border-line bg-surface shadow-xl text-xs sm:text-sm divide-y divide-line/40 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Recent Cities Header if query is empty */}
          {!query.trim() && recentCities.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-muted uppercase tracking-wider">
                <History className="w-3.5 h-3.5 text-accent" />
                <span>Terakhir Digunakan</span>
              </div>
              <ul className="space-y-0.5 mt-1">
                {recentCities.map((city, idx) => (
                  <li
                    key={city.kode}
                    role="option"
                    aria-selected={highlightedIndex === idx}
                    onClick={() => handleSelectCity(city)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition ${
                      highlightedIndex === idx ? 'bg-raised text-accent font-semibold' : 'text-ink hover:bg-raised/60'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{city.nama}</div>
                      <div className="text-[11px] text-muted">{city.provinsi}</div>
                    </div>
                    {kodeWilayah === city.kode && <Check className="w-4 h-4 text-accent" />}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick instructions if query is empty and no recent */}
          {!query.trim() && recentCities.length === 0 && (
            <div className="p-4 text-center text-xs text-muted">
              Ketik nama kota, kabupaten, atau provinsi untuk mencari...
            </div>
          )}

          {/* Matching suggestions */}
          {query.trim() && (
            <div className="p-1.5">
              {suggestions.length > 0 ? (
                <ul className="space-y-0.5">
                  {suggestions.map((city, idx) => (
                    <li
                      key={city.kode}
                      role="option"
                      aria-selected={highlightedIndex === idx}
                      onClick={() => handleSelectCity(city)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition ${
                        highlightedIndex === idx ? 'bg-raised text-accent font-semibold' : 'text-ink hover:bg-raised/60'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{city.nama}</div>
                        <div className="text-[11px] text-muted">{city.provinsi}</div>
                      </div>
                      {kodeWilayah === city.kode && <Check className="w-4 h-4 text-accent" />}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-2.5 text-xs text-muted text-center">
                  Tidak ditemukan kabupaten/kota resmi yang cocok.
                </div>
              )}

              {/* Opsi Pakai '<teks>' (Custom) */}
              <div
                role="option"
                aria-selected={highlightedIndex === suggestions.length}
                onClick={() => handleSelectCustom(query)}
                className={`mt-1.5 p-2.5 border-t border-line/60 rounded-lg cursor-pointer flex items-start gap-2 transition ${
                  highlightedIndex === suggestions.length ? 'bg-amber-500/10 border-amber-500/40' : 'hover:bg-raised'
                }`}
              >
                <AlertCircle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-ink">
                    Pakai &ldquo;<span className="text-accent">{query.trim()}</span>&rdquo;
                  </div>
                  <div className="text-[11px] text-warn font-medium">
                    Kota tidak dikenal di master Kemendagri, ongkir wajib diisi manual.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
