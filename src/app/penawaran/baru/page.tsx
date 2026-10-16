'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { defaultAdminPriceBookV1 } from '@/lib/pricing/admin-price-book';
import { hitungPenawaran } from '@/lib/pricing/pricing';
import { parseRupiah, formatRupiah } from '@/lib/pricing/format-rupiah';
import { CerminItemInput, PenawaranInput, PriceBookData, PriceBookDataAdmin } from '@/types/pricing';
import {
  Plus,
  Trash2,
  FileText,
  Download,
  ShieldAlert,
  Sparkles,
  Info,
  CheckCircle2,
  Lock,
  AlertTriangle,
  RotateCcw,
  Copy,
} from 'lucide-react';
interface LocalItemState {
  mode: 'custom' | 'produk_jadi';
  selected_sku_kode?: string;
  bentuk_kode: string;
  panjang_cm: number;
  lebar_cm: number;
  lampu: '3_warna' | '1_warna';
  kontrol: 'touchscreen' | 'touchscreen_baterai' | 'sensor' | 'sensor_baterai' | 'saklar' | 'baterai';
  frame: 'tanpa' | 'hpl' | 'aluminium';
  antifog: boolean;
  sandblast_pakai: boolean;
  sandblast_lebar_cm: number;
  sandblast_tepi_cm: number;
  qty: number;
}

function parseDimensionInput(val: string): number {
  if (!val) return 0;
  const sanitized = val.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  if (!sanitized) return 0;
  const num = parseFloat(sanitized);
  return isNaN(num) ? 0 : num;
}

export default function PenawaranPage() {
  const [config, setConfig] = useState<PriceBookData | PriceBookDataAdmin>(defaultAdminPriceBookV1);
  const [userRole, setUserRole] = useState<'owner' | 'admin'>('admin');
  const isSavingRef = useRef(false);
  // Header State
  const [nomorPenawaran] = useState('PG-Q-2610-0001');
  const [namaKlien, setNamaKlien] = useState('');
  const [kotaKlien, setKotaKlien] = useState('Surabaya');
  const [segmen, setSegmen] = useState<'B2C' | 'B2B'>('B2C');
  const [zona, setZona] = useState<'dalam_kota' | 'luar_kota'>('luar_kota');
  const [perluPasang, setPerluPasang] = useState(false);

  // Batas dari Buku Harga
  const isDalamKota = zona === 'dalam_kota';
  const batasKirim = isDalamKota ? config.logistik?.kirim_bandung : config.logistik?.kirim_luar_kota;
  const ongkirListPrice = batasKirim?.list || (isDalamKota ? 750000 : 1300000);
  const batasOngkirAdmin = batasKirim?.batas_admin || (isDalamKota ? 500000 : 1150000);
  const batasOngkirMin = Math.round(ongkirListPrice * 0.5);

  const batasPasang = isDalamKota ? config.logistik?.pasang_bandung : config.logistik?.pasang_luar_kota;
  const pasangListPrice = batasPasang?.list || (isDalamKota ? 800000 : 1300000);
  const batasPasangAdmin = batasPasang?.batas_admin || (isDalamKota ? 500000 : 1000000);
  const batasPasangMin = isDalamKota ? 300000 : 800000;
  // Nilai Deal Ongkir
  const [ongkirDealVal, setOngkirDealVal] = useState<number | undefined>(undefined);
  const [ongkirInputText, setOngkirInputText] = useState('');
  const [isOngkirFocused, setIsOngkirFocused] = useState(false);
  const [ongkirKonfirmasiOwner, setOngkirKonfirmasiOwner] = useState(false);
  const [ongkirAlasan, setOngkirAlasan] = useState('');

  // Nilai Deal Pasang
  const [pasangDealVal, setPasangDealVal] = useState<number | undefined>(undefined);
  const [pasangInputText, setPasangInputText] = useState('');
  const [isPasangFocused, setIsPasangFocused] = useState(false);
  const [pasangKonfirmasiOwner, setPasangKonfirmasiOwner] = useState(false);
  const [pasangAlasan, setPasangAlasan] = useState('');

  // Items State
  const [items, setItems] = useState<LocalItemState[]>([
    {
      mode: 'custom',
      bentuk_kode: 'rectangle',
      panjang_cm: 60,
      lebar_cm: 80,
      lampu: '3_warna',
      kontrol: 'touchscreen',
      frame: 'tanpa',
      antifog: false,
      sandblast_pakai: false,
      sandblast_lebar_cm: 3,
      sandblast_tepi_cm: 2,
      qty: 1,
    },
  ]);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Ambil buku harga aktif & peran user
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/buku-harga');
        if (res.ok) {
          const json = await res.json();
          if (json.price_book) setConfig(json.price_book);
          if (json.role === 'admin') setUserRole('admin');
        }
      } catch (e) {
        console.warn('Gagal memuat buku harga aktif, memakai fallback v1:', e);
      }
    }
    loadData();
  }, []);

  // Hitung penawaran via pricing.ts
  const kalkulasi = useMemo(() => {
    try {
      const payload: PenawaranInput = {
        segmen,
        zona,
        perlu_pasang: perluPasang,
        konfirmasi_owner: {
          ongkir: ongkirKonfirmasiOwner ? { sudah_dikonfirmasi: true, alasan: ongkirAlasan } : undefined,
          pasang: pasangKonfirmasiOwner ? { sudah_dikonfirmasi: true, alasan: pasangAlasan } : undefined,
        },
        ongkir_deal: ongkirDealVal,
        pasang_deal: pasangDealVal,
        items: items.map((it) => {
          const rawP = Number(it.panjang_cm);
          const rawL = Number(it.lebar_cm);
          const safeP = isNaN(rawP) || rawP <= 0 ? 60 : Math.round(rawP);
          const safeL = isNaN(rawL) || rawL <= 0 ? 80 : Math.round(rawL);
          return {
            bentuk_kode: it.bentuk_kode || 'rectangle',
            panjang_mm: safeP * 10,
            lebar_mm: safeL * 10,
            lampu: it.lampu,
            kontrol: it.kontrol,
            frame: it.frame,
            antifog: it.antifog,
            sandblast: {
              pakai: it.sandblast_pakai,
              lebar_mm: Math.max(20, Math.min(50, (it.sandblast_lebar_cm || 3) * 10)),
              jarak_tepi_mm: Math.max(10, Math.min(50, (it.sandblast_tepi_cm || 2) * 10)),
            },
            qty: Math.max(1, Math.round(Number(it.qty) || 1)),
          };
        }),
      };
      return hitungPenawaran(payload, config);
    } catch (e) {
      console.warn('Error perhitungan:', e);
      return null;
    }
  }, [
    items,
    segmen,
    zona,
    perluPasang,
    ongkirDealVal,
    ongkirKonfirmasiOwner,
    ongkirAlasan,
    pasangDealVal,
    pasangKonfirmasiOwner,
    pasangAlasan,
    config,
  ]);

  const updateItem = (index: number, fields: Partial<LocalItemState>) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...fields };
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        mode: 'custom',
        bentuk_kode: 'rectangle',
        panjang_cm: 60,
        lebar_cm: 80,
        lampu: '3_warna',
        kontrol: 'touchscreen',
        frame: 'tanpa',
        antifog: false,
        sandblast_pakai: false,
        sandblast_lebar_cm: 3,
        sandblast_tepi_cm: 2,
        qty: 1,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const isPdfDownloadEnabled = Boolean(
    kalkulasi &&
      kalkulasi.ongkir.status !== 'error_merah' &&
      kalkulasi.pasang.status !== 'error_merah' &&
      (!kalkulasi.ongkir.perlu_konfirmasi || (ongkirKonfirmasiOwner && ongkirAlasan.trim())) &&
      (!kalkulasi.pasang.perlu_konfirmasi || (pasangKonfirmasiOwner && pasangAlasan.trim()))
  );

  const handleOngkirFocus = () => {
    setIsOngkirFocused(true);
    setOngkirInputText(ongkirDealVal !== undefined ? ongkirDealVal.toString() : '');
  };

  const handleOngkirBlur = () => {
    setIsOngkirFocused(false);
    const parsed = parseRupiah(ongkirInputText);
    setOngkirDealVal(parsed !== undefined ? parsed : undefined);
  };

  const handlePasangFocus = () => {
    setIsPasangFocused(true);
    setPasangInputText(pasangDealVal !== undefined ? pasangDealVal.toString() : '');
  };

  const handlePasangBlur = () => {
    setIsPasangFocused(false);
    const parsed = parseRupiah(pasangInputText);
    setPasangDealVal(parsed !== undefined ? parsed : undefined);
  };

  const handleCopyRingkasanWa = () => {
    if (!kalkulasi) return;
    const text =
      `*PENAWARAN RESMI PUTRA GLASS*\n` +
      `Klien: ${namaKlien.trim() || 'Klien'}\n` +
      `Kota: ${kotaKlien.trim() || 'Bandung'}\n` +
      `Total: *${formatRupiah(kalkulasi.total)}*\n` +
      `DP 50%: *${formatRupiah(kalkulasi.dp_50)}*\n` +
      `Pelunasan: *${formatRupiah(kalkulasi.pelunasan)}*\n` +
      `Garansi resmi 7 hari pengiriman + 3 bulan fungsi kelistrikan LED & touchscreen.`;
    navigator.clipboard.writeText(text);
    alert('Ringkasan penawaran berhasil disalin untuk WhatsApp!');
  };

  const handleSimpanPenawaran = async (isUnduh: boolean) => {
    if (!kalkulasi || isSavingRef.current || isSavingDraft || isGeneratingPdf) return;
    isSavingRef.current = true;
    if (isUnduh) setIsGeneratingPdf(true);
    else setIsSavingDraft(true);
    setSaveSuccessMsg(null);

    try {
      const res = await fetch('/api/penawaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_klien: namaKlien.trim() || 'Klien Putra Glass',
          kota_klien: kotaKlien.trim() || 'Bandung',
          kanal: 'whatsapp',
          segmen,
          zona,
          perlu_pasang: perluPasang,
          items: items.map((it) => ({
            bentuk_kode: it.bentuk_kode,
            panjang_mm: it.panjang_cm * 10,
            lebar_mm: it.lebar_cm * 10,
            lampu: it.lampu,
            kontrol: it.kontrol,
            frame: it.frame,
            antifog: it.antifog,
            sandblast: {
              pakai: it.sandblast_pakai,
              lebar_mm: it.sandblast_lebar_cm * 10,
              jarak_tepi_mm: it.sandblast_tepi_cm * 10,
            },
            qty: it.qty,
          })),
          is_unduh: isUnduh,
          ongkir_deal: kalkulasi.ongkir.deal,
          pasang_deal: kalkulasi.pasang.deal,
          alasan_ongkir: ongkirAlasan,
          alasan_pasang: pasangAlasan,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Gagal menyimpan');
        return;
      }

      if (isUnduh) {
        if (json.pdf_url) {
          const link = document.createElement('a');
          link.href = json.pdf_url;
          link.download = `${json.penawaran?.nomor || nomorPenawaran}_${(namaKlien.trim() || 'Klien').replace(/\s+/g, '_')}.pdf`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        setSaveSuccessMsg(`Penawaran ${json.penawaran?.nomor} berhasil disimpan dengan status 'terkirim'!`);
      } else {
        setSaveSuccessMsg(`Penawaran ${json.penawaran?.nomor} berhasil disimpan sebagai 'draf'!`);
      }
    } catch (e) {
      console.error('Error saving:', e);
      alert('Terjadi kesalahan saat menyimpan');
    } finally {
      isSavingRef.current = false;
      setIsGeneratingPdf(false);
      setIsSavingDraft(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[30px] font-extrabold text-ink leading-tight">
              Kalkulator Penawaran
            </h1>
            <span className="text-xs px-2.5 py-1 bg-surface border border-line rounded-lg text-muted font-semibold">
              Buku Harga v{config.versi} (Live)
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            Penghitungan instan &amp; penawaran PDF resmi Putra Glass
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            id="btn-simpan-penawaran"
            onClick={() => handleSimpanPenawaran(false)}
            disabled={!isPdfDownloadEnabled || isSavingDraft || userRole === 'owner'}
            className="min-h-[44px] px-4 py-2 bg-surface border border-line text-ink hover:bg-raised rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-40"
          >
            <FileText className="w-4 h-4 text-accent" />
            <span>{isSavingDraft ? 'Menyimpan...' : 'Simpan Draf'}</span>
          </button>

          <button
            type="button"
            id="btn-download-pdf"
            onClick={() => handleSimpanPenawaran(true)}
            disabled={!isPdfDownloadEnabled || isGeneratingPdf || userRole === 'owner'}
            className="min-h-[44px] px-5 py-2 bg-accent text-accent-ink rounded-xl text-xs font-bold flex items-center gap-2 hover:opacity-95 transition cursor-pointer disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            <span>{isGeneratingPdf ? 'Membuat PDF...' : 'Unduh Penawaran PDF'}</span>
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-4 bg-ok-bg border border-ok/30 rounded-[18px] text-ok text-sm flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-ok shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Grid Layout 2 Kolom */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: Form Input (7 / 12) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Data Klien & Pengiriman */}
          <div className="bg-surface p-6 rounded-[20px] border border-line shadow-none space-y-4">
            <h2 className="text-[17px] font-bold text-ink flex items-center gap-2">
              <Info className="w-4 h-4 text-accent" /> Informasi Klien &amp; Tujuan
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Nama Klien
                </label>
                <input
                  id="input-nama-klien"
                  type="text"
                  value={namaKlien}
                  onChange={(e) => setNamaKlien(e.target.value)}
                  placeholder="contoh: Kak Rina"
                  className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink placeholder:text-muted/60 focus:bg-surface focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Kota Tujuan
                </label>
                <input
                  type="text"
                  value={kotaKlien}
                  onChange={(e) => setKotaKlien(e.target.value)}
                  placeholder="contoh: Surabaya"
                  className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Zona Pengiriman
                </label>
                <select
                  value={zona}
                  onChange={(e) => {
                    const newZona = e.target.value as 'dalam_kota' | 'luar_kota';
                    setZona(newZona);
                    setOngkirDealVal(undefined);
                  }}
                  className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface"
                >
                  <option value="luar_kota">Luar Kota (Packing Kayu - List: Rp1.300.000)</option>
                  <option value="dalam_kota">Bandung Raya (List: Rp750.000)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Segmen Klien
                </label>
                <select
                  value={segmen}
                  onChange={(e) => setSegmen(e.target.value as 'B2C' | 'B2B')}
                  className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface"
                >
                  <option value="B2C">B2C (Retail)</option>
                  <option value="B2B">B2B (Proyek / Desainer)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Rincian Cermin Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-ink flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" /> Rincian Cermin ({items.length})
              </h2>
              <button
                type="button"
                onClick={addItem}
                className="min-h-[44px] flex items-center gap-2 text-xs bg-accent text-accent-ink px-4 py-2 rounded-xl font-bold hover:opacity-95 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Tambah Cermin
              </button>
            </div>

            {items.map((item, idx) => {
              const bentukDef = config.master_bentuk.find((b) => b.kode === item.bentuk_kode);
              const bolehAluminium = bentukDef?.boleh_aluminium ?? false;

              return (
                <div key={idx} className="bg-surface p-6 rounded-[20px] border border-line shadow-none space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-ink text-sm">Cermin #{idx + 1}</span>
                      {/* Toggle Mode: Produk Jadi (SKU) vs Custom */}
                      <div className="inline-flex p-1 bg-raised rounded-xl border border-line text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            const firstSku = config.sku_katalog[0];
                            updateItem(idx, {
                              mode: 'produk_jadi',
                              bentuk_kode: firstSku?.bentuk_kode || 'rectangle',
                              panjang_cm: (firstSku?.panjang_mm || 600) / 10,
                              lebar_cm: (firstSku?.lebar_mm || 400) / 10,
                              kontrol: firstSku?.kontrol || 'touchscreen',
                              sandblast_pakai: Boolean(firstSku?.sandblast),
                              lampu: '3_warna',
                            });
                          }}
                          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                            item.mode === 'produk_jadi'
                              ? 'bg-surface text-accent font-bold shadow-xs'
                              : 'text-muted hover:text-ink'
                          }`}
                        >
                          Produk Jadi (SKU)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItem(idx, { mode: 'custom', lampu: '3_warna', kontrol: 'touchscreen' })}
                          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                            item.mode === 'custom'
                              ? 'bg-surface text-accent font-bold shadow-xs'
                              : 'text-muted hover:text-ink'
                          }`}
                        >
                          Custom Ukuran (per m²)
                        </button>
                      </div>
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-warn hover:opacity-80 text-xs font-semibold flex items-center gap-1 cursor-pointer self-end sm:self-auto"
                      >
                        <Trash2 className="w-4 h-4" /> Hapus
                      </button>
                    )}
                  </div>

                  {item.mode === 'produk_jadi' ? (
                    /* =========================================================================
                       MODE PRODUK JADI (SKU KATALOG)
                       Kontrol = Touchscreen (TC) / Sensor Tangan (ST) / Baterai (BT)
                       Ukuran & bentuk mengambil dari daftar SKU katalog aktif
                       ========================================================================= */
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-muted mb-1.5">
                            Pilih Model &amp; Ukuran Katalog:
                          </label>
                          <select
                            value={`${item.bentuk_kode}|${item.panjang_cm}|${item.lebar_cm}|${item.sandblast_pakai}`}
                            onChange={(e) => {
                              const [b, p, l, sb] = e.target.value.split('|');
                              updateItem(idx, {
                                bentuk_kode: b,
                                panjang_cm: Number(p),
                                lebar_cm: Number(l),
                                sandblast_pakai: sb === 'true',
                              });
                            }}
                            className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink"
                          >
                            {/* Kelompokkan SKU unik berdasarkan bentuk & ukuran */}
                            {Array.from(
                              new Set(
                                config.sku_katalog.map(
                                  (s) => `${s.bentuk_kode}|${s.panjang_mm / 10}|${s.lebar_mm / 10}|${s.sandblast}`
                                )
                              )
                            ).map((key) => {
                              const [b, p, l, sb] = key.split('|');
                              const bDef = config.master_bentuk.find((mb) => mb.kode === b);
                              const sbLabel = sb === 'true' ? 'Sandblast' : 'Polos';
                              return (
                                <option key={key} value={key}>
                                  {bDef?.label || b} {p}×{l} cm ({sbLabel})
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted mb-1.5">
                            Dimensi Fisik Terpilih:
                          </label>
                          <div className="p-2.5 bg-raised border border-line rounded-xl text-sm font-semibold text-ink flex items-center justify-between min-h-[44px]">
                            <span>{item.panjang_cm} × {item.lebar_cm} cm</span>
                            <span className="text-xs text-muted">
                              {item.sandblast_pakai ? 'Dengan Sandblast' : 'Tanpa Sandblast'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Kartu Pilihan Kontrol Produk Jadi (TC / ST / BT) */}
                      <div className="space-y-2 pt-1">
                        <label className="block text-xs font-semibold text-muted">
                          Pilihan Kontrol Produk Jadi:
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Touchscreen (TC) */}
                          {(() => {
                            const skuTc = config.sku_katalog.find(
                              (s) =>
                                s.bentuk_kode === item.bentuk_kode &&
                                ((s.panjang_mm === item.panjang_cm * 10 && s.lebar_mm === item.lebar_cm * 10) ||
                                  (s.panjang_mm === item.lebar_cm * 10 && s.lebar_mm === item.panjang_cm * 10)) &&
                                s.sandblast === item.sandblast_pakai &&
                                s.kontrol === 'touchscreen'
                            );
                            return (
                              <button
                                type="button"
                                onClick={() => updateItem(idx, { kontrol: 'touchscreen' })}
                                className={`p-3.5 rounded-xl border text-left transition cursor-pointer min-h-[44px] ${
                                  item.kontrol === 'touchscreen'
                                    ? 'border-accent bg-tint text-ink'
                                    : 'border-line bg-raised text-muted hover:bg-surface'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <p className="font-bold text-ink text-sm">Touchscreen (TC)</p>
                                  {item.kontrol === 'touchscreen' && (
                                    <span className="w-2 h-2 rounded-full bg-led shadow-[0_0_6px_var(--led)]" />
                                  )}
                                </div>
                                <p className="text-xs text-muted mt-1 leading-snug">
                                  Tombol sentuh kaca, kabel colok listrik
                                </p>
                                <span className="block text-xs font-bold text-accent mt-2 tabular-nums">
                                  {skuTc ? formatRupiah(skuTc.harga_tetap) : 'Tersedia di katalog'}
                                </span>
                              </button>
                            );
                          })()}

                          {/* Sensor Tangan (ST) */}
                          {(() => {
                            const skuSt = config.sku_katalog.find(
                              (s) =>
                                s.bentuk_kode === item.bentuk_kode &&
                                ((s.panjang_mm === item.panjang_cm * 10 && s.lebar_mm === item.lebar_cm * 10) ||
                                  (s.panjang_mm === item.lebar_cm * 10 && s.lebar_mm === item.panjang_cm * 10)) &&
                                s.sandblast === item.sandblast_pakai &&
                                s.kontrol === 'sensor'
                            );
                            return (
                              <button
                                type="button"
                                onClick={() => updateItem(idx, { kontrol: 'sensor' })}
                                className={`p-3.5 rounded-xl border text-left transition cursor-pointer min-h-[44px] ${
                                  item.kontrol === 'sensor'
                                    ? 'border-accent bg-tint text-ink'
                                    : 'border-line bg-raised text-muted hover:bg-surface'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <p className="font-bold text-ink text-sm">Sensor Tangan (ST)</p>
                                  {item.kontrol === 'sensor' && (
                                    <span className="w-2 h-2 rounded-full bg-led shadow-[0_0_6px_var(--led)]" />
                                  )}
                                </div>
                                <p className="text-xs text-muted mt-1 leading-snug">
                                  Lambaikan tangan on/off tanpa menyentuh cermin
                                </p>
                                <span className="block text-xs font-bold text-accent mt-2 tabular-nums">
                                  {skuSt ? formatRupiah(skuSt.harga_tetap) : 'Tersedia di katalog'}
                                </span>
                              </button>
                            );
                          })()}

                          {/* Baterai (BT) */}
                          {(() => {
                            const skuBt = config.sku_katalog.find(
                              (s) =>
                                s.bentuk_kode === item.bentuk_kode &&
                                ((s.panjang_mm === item.panjang_cm * 10 && s.lebar_mm === item.lebar_cm * 10) ||
                                  (s.panjang_mm === item.lebar_cm * 10 && s.lebar_mm === item.panjang_cm * 10)) &&
                                s.sandblast === item.sandblast_pakai &&
                                s.kontrol === 'baterai'
                            );
                            return (
                              <button
                                type="button"
                                onClick={() => updateItem(idx, { kontrol: 'baterai' })}
                                className={`p-3.5 rounded-xl border text-left transition cursor-pointer min-h-[44px] ${
                                  item.kontrol === 'baterai' || item.kontrol === 'touchscreen_baterai'
                                    ? 'border-accent bg-tint text-ink'
                                    : 'border-line bg-raised text-muted hover:bg-surface'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <p className="font-bold text-ink text-sm">Baterai Cas (BT)</p>
                                  {(item.kontrol === 'baterai' || item.kontrol === 'touchscreen_baterai') && (
                                    <span className="w-2 h-2 rounded-full bg-led shadow-[0_0_6px_var(--led)]" />
                                  )}
                                </div>
                                <p className="text-xs text-muted mt-1 leading-snug">
                                  Tanpa kabel di dinding, cas Type-C rechargeable
                                </p>
                                <span className="block text-xs font-bold text-accent mt-2 tabular-nums">
                                  {skuBt ? formatRupiah(skuBt.harga_tetap) : 'Tersedia di katalog'}
                                </span>
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* =========================================================================
                       MODE CUSTOM (PER M²)
                       Paket = LED 3 Warna Premium / Sensor Tangan + Baterai / LED 1 Warna Basic
                       Bebas tentukan ukuran panjang & lebar
                       ========================================================================= */
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-muted mb-1.5">
                            Bentuk Cermin Custom
                          </label>
                          <select
                            value={item.bentuk_kode}
                            onChange={(e) => {
                              const newKode = e.target.value;
                              const shapeDef = config.master_bentuk.find((b) => b.kode === newKode);
                              updateItem(idx, {
                                bentuk_kode: newKode,
                                frame: item.frame === 'aluminium' && !shapeDef?.boleh_aluminium ? 'tanpa' : item.frame,
                              });
                            }}
                            className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink"
                          >
                            {config.master_bentuk.map((b) => (
                              <option key={b.kode} value={b.kode}>
                                {b.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted mb-1.5">
                            Panjang (cm)
                          </label>

                          <input
                            type="text"
                            inputMode="decimal"
                            id={`input-panjang-${idx}`}
                            value={item.panjang_cm}
                            onChange={(e) => updateItem(idx, { panjang_cm: parseDimensionInput(e.target.value) })}
                            className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink tabular-nums"
                          />
                          {(item.panjang_cm < 15 || item.panjang_cm > 300) && (
                            <p className="text-xs text-warn mt-1 font-medium">Ukuran standar 15–300 cm</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-muted mb-1.5">
                            Lebar (cm)
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            id={`input-lebar-${idx}`}
                            value={item.lebar_cm}
                            onChange={(e) => updateItem(idx, { lebar_cm: parseDimensionInput(e.target.value) })}
                            className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink tabular-nums"
                          />

                          {(item.lebar_cm < 15 || item.lebar_cm > 300) && (
                            <p className="text-xs text-warn mt-1 font-medium">Ukuran standar 15–300 cm</p>
                          )}
                        </div>
                      </div>

                      {/* KONTROL CUSTOM: 3 Pilihan Kartu Paket dari Buku Harga */}
                      <div className="space-y-2 pt-1">
                        <label className="block text-xs font-semibold text-muted">
                          Pilihan Paket Kontrol Custom:
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Paket 1: LED 3 Warna Premium */}
                          <button
                            type="button"
                            onClick={() => updateItem(idx, { lampu: '3_warna', kontrol: 'touchscreen' })}
                            className={`p-3.5 rounded-xl border text-left transition cursor-pointer min-h-[44px] ${
                              item.lampu === '3_warna' && item.kontrol === 'touchscreen'
                                ? 'border-accent bg-tint text-ink'
                                : 'border-line bg-raised text-muted hover:bg-surface'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-ink text-sm">LED 3 Warna Premium</p>
                              {item.lampu === '3_warna' && item.kontrol === 'touchscreen' && (
                                <span className="w-2 h-2 rounded-full bg-led shadow-[0_0_6px_var(--led)]" />
                              )}
                            </div>
                            <p className="text-xs text-muted mt-1 leading-snug">
                              Warm, Natural, Cool White dengan tombol touchscreen kabel
                            </p>
                            <span className="block text-xs font-bold text-accent mt-2 tabular-nums">
                              Tarif {formatRupiah(config.tarif_m2.premium_b2c)}/m²
                            </span>
                          </button>

                          {/* Paket 2: Sensor Tangan + Baterai */}
                          <button
                            type="button"
                            onClick={() => updateItem(idx, { lampu: '3_warna', kontrol: 'sensor_baterai' })}
                            className={`p-3.5 rounded-xl border text-left transition cursor-pointer min-h-[44px] ${
                              item.kontrol === 'sensor_baterai' || item.kontrol === 'touchscreen_baterai'
                                ? 'border-accent bg-tint text-ink'
                                : 'border-line bg-raised text-muted hover:bg-surface'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-ink text-sm">Sensor Tangan + Baterai</p>
                              {(item.kontrol === 'sensor_baterai' || item.kontrol === 'touchscreen_baterai') && (
                                <span className="w-2 h-2 rounded-full bg-led shadow-[0_0_6px_var(--led)]" />
                              )}
                            </div>
                            <p className="text-xs text-muted mt-1 leading-snug">
                              Tanpa colokan listrik, cas Type-C tahan 2–3 minggu
                            </p>
                            <span className="block text-xs font-bold text-accent mt-2 tabular-nums">
                              Tarif Premium + Add-on {formatRupiah(config.add_on.sensor_baterai?.harga || 250000)}
                            </span>
                          </button>

                          {/* Paket 3: LED 1 Warna Basic */}
                          <button
                            type="button"
                            onClick={() => updateItem(idx, { lampu: '1_warna', kontrol: 'saklar' })}
                            className={`p-3.5 rounded-xl border text-left transition cursor-pointer min-h-[44px] ${
                              item.lampu === '1_warna' || item.kontrol === 'saklar'
                                ? 'border-accent bg-tint text-ink'
                                : 'border-line bg-raised text-muted hover:bg-surface'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-ink text-sm">LED 1 Warna Basic</p>
                              {(item.lampu === '1_warna' || item.kontrol === 'saklar') && (
                                <span className="w-2 h-2 rounded-full bg-led shadow-[0_0_6px_var(--led)]" />
                              )}
                            </div>
                            <p className="text-xs text-muted mt-1 leading-snug">
                              1 warna lampu pilihan dengan saklar dinding standar
                            </p>
                            <span className="block text-xs font-bold text-accent mt-2 tabular-nums">
                              Tarif {formatRupiah(config.tarif_m2.basic_m2)}/m²
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Sandblast Custom Option */}
                      <div className="pt-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-ink cursor-pointer min-h-[36px]">
                          <input
                            type="checkbox"
                            checked={item.sandblast_pakai}
                            onChange={(e) => updateItem(idx, { sandblast_pakai: e.target.checked })}
                            className="w-4 h-4 rounded text-accent"
                          />
                          <span>Garis Sandblast (+{formatRupiah(config.add_on.sandblast?.harga || 100000)}/m keliling)</span>
                        </label>
                      </div>
                    </div>
                  )}
                  {/* Frame Luar & Addons */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1.5">
                        Frame Luar
                      </label>
                      <select
                        value={item.frame}
                        onChange={(e) => updateItem(idx, { frame: e.target.value as any })}
                        className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink"
                      >
                        <option value="tanpa">Tanpa Frame (Frameless Bevel)</option>
                        <option value="hpl">Frame HPL (+200k)</option>
                        <option value="aluminium" disabled={!bolehAluminium}>
                          Frame Aluminium (+400k) {!bolehAluminium ? '(Hanya Persegi)' : ''}
                        </option>
                      </select>
                      {!bolehAluminium && item.frame === 'aluminium' && (
                        <p className="text-xs text-warn mt-1 font-medium">
                          Aluminium hanya untuk bentuk persegi siku.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col justify-end space-y-2 pb-1">
                      <label className="flex items-center gap-2 text-sm font-medium text-ink cursor-pointer min-h-[36px]">
                        <input
                          type="checkbox"
                          checked={item.antifog}
                          onChange={(e) => updateItem(idx, { antifog: e.target.checked })}
                          className="w-4 h-4 rounded text-accent"
                        />
                        <span>Antifog Pad (+Rp200.000)</span>
                      </label>

                      <label className="flex items-center gap-2 text-sm font-medium text-ink cursor-pointer min-h-[36px]">
                        <input
                          type="checkbox"
                          checked={item.sandblast_pakai}
                          onChange={(e) => updateItem(idx, { sandblast_pakai: e.target.checked })}
                          className="w-4 h-4 rounded text-accent"
                        />
                        <span>Garis Sandblast (+Rp100.000/m)</span>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kolom Kanan: Ringkasan Harga (5 / 12 Sticky) */}
        <div className="lg:col-span-5 sticky top-20 space-y-4">
          {kalkulasi && (
            <div className="bg-surface rounded-[20px] border border-line shadow-none p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <h3 className="font-bold text-ink text-[17px] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" /> Ringkasan Penawaran
                </h3>
                <span className="text-xs text-muted font-medium tabular-nums">
                  Total {kalkulasi.total_unit} unit
                </span>
              </div>

              {/* Total Penawaran 36px/800 */}
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted block">Total Penawaran:</span>
                <span id="label-total-penawaran" className="text-[36px] font-extrabold text-ink leading-tight tabular-nums block">
                  {formatRupiah(kalkulasi.total)}
                </span>
              </div>

              {/* DP 50% & Pelunasan */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 bg-tint rounded-xl border border-line/40 space-y-1">
                  <span className="block text-xs font-semibold text-accent">DP 50%</span>
                  <span className="text-lg font-bold tabular-nums text-ink block">
                    {formatRupiah(kalkulasi.dp_50)}
                  </span>
                  <span className="block text-[11px] text-muted">untuk mulai produksi</span>
                </div>

                <div className="p-3.5 bg-raised rounded-xl border border-line space-y-1">
                  <span className="block text-xs font-semibold text-muted">Pelunasan</span>
                  <span className="text-lg font-bold tabular-nums text-ink block">
                    {formatRupiah(kalkulasi.pelunasan)}
                  </span>
                  <span className="block text-[11px] text-muted">sebelum barang dikirim</span>
                </div>
              </div>

              {/* Rincian Subtotal, Ongkir, Pasang */}
              <div className="space-y-3 pt-3 border-t border-line text-sm">
                <div className="flex justify-between items-center text-muted">
                  <span>Subtotal Cermin:</span>
                  <span className="font-semibold text-ink tabular-nums">{formatRupiah(kalkulasi.subtotal_cermin)}</span>
                </div>

                {/* Ongkir Deal Input */}
                <div className="space-y-1.5 pt-2 border-t border-line/40">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-accent" /> Ongkir Deal (List: {formatRupiah(ongkirListPrice)}):
                    </span>
                    <span className="font-bold text-ink tabular-nums">{formatRupiah(kalkulasi.ongkir.deal)}</span>
                  </div>

                  <input
                    id="input-ongkir-deal"
                    type="text"
                    value={isOngkirFocused ? ongkirInputText : formatRupiah(kalkulasi.ongkir.deal)}
                    onFocus={handleOngkirFocus}
                    onBlur={handleOngkirBlur}
                    onChange={(e) => setOngkirInputText(e.target.value)}
                    placeholder={`Default: ${formatRupiah(ongkirListPrice)}`}
                    className="w-full text-xs px-3 py-2 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none"
                  />
                  <p className="text-[11px] text-muted">
                    Batas Wewenang Admin: {formatRupiah(batasOngkirAdmin)}
                  </p>

                  {kalkulasi.ongkir.status === 'error_merah' && (
                    <p className="text-xs text-warn font-semibold mt-1">
                      Minimal {formatRupiah(batasOngkirMin)} (ongkir maksimal dibagi 2)
                    </p>
                  )}

                  {kalkulasi.ongkir.perlu_konfirmasi && (
                    <div className="p-3 bg-tint border border-line rounded-xl space-y-2 mt-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                        <input
                          type="checkbox"
                          id="check-konfirmasi-ongkir"
                          checked={ongkirKonfirmasiOwner}
                          onChange={(e) => setOngkirKonfirmasiOwner(e.target.checked)}
                          className="w-4 h-4 rounded text-accent"
                        />
                        <span>Konfirmasi persetujuan owner</span>
                      </label>
                      {ongkirKonfirmasiOwner && (
                        <input
                          type="text"
                          id="input-alasan-ongkir"
                          value={ongkirAlasan}
                          onChange={(e) => setOngkirAlasan(e.target.value)}
                          placeholder="Alasan potongan (wajib diisi)"
                          className="w-full text-xs px-2.5 py-1.5 min-h-[36px] border border-line rounded-lg bg-surface text-ink"
                        />
                      )}
                    </div>
                  )}
                </div>

                {kalkulasi.pasang.perlu_konfirmasi && (
                  <div className="p-3 bg-tint border border-line rounded-xl space-y-2 mt-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                      <input
                        type="checkbox"
                        id="check-konfirmasi-pasang"
                        checked={pasangKonfirmasiOwner}
                        onChange={(e) => setPasangKonfirmasiOwner(e.target.checked)}
                        className="w-4 h-4 rounded text-accent"
                      />
                      <span>Konfirmasi persetujuan owner</span>
                    </label>
                    {pasangKonfirmasiOwner && (
                      <input
                        type="text"
                        id="input-alasan-pasang"
                        value={pasangAlasan}
                        onChange={(e) => setPasangAlasan(e.target.value)}
                        placeholder="Alasan potongan pasang (wajib diisi)"
                        className="w-full text-xs px-2.5 py-1.5 min-h-[36px] border border-line rounded-lg bg-surface text-ink"
                      />
                    )}
                  </div>
                )}

                {/* Pemasangan Checkbox */}
                <div className="pt-2 border-t border-line/40 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-ink cursor-pointer min-h-[36px]">
                    <input
                      type="checkbox"
                      checked={perluPasang}
                      onChange={(e) => {
                        setPerluPasang(e.target.checked);
                        setPasangDealVal(undefined);
                      }}
                      className="w-4 h-4 rounded text-accent"
                    />
                    <span>Perlu Pemasangan Teknisi</span>
                  </label>
                </div>
              </div>

              {/* Tombol Aksi: PDF + Salin Ringkasan WhatsApp */}
              <div className="space-y-2.5 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={handleCopyRingkasanWa}
                  className="w-full min-h-[48px] bg-surface hover:bg-raised text-ink border border-line rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-none"
                >
                  <Copy className="w-4 h-4" />
                  <span>Salin Ringkasan untuk WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSimpanPenawaran(true)}
                  disabled={!isPdfDownloadEnabled || isGeneratingPdf || userRole === 'owner'}
                  className="w-full min-h-[48px] bg-accent text-accent-ink rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-40 transition cursor-pointer shadow-none"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Penawaran PDF</span>
                </button>
              </div>

              <div className="text-xs text-muted flex items-center gap-2 pt-1">
                <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
                <span>Garansi 7 hari pecah perjalanan · fungsi LED 3 bulan</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
