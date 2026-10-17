'use client';

import React, { useState, useEffect, useRef, useId, useMemo } from 'react';
import {
  MapPin,
  History,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Check,
  Plus,
} from 'lucide-react';
import type { WilayahKota, ProvinsiGroup } from '@/lib/wilayah/kota';

interface CityComboboxProps {
  value: string; // nama kota atau kode
  kodeWilayah?: string;
  onChange: (city: { nama: string; kode?: string; isCustom?: boolean }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const RECENT_CITIES_KEY = 'pg_recent_cities_v1';
const PROV_FREQ_KEY = 'pg_prov_freq_v1';
const CONTAINER_MAX_HEIGHT = 360; // maks ±360px

type DropdownSelectableItem =
  | { type: 'recent_city'; city: WilayahKota }
  | { type: 'provinsi_row'; group: ProvinsiGroup }
  | { type: 'back_button' }
  | { type: 'city_in_prov'; city: WilayahKota }
  | { type: 'search_provinsi'; group: ProvinsiGroup }
  | { type: 'search_city'; city: WilayahKota }
  | { type: 'custom_option'; customText: string };

export function CityCombobox({
  value,
  kodeWilayah,
  onChange,
  placeholder = 'Pilih atau ketik kota tujuan',
  className = '',
  disabled = false,
}: CityComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [selectedProvinsi, setSelectedProvinsi] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<WilayahKota[]>([]);
  const [provinsiSuggestions, setProvinsiSuggestions] = useState<ProvinsiGroup[]>([]);
  const [recentCities, setRecentCities] = useState<WilayahKota[]>([]);
  const [provFreq, setProvFreq] = useState<Record<string, number>>({});
  const [groupedProvinsi, setGroupedProvinsi] = useState<ProvinsiGroup[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const comboboxId = useId();

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const ensureDataLoaded = async () => {
    if (isDataLoaded) return;
    try {
      let loadedFreq: Record<string, number> = {};
      try {
        const storedFreq = localStorage.getItem(PROV_FREQ_KEY);
        if (storedFreq) {
          loadedFreq = JSON.parse(storedFreq) || {};
          setProvFreq(loadedFreq);
        }
      } catch {}

      try {
        const storedRecent = localStorage.getItem(RECENT_CITIES_KEY);
        if (storedRecent) {
          const parsed = JSON.parse(storedRecent) as WilayahKota[];
          if (Array.isArray(parsed)) {
            setRecentCities(parsed.slice(0, 5));
          }
        }
      } catch {}

      const { getAllCitiesGroupedByProvinsi } = await import('@/lib/wilayah/kota');
      setGroupedProvinsi(getAllCitiesGroupedByProvinsi(loadedFreq));
      setIsDataLoaded(true);
    } catch (err) {
      console.error('Gagal memuat data kota:', err);
    }
  };

  const saveRecentAndFreq = async (city: WilayahKota) => {
    try {
      const storedRecent = localStorage.getItem(RECENT_CITIES_KEY);
      const prev: WilayahKota[] = storedRecent ? JSON.parse(storedRecent) : [];
      const filtered = prev.filter((c) => c.kode !== city.kode);
      const updated = [city, ...filtered].slice(0, 5);
      localStorage.setItem(RECENT_CITIES_KEY, JSON.stringify(updated));
      setRecentCities(updated);

      const newFreq = { ...provFreq, [city.provinsi]: (provFreq[city.provinsi] || 0) + 1 };
      localStorage.setItem(PROV_FREQ_KEY, JSON.stringify(newFreq));
      setProvFreq(newFreq);

      const { getAllCitiesGroupedByProvinsi } = await import('@/lib/wilayah/kota');
      setGroupedProvinsi(getAllCitiesGroupedByProvinsi(newFreq));
    } catch {}
  };

  // Filter saran saat query berubah
  useEffect(() => {
    if (!isOpen || !isDataLoaded) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setProvinsiSuggestions([]);
      setHighlightedIndex(0);
      return;
    }
    // Debounce pencarian kota 150 ms untuk responsivitas input
    const debounceTimer = setTimeout(() => {
      import('@/lib/wilayah/kota').then(({ searchKota, searchProvinsi }) => {
        const foundProv = searchProvinsi(trimmed, provFreq);
        const foundKota = searchKota(trimmed, 20);
        setProvinsiSuggestions(foundProv);
        setSuggestions(foundKota);
        setHighlightedIndex(0);
      });
    }, 150);

    return () => clearTimeout(debounceTimer);
  }, [query, isOpen, isDataLoaded, provFreq]);

  // Reset scroll ke atas saat pindah tingkat provinsi
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [selectedProvinsi, isOpen]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectedProvinsi(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCity = (city: WilayahKota) => {
    setQuery(city.nama);
    onChange({ nama: city.nama, kode: city.kode, isCustom: false });
    saveRecentAndFreq(city);
    setIsOpen(false);
    setSelectedProvinsi(null);
    setHighlightedIndex(-1);
  };

  const handleSelectCustom = (customText: string) => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    onChange({ nama: trimmed, isCustom: true });
    setIsOpen(false);
    setSelectedProvinsi(null);
    setHighlightedIndex(-1);
  };

  const handleEnterProvinsi = (provinsiName: string) => {
    setSelectedProvinsi(provinsiName);
    setQuery('');
    setHighlightedIndex(0);
  };

  const handleBackToProvinsiList = () => {
    setSelectedProvinsi(null);
    setHighlightedIndex(0);
  };

  const activeProvGroup = useMemo(() => {
    if (!selectedProvinsi) return null;
    return groupedProvinsi.find((g) => g.provinsi === selectedProvinsi) || null;
  }, [selectedProvinsi, groupedProvinsi]);

  // Susun daftar item yang bisa dipilih keyboard sesuai mode saat ini
  const selectableItems: DropdownSelectableItem[] = useMemo(() => {
    const trimmed = query.trim();
    const list: DropdownSelectableItem[] = [];

    if (trimmed) {
      // Mode 3: Pencarian Langsung
      for (const p of provinsiSuggestions) {
        list.push({ type: 'search_provinsi', group: p });
      }
      for (const c of suggestions) {
        list.push({ type: 'search_city', city: c });
      }
      if (provinsiSuggestions.length === 0 && suggestions.length === 0) {
        list.push({ type: 'custom_option', customText: trimmed });
      }
      return list;
    }

    if (selectedProvinsi && activeProvGroup) {
      // Mode 2: Di dalam Provinsi terpilih
      list.push({ type: 'back_button' });
      for (const k of activeProvGroup.kotaList) {
        list.push({ type: 'city_in_prov', city: k });
      }
      for (const kb of activeProvGroup.kabupatenList) {
        list.push({ type: 'city_in_prov', city: kb });
      }
      return list;
    }

    // Mode 1: Daftar 5 Recent + 38 Provinsi
    for (const r of recentCities) {
      list.push({ type: 'recent_city', city: r });
    }
    for (const g of groupedProvinsi) {
      list.push({ type: 'provinsi_row', group: g });
    }
    return list;
  }, [query, selectedProvinsi, activeProvGroup, recentCities, groupedProvinsi, provinsiSuggestions, suggestions]);

  // Keyboard navigation ARIA combobox
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        ensureDataLoaded();
        setSelectedProvinsi(null);
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    const total = selectableItems.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (total === 0) return;
      const next = (highlightedIndex + 1) % total;
      setHighlightedIndex(next);
      scrollToOption(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (total === 0) return;
      const prev = (highlightedIndex - 1 + total) % total;
      setHighlightedIndex(prev);
      scrollToOption(prev);
    } else if (e.key === 'ArrowRight') {
      // Masuk provinsi jika yang disorot adalah baris provinsi
      const current = selectableItems[highlightedIndex];
      if (current && (current.type === 'provinsi_row' || current.type === 'search_provinsi')) {
        e.preventDefault();
        handleEnterProvinsi(current.group.provinsi);
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
      // Kembali ke daftar semua provinsi jika field kosong & sedang di dalam provinsi
      if (!query.trim() && selectedProvinsi) {
        e.preventDefault();
        handleBackToProvinsiList();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = selectableItems[highlightedIndex];
      if (current) {
        if (current.type === 'provinsi_row' || current.type === 'search_provinsi') {
          handleEnterProvinsi(current.group.provinsi);
        } else if (current.type === 'back_button') {
          handleBackToProvinsiList();
        } else if (
          current.type === 'recent_city' ||
          current.type === 'city_in_prov' ||
          current.type === 'search_city'
        ) {
          handleSelectCity(current.city);
        } else if (current.type === 'custom_option') {
          handleSelectCustom(current.customText);
        }
      } else if (query.trim()) {
        handleSelectCustom(query);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSelectedProvinsi(null);
    }
  };

  const scrollToOption = (index: number) => {
    if (!scrollContainerRef.current) return;
    const el = scrollContainerRef.current.querySelector(`[data-opt-idx="${index}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  };

  let runningIdx = 0;

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
            ensureDataLoaded();
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full text-xs sm:text-sm pl-9 pr-9 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent font-semibold transition"
        />
        <button
          type="button"
          tabIndex={-1}
          id="btn-toggle-city-dropdown"
          aria-label="Buka daftar kota"
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          onClick={() => {
            if (disabled) return;
            ensureDataLoaded();
            if (!isOpen) {
              setSelectedProvinsi(null);
              setIsOpen(true);
            } else {
              setIsOpen(false);
              setSelectedProvinsi(null);
            }
          }}
          className="absolute right-2 p-1 text-muted hover:text-ink transition cursor-pointer"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown Listbox (Maks ±360px) */}
      {isOpen && (
        <div
          id={`city-listbox-${comboboxId}`}
          role="listbox"
          ref={scrollContainerRef}
          style={{ maxHeight: `${CONTAINER_MAX_HEIGHT}px` }}
          className="absolute z-50 left-0 right-0 mt-1 overflow-y-auto rounded-xl border border-line bg-surface shadow-xl text-xs sm:text-sm animate-in fade-in zoom-in-95 duration-100 divide-y divide-line/40"
        >
          {/* =================================================================
              MODE 3: MENGETIK (PENCARIAN LANGSUNG SEMUA DAERAH & PROVINSI)
             ================================================================= */}
          {query.trim() ? (
            <div className="py-1">
              {/* Baris Provinsi yang cocok (misal ketik "jawa timur") */}
              {provinsiSuggestions.length > 0 && (
                <div className="mb-1">
                  <div className="px-3 py-1.5 bg-raised/80 text-[11px] font-bold text-muted uppercase tracking-wider">
                    Provinsi
                  </div>
                  {provinsiSuggestions.map((grp) => {
                    const idx = runningIdx++;
                    const isHighlighted = highlightedIndex === idx;
                    return (
                      <div
                        key={`search-prov-${grp.provinsi}`}
                        role="option"
                        aria-selected={isHighlighted}
                        data-opt-idx={idx}
                        data-testid="provinsi-option"
                        onClick={() => handleEnterProvinsi(grp.provinsi)}
                        className={`px-3 py-2.5 min-h-[42px] flex items-center justify-between cursor-pointer transition ${
                          isHighlighted ? 'bg-raised text-accent font-bold' : 'text-ink hover:bg-raised/60'
                        }`}
                      >
                        <span className="font-semibold">{grp.provinsi}</span>
                        <div className="flex items-center gap-1.5 text-muted text-xs">
                          <span>{grp.cities.length} daerah</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Daftar Daerah Hasil Pencarian (maks 20, format "Kota Surabaya — Jawa Timur") */}
              {suggestions.length > 0 && (
                <div>
                  {provinsiSuggestions.length > 0 && (
                    <div className="px-3 py-1.5 bg-raised/80 text-[11px] font-bold text-muted uppercase tracking-wider">
                      Kota &amp; Kabupaten
                    </div>
                  )}
                  {suggestions.map((city) => {
                    const idx = runningIdx++;
                    const isHighlighted = highlightedIndex === idx;
                    const isSelected = kodeWilayah === city.kode;
                    return (
                      <div
                        key={`search-city-${city.kode}`}
                        role="option"
                        aria-selected={isHighlighted}
                        data-opt-idx={idx}
                        data-city-code={city.kode}
                        onClick={() => handleSelectCity(city)}
                        className={`px-3 py-2.5 min-h-[42px] flex items-center justify-between cursor-pointer transition ${
                          isHighlighted ? 'bg-raised text-accent font-semibold' : 'text-ink hover:bg-raised/60'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="font-semibold">{city.nama}</span>
                          <span className="text-muted font-normal"> — {city.provinsi}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Opsi Manual jika tidak ada yang cocok */}
              {provinsiSuggestions.length === 0 && suggestions.length === 0 && (
                <div
                  role="option"
                  id="option-custom-city"
                  aria-selected={highlightedIndex === 0}
                  data-opt-idx={runningIdx++}
                  onClick={() => handleSelectCustom(query)}
                  className="px-3 py-3 min-h-[44px] flex items-center gap-2 cursor-pointer bg-accent/10 text-accent font-bold hover:bg-accent/15 transition"
                >
                  <Plus className="w-4 h-4 text-accent shrink-0" />
                  <div className="truncate">
                    <span>+ Pakai &apos;<strong className="text-accent">{query.trim()}</strong>&apos; sebagai kota tujuan</span>
                  </div>
                </div>
              )}
            </div>
          ) : selectedProvinsi && activeProvGroup ? (
            /* =================================================================
               MODE 2: DI DALAM SATU PROVINSI (← Semua provinsi, Kota, Kabupaten)
               ================================================================= */
            <div>
              {/* Baris Atas: ← Semua provinsi (min-h 44px agar mudah ditekan di ponsel) */}
              {(() => {
                const idx = runningIdx++;
                const isHighlighted = highlightedIndex === idx;
                return (
                  <button
                    type="button"
                    id="btn-kembali-semua-provinsi"
                    data-opt-idx={idx}
                    onClick={handleBackToProvinsiList}
                    className={`w-full px-3 py-2.5 min-h-[44px] flex items-center justify-between text-left border-b border-line cursor-pointer transition sticky top-0 z-10 ${
                      isHighlighted
                        ? 'bg-raised text-accent font-bold'
                        : 'bg-surface hover:bg-raised text-accent font-bold'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ArrowLeft className="w-4 h-4 shrink-0" />
                      <span>Semua provinsi</span>
                    </div>
                    <span className="text-xs font-semibold text-ink bg-raised px-2 py-0.5 rounded-md border border-line">
                      {activeProvGroup.provinsi}
                    </span>
                  </button>
                );
              })()}

              {/* Kelompok KOTA (urut abjad, tanpa label provinsi berulang) */}
              {activeProvGroup.kotaList.length > 0 && (
                <div>
                  <div
                    data-testid="group-header-kota"
                    className="px-3 py-1.5 bg-raised/90 text-[11px] font-bold text-ink uppercase tracking-wider border-b border-line/50"
                  >
                    Kota
                  </div>
                  {activeProvGroup.kotaList.map((city) => {
                    const idx = runningIdx++;
                    const isHighlighted = highlightedIndex === idx;
                    const isSelected = kodeWilayah === city.kode;
                    return (
                      <div
                        key={city.kode}
                        role="option"
                        aria-selected={isHighlighted}
                        data-opt-idx={idx}
                        data-city-code={city.kode}
                        onClick={() => handleSelectCity(city)}
                        className={`px-3 py-2.5 min-h-[42px] flex items-center justify-between cursor-pointer transition ${
                          isHighlighted ? 'bg-raised text-accent font-semibold' : 'text-ink hover:bg-raised/60'
                        }`}
                      >
                        <span className="font-semibold truncate">{city.nama}</span>
                        {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Kelompok KABUPATEN (urut abjad, tanpa label provinsi berulang) */}
              {activeProvGroup.kabupatenList.length > 0 && (
                <div>
                  <div
                    data-testid="group-header-kabupaten"
                    className="px-3 py-1.5 bg-raised/90 text-[11px] font-bold text-ink uppercase tracking-wider border-y border-line/50"
                  >
                    Kabupaten
                  </div>
                  {activeProvGroup.kabupatenList.map((city) => {
                    const idx = runningIdx++;
                    const isHighlighted = highlightedIndex === idx;
                    const isSelected = kodeWilayah === city.kode;
                    return (
                      <div
                        key={city.kode}
                        role="option"
                        aria-selected={isHighlighted}
                        data-opt-idx={idx}
                        data-city-code={city.kode}
                        onClick={() => handleSelectCity(city)}
                        className={`px-3 py-2.5 min-h-[42px] flex items-center justify-between cursor-pointer transition ${
                          isHighlighted ? 'bg-raised text-accent font-semibold' : 'text-ink hover:bg-raised/60'
                        }`}
                      >
                        <span className="font-semibold truncate">{city.nama}</span>
                        {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* =================================================================
               MODE 1: TINGKAT PROVINSI (Terakhir dipakai + 38 Provinsi)
               ================================================================= */
            <div>
              {/* Bagian 1: Terakhir dipakai (maks 5 kota) */}
              {recentCities.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 bg-raised/80 flex items-center gap-1.5 text-[11px] font-bold text-accent uppercase tracking-wider border-b border-line/40">
                    <History className="w-3.5 h-3.5" />
                    <span>Terakhir dipakai</span>
                  </div>
                  {recentCities.map((city) => {
                    const idx = runningIdx++;
                    const isHighlighted = highlightedIndex === idx;
                    const isSelected = kodeWilayah === city.kode;
                    return (
                      <div
                        key={`recent-${city.kode}`}
                        role="option"
                        aria-selected={isHighlighted}
                        data-opt-idx={idx}
                        onClick={() => handleSelectCity(city)}
                        className={`px-3 py-2.5 min-h-[42px] flex items-center justify-between cursor-pointer transition ${
                          isHighlighted ? 'bg-raised text-accent font-semibold' : 'text-ink hover:bg-raised/60'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="font-semibold">{city.nama}</span>
                          <span className="text-muted text-xs"> — {city.provinsi}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bagian 2: Daftar 38 Provinsi (Jawa Barat paling atas) */}
              <div>
                <div className="px-3 py-1.5 bg-raised/90 text-[11px] font-bold text-ink uppercase tracking-wider border-b border-line/50">
                  Pilih Provinsi (38)
                </div>
                {groupedProvinsi.map((grp) => {
                  const idx = runningIdx++;
                  const isHighlighted = highlightedIndex === idx;
                  return (
                    <div
                      key={grp.provinsi}
                      role="option"
                      aria-selected={isHighlighted}
                      data-opt-idx={idx}
                      data-testid="provinsi-row"
                      data-provinsi={grp.provinsi}
                      onClick={() => handleEnterProvinsi(grp.provinsi)}
                      className={`px-3 py-2.5 min-h-[42px] flex items-center justify-between cursor-pointer border-b border-line/20 transition ${
                        isHighlighted ? 'bg-raised text-accent font-semibold' : 'text-ink hover:bg-raised/60'
                      }`}
                    >
                      <span className="font-semibold truncate">{grp.provinsi}</span>
                      <div className="flex items-center gap-1.5 text-muted text-xs shrink-0">
                        <span>{grp.cities.length} daerah</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
