'use client';

import React, { useState, useEffect, useRef, useId, useMemo } from 'react';
import { MapPin, History, ChevronDown, Check, Plus } from 'lucide-react';
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
const ITEM_HEIGHT = 48; // px per item
const HEADER_HEIGHT = 32; // px per header provinsi
const CONTAINER_HEIGHT = 320; // px

type FlatDropdownItem =
  | { type: 'recent_header'; title: string }
  | { type: 'recent_city'; city: WilayahKota }
  | { type: 'provinsi_header'; title: string; count: number }
  | { type: 'city'; city: WilayahKota }
  | { type: 'custom_option'; customText: string };

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
  const [groupedProvinsi, setGroupedProvinsi] = useState<ProvinsiGroup[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  // Virtual scrolling state
  const [scrollTop, setScrollTop] = useState(0);

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
      const { getAllCitiesGroupedByProvinsi } = await import('@/lib/wilayah/kota');
      setGroupedProvinsi(getAllCitiesGroupedByProvinsi());
      setIsDataLoaded(true);

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

    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    import('@/lib/wilayah/kota').then(({ searchKota }) => {
      const found = searchKota(trimmed, 25);
      setSuggestions(found);
      setHighlightedIndex(found.length > 0 ? 0 : 0); // 0 bisa city atau custom
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

  // Susun flat list untuk virtual scroll & keyboard nav
  const flatItems: FlatDropdownItem[] = useMemo(() => {
    const items: FlatDropdownItem[] = [];
    const trimmed = query.trim();

    if (!trimmed) {
      // 1. Dropdown terbuka tanpa ketik: 5 recent + SEMUA 514 kota per provinsi
      if (recentCities.length > 0) {
        items.push({ type: 'recent_header', title: 'Terakhir Digunakan' });
        for (const c of recentCities) {
          items.push({ type: 'recent_city', city: c });
        }
      }

      for (const grp of groupedProvinsi) {
        items.push({ type: 'provinsi_header', title: grp.provinsi, count: grp.cities.length });
        for (const c of grp.cities) {
          items.push({ type: 'city', city: c });
        }
      }
    } else {
      // 2. Mengetik query:
      // Tampilkan hasil pencarian
      for (const s of suggestions) {
        items.push({ type: 'city', city: s });
      }

      // Jika TIDAK cocok dengan kota mana pun (suggestions.length === 0),
      // tampilkan opsi '+ Pakai <teks> sebagai kota tujuan'
      if (suggestions.length === 0) {
        items.push({ type: 'custom_option', customText: trimmed });
      }
    }

    return items;
  }, [query, suggestions, recentCities, groupedProvinsi]);

  // Posisi y kumulatif untuk tiap item (virtualization)
  const itemLayouts = useMemo(() => {
    let top = 0;
    const layouts: { top: number; height: number }[] = [];
    for (const item of flatItems) {
      const height = item.type.includes('header') ? HEADER_HEIGHT : ITEM_HEIGHT;
      layouts.push({ top, height });
      top += height;
    }
    return { layouts, totalHeight: top };
  }, [flatItems]);

  // Item yang terlihat di viewport
  const visibleIndices = useMemo(() => {
    const startY = Math.max(0, scrollTop - 100);
    const endY = scrollTop + CONTAINER_HEIGHT + 100;
    const indices: number[] = [];
    for (let i = 0; i < itemLayouts.layouts.length; i++) {
      const l = itemLayouts.layouts[i];
      if (l.top + l.height >= startY && l.top <= endY) {
        indices.push(i);
      }
    }
    return indices;
  }, [scrollTop, itemLayouts]);

  // Daftar item yang bisa dipilih keyboard (bukan header)
  const selectableIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < flatItems.length; i++) {
      if (!flatItems[i].type.includes('header')) {
        indices.push(i);
      }
    }
    return indices;
  }, [flatItems]);

  // Scroll virtual listener
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
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

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (selectableIndices.length === 0) return;
      const currentPos = selectableIndices.indexOf(highlightedIndex);
      const nextPos = (currentPos + 1) % selectableIndices.length;
      const targetIdx = selectableIndices[nextPos];
      setHighlightedIndex(targetIdx);
      scrollToItem(targetIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (selectableIndices.length === 0) return;
      const currentPos = selectableIndices.indexOf(highlightedIndex);
      const prevPos = (currentPos - 1 + selectableIndices.length) % selectableIndices.length;
      const targetIdx = selectableIndices[prevPos];
      setHighlightedIndex(targetIdx);
      scrollToItem(targetIdx);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < flatItems.length) {
        const selectedItem = flatItems[highlightedIndex];
        if (selectedItem.type === 'city' || selectedItem.type === 'recent_city') {
          handleSelectCity(selectedItem.city);
        } else if (selectedItem.type === 'custom_option') {
          handleSelectCustom(selectedItem.customText);
        }
      } else if (query.trim()) {
        // Jika tidak ada item yang terpilih atau kota tidak cocok, pakai custom
        handleSelectCustom(query);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const scrollToItem = (index: number) => {
    if (!scrollContainerRef.current || index < 0 || index >= itemLayouts.layouts.length) return;
    const l = itemLayouts.layouts[index];
    const container = scrollContainerRef.current;
    if (l.top < container.scrollTop) {
      container.scrollTop = l.top;
    } else if (l.top + l.height > container.scrollTop + CONTAINER_HEIGHT) {
      container.scrollTop = l.top + l.height - CONTAINER_HEIGHT;
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
            setIsOpen((prev) => !prev);
          }}
          className="absolute right-2 p-1 text-muted hover:text-ink transition cursor-pointer"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Virtualized Dropdown Listbox */}
      {isOpen && (
        <div
          id={`city-listbox-${comboboxId}`}
          role="listbox"
          ref={scrollContainerRef}
          onScroll={handleScroll}
          style={{ maxHeight: `${CONTAINER_HEIGHT}px` }}
          className="absolute z-50 left-0 right-0 mt-1 overflow-y-auto rounded-xl border border-line bg-surface shadow-xl text-xs sm:text-sm animate-in fade-in zoom-in-95 duration-100"
        >
          <div style={{ height: `${itemLayouts.totalHeight}px`, position: 'relative' }}>
            {visibleIndices.map((idx) => {
              const item = flatItems[idx];
              const layout = itemLayouts.layouts[idx];
              const isHighlighted = highlightedIndex === idx;

              if (item.type === 'recent_header') {
                return (
                  <div
                    key={`recent-hdr-${idx}`}
                    style={{
                      position: 'absolute',
                      top: `${layout.top}px`,
                      height: `${layout.height}px`,
                      left: 0,
                      right: 0,
                    }}
                    className="px-3 flex items-center gap-1.5 bg-raised/80 border-b border-line/40 text-[11px] font-bold text-accent uppercase tracking-wider"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{item.title}</span>
                  </div>
                );
              }

              if (item.type === 'provinsi_header') {
                return (
                  <div
                    key={`prov-hdr-${idx}`}
                    style={{
                      position: 'absolute',
                      top: `${layout.top}px`,
                      height: `${layout.height}px`,
                      left: 0,
                      right: 0,
                    }}
                    data-testid="provinsi-header"
                    className="px-3 flex items-center justify-between bg-raised/90 border-b border-line/60 text-[11px] font-bold text-ink uppercase tracking-wider sticky top-0"
                  >
                    <span>{item.title}</span>
                    <span className="text-[10px] text-muted font-normal lowercase">{item.count} daerah</span>
                  </div>
                );
              }

              if (item.type === 'custom_option') {
                return (
                  <div
                    key={`custom-${idx}`}
                    role="option"
                    id="option-custom-city"
                    aria-selected={isHighlighted}
                    style={{
                      position: 'absolute',
                      top: `${layout.top}px`,
                      height: `${layout.height}px`,
                      left: 0,
                      right: 0,
                    }}
                    onClick={() => handleSelectCustom(item.customText)}
                    className={`px-3 flex items-center gap-2 cursor-pointer border-t border-line/60 transition ${
                      isHighlighted ? 'bg-accent/15 text-accent font-bold' : 'hover:bg-raised text-ink'
                    }`}
                  >
                    <Plus className="w-4 h-4 text-accent shrink-0" />
                    <div className="truncate">
                      <span>+ Pakai &apos;<strong className="text-accent">{item.customText}</strong>&apos; sebagai kota tujuan</span>
                    </div>
                  </div>
                );
              }

              // Normal or recent city item
              const isRecent = item.type === 'recent_city';
              const city = item.city;
              const isSelected = kodeWilayah === city.kode;

              return (
                <div
                  key={`city-${city.kode}-${idx}`}
                  role="option"
                  aria-selected={isHighlighted}
                  data-city-code={city.kode}
                  style={{
                    position: 'absolute',
                    top: `${layout.top}px`,
                    height: `${layout.height}px`,
                    left: 0,
                    right: 0,
                  }}
                  onClick={() => handleSelectCity(city)}
                  className={`px-3 flex items-center justify-between cursor-pointer border-b border-line/20 transition ${
                    isHighlighted
                      ? 'bg-raised text-accent font-semibold'
                      : 'text-ink hover:bg-raised/60'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="font-semibold text-xs sm:text-sm truncate">{city.nama}</div>
                    <div className="text-[11px] text-muted truncate">{city.provinsi}</div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-accent shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
