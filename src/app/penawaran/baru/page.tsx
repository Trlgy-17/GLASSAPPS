'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { defaultAdminPriceBookV1 } from '@/lib/pricing/admin-price-book';
import { hitungPenawaran } from '@/lib/pricing/pricing';
import { parseRupiah, formatRupiah } from '@/lib/pricing/format-rupiah';
import { detectZonaByKota, detectZonaPengiriman, DAFTAR_ZONA_PENGIRIMAN } from '@/lib/wilayah/zona';
import { CerminItemInput, PenawaranInput, PriceBookData, PriceBookDataAdmin } from '@/types/pricing';

// Lazy load CityCombobox agar bundle JS awal tetap kecil (<= 200 KB)
const CityCombobox = dynamic(
  () => import('@/components/ui/city-combobox').then((mod) => mod.CityCombobox),
  { ssr: false }
);
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
  Loader2,
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
function PenawaranContent() {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<PriceBookData | PriceBookDataAdmin>(defaultAdminPriceBookV1);
  const [userRole, setUserRole] = useState<'owner' | 'admin'>('admin');
  const isSavingRef = useRef(false);
  // Header State
  const [nomorPenawaran] = useState('PG-Q-2610-0001');
  const [namaKlien, setNamaKlien] = useState('');
  const [kotaKlien, setKotaKlien] = useState('');
  const [kodeWilayah, setKodeWilayah] = useState<string | undefined>(undefined);
  const [isCustomKota, setIsCustomKota] = useState(false);
  const [segmen, setSegmen] = useState<'B2C' | 'B2B'>('B2C');
  const [zona, setZona] = useState<string>('');
  const [perluPasang, setPerluPasang] = useState(false);

  // Pulihkan data hanya jika ada query param (misal dari Balas chat 'Buat penawaran')
  useEffect(() => {
    const qNama = searchParams.get('nama');
    const qKota = searchParams.get('kota');
    const qBentuk = searchParams.get('bentuk');
    const qPanjang = searchParams.get('panjang');
    const qLebar = searchParams.get('lebar');
    const qLampu = searchParams.get('lampu');
    const qKontrol = searchParams.get('kontrol');
    const qFrame = searchParams.get('frame');
    const qAntifog = searchParams.get('antifog');

    if (qNama) setNamaKlien(qNama);
    if (qKota) {
      setKotaKlien(qKota);
      const autoZ = detectZonaPengiriman(qKota);
      setZona(autoZ);
    }
    if (qBentuk || qPanjang || qLebar) {
      setItems((prev) => [
        {
          ...prev[0],
          bentuk_kode: qBentuk || prev[0].bentuk_kode,
          panjang_cm: qPanjang ? Number(qPanjang) || 60 : prev[0].panjang_cm,
          lebar_cm: qLebar ? Number(qLebar) || 80 : prev[0].lebar_cm,
          lampu: (qLampu as any) || prev[0].lampu,
          kontrol: (qKontrol as any) || prev[0].kontrol,
          frame: (qFrame as any) || prev[0].frame,
          antifog: qAntifog === 'true',
        },
      ]);
    }
  }, [searchParams]);
  // Pulihkan data penawaran untuk revisi nego jika ada parameter revisi_id
  const [revisiInfo, setRevisiInfo] = useState<{ id: string; nomor: string } | null>(null);

  useEffect(() => {
    const qRevisiId = searchParams.get('revisi_id');
    if (!qRevisiId) return;

    async function loadRevisiData() {
      try {
        const res = await fetch(`/api/penawaran/${qRevisiId}`);
        if (!res.ok) return;
        const json = await res.json();
        const p = json.penawaran;
        if (!p) return;

        setRevisiInfo({ id: p.id, nomor: p.nomor });
        if (p.leads?.nama) setNamaKlien(p.leads.nama);
        if (p.leads?.kota) setKotaKlien(p.leads.kota);
        if (p.ringkasan_json?.kode_wilayah) setKodeWilayah(p.ringkasan_json.kode_wilayah as string);
        if (p.leads?.segmen) setSegmen(p.leads.segmen);
        if (p.ringkasan_json?.zona) setZona(p.ringkasan_json.zona as string);
        else if (p.leads?.kota) setZona(detectZonaPengiriman(p.leads.kota));

        if (Array.isArray(p.items_json) && p.items_json.length > 0) {
          setItems(
            p.items_json.map((it: Record<string, unknown>) => ({
              mode: it.is_sku ? 'produk_jadi' : 'custom',
              sku_kode: (it.sku_kode as string) || undefined,
              bentuk_kode: (it.bentuk_kode as string) || 'rectangle',
              panjang_cm: Math.round(Number(it.panjang_mm || 600) / 10),
              lebar_cm: Math.round(Number(it.lebar_mm || 800) / 10),
              lampu: (it.lampu as LocalItemState['lampu']) || '3_warna',
              kontrol: (it.kontrol as LocalItemState['kontrol']) || 'touchscreen',
              frame: (it.frame as LocalItemState['frame']) || 'tanpa',
              antifog: Boolean(it.antifog),
              sandblast_pakai: Boolean((it.sandblast as Record<string, unknown>)?.pakai),
              sandblast_lebar_cm: Math.round(Number((it.sandblast as Record<string, unknown>)?.lebar_mm || 30) / 10),
              sandblast_tepi_cm: Math.round(Number((it.sandblast as Record<string, unknown>)?.jarak_tepi_mm || 20) / 10),
              qty: Number(it.qty) || 1,
            }))
          );
        }

        const ringkasan = p.ringkasan_json as Record<string, unknown> | undefined;
        const ongkirObj = ringkasan?.ongkir as Record<string, unknown> | undefined;
        const pasangObj = ringkasan?.pasang as Record<string, unknown> | undefined;
        if (ongkirObj?.deal !== undefined) {
          setOngkirInputText(String(ongkirObj.deal));
        }
        if (pasangObj?.deal !== undefined) {
          setPerluPasang(Number(pasangObj.deal) > 0);
          setPasangInputText(String(pasangObj.deal));
        }
        const paketObj = ringkasan?.paket as Record<string, unknown> | undefined;
        if (paketObj) {
          setPaketPanjang(String(paketObj.panjang_cm || ''));
          setPaketLebar(String(paketObj.lebar_cm || ''));
          setPaketTinggi(String(paketObj.tinggi_cm || ''));
          setPaketBerat(String(paketObj.berat_aktual_kg || ''));
        }
      } catch (e) {
        console.error('Gagal memuat data revisi penawaran:', e);
      }
    }

    loadRevisiData();
  }, [searchParams]);
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
  const [ongkirInputText, setOngkirInputText] = useState('');
  const [ongkirKonfirmasiOwner, setOngkirKonfirmasiOwner] = useState(false);
  const [ongkirAlasan, setOngkirAlasan] = useState('');
  // Paket Pengiriman Volumetrik (J&T Cargo)
  const [paketPanjang, setPaketPanjang] = useState('');
  const [paketLebar, setPaketLebar] = useState('');
  const [paketTinggi, setPaketTinggi] = useState('');
  const [paketBerat, setPaketBerat] = useState('');

  // Toggle Batasi Minimal 50% (Bagi Dua) - default AKTIF
  const [bagiDuaAktif, setBagiDuaAktif] = useState(true);

  // Biaya Tambahan Opsional
  const [asuransiAktif, setAsuransiAktif] = useState(false);
  const [nilaiBarangInput, setNilaiBarangInput] = useState('');
  const [packingInput, setPackingInput] = useState('');
  const [handlingInput, setHandlingInput] = useState('');

  const paketVal = useMemo(() => {
    const parseNumber = (val: string) => {
      const clean = val.replace(',', '.').trim();
      const num = parseFloat(clean);
      return isNaN(num) || num < 0 ? 0 : num;
    };
    const p = parseNumber(paketPanjang);
    const l = parseNumber(paketLebar);
    const t = parseNumber(paketTinggi);
    const b = parseNumber(paketBerat);
    if (!p && !l && !t && !b) return undefined;
    return {
      panjang_cm: p,
      lebar_cm: l,
      tinggi_cm: t,
      berat_aktual_kg: b,
    };
  }, [paketPanjang, paketLebar, paketTinggi, paketBerat]);

  const biayaTambahanVal = useMemo(() => {
    return {
      asuransi_aktif: asuransiAktif,
      nilai_barang: nilaiBarangInput.trim() ? parseRupiah(nilaiBarangInput) : undefined,
      biaya_packing: packingInput.trim() ? parseRupiah(packingInput) : 0,
      biaya_handling: handlingInput.trim() ? parseRupiah(handlingInput) : 0,
    };
  }, [asuransiAktif, nilaiBarangInput, packingInput, handlingInput]);


  const ongkirDealVal = useMemo(() => {
    if (!ongkirInputText.trim()) return undefined;
    return parseRupiah(ongkirInputText);
  }, [ongkirInputText]);

  // Nilai Deal Pasang
  const [pasangInputText, setPasangInputText] = useState('');
  const [pasangKonfirmasiOwner, setPasangKonfirmasiOwner] = useState(false);
  const [pasangAlasan, setPasangAlasan] = useState('');

  const pasangDealVal = useMemo(() => {
    if (!pasangInputText.trim()) return undefined;
    return parseRupiah(pasangInputText);
  }, [pasangInputText]);
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
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
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
        alasan_potongan_ongkir: ongkirAlasan.trim(),
        ongkir_deal: ongkirDealVal,
        pasang_deal: pasangDealVal,
        paket: paketVal,
        bagi_dua_aktif: bagiDuaAktif,
        biaya_tambahan: biayaTambahanVal,
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
    paketVal,
    bagiDuaAktif,
    biayaTambahanVal,
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
      kalkulasi.is_valid_untuk_pdf &&
      kalkulasi.errors.length === 0
  );



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
    if (!kalkulasi || isSavingRef.current || isSavingDraft || isGeneratingPdf || savedQuoteId) return;
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
          kode_wilayah: kodeWilayah,
          kanal: 'whatsapp',
          is_unduh_pdf: isUnduh,
          revisi_dari: revisiInfo?.id || undefined,
          penawaran_input: {
            segmen,
            zona,
            kode_wilayah: kodeWilayah,
            perlu_pasang: perluPasang,
            ongkir_deal: kalkulasi.ongkir.deal,
            pasang_deal: kalkulasi.pasang.deal,
            paket: paketVal,
            bagi_dua_aktif: bagiDuaAktif,
            biaya_tambahan: biayaTambahanVal,
            konfirmasi_owner: {
              pasang: pasangKonfirmasiOwner && pasangAlasan.trim() ? { sudah_dikonfirmasi: true, alasan: pasangAlasan.trim() } : undefined,
            },
            alasan_potongan_ongkir: ongkirAlasan.trim(),
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
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Gagal menyimpan');
        return;
      }

      if (json.penawaran?.id) {
        setSavedQuoteId(json.penawaran.id);
      }
      if (isUnduh) {
        const downloadUrl = json.pdf_download_url || `/api/penawaran/${json.penawaran?.id}/pdf?download=true`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${json.penawaran?.nomor || nomorPenawaran}_${(namaKlien.trim() || 'Klien').replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
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
            disabled={!isPdfDownloadEnabled || isSavingDraft || isGeneratingPdf || Boolean(savedQuoteId) || userRole === 'owner'}
            className="min-h-[44px] px-4 py-2 bg-surface border border-line text-ink hover:bg-raised rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer disabled:opacity-40"
          >
            {isSavingDraft ? <Loader2 className="w-4 h-4 text-accent animate-spin" /> : <FileText className="w-4 h-4 text-accent" />}
            <span>{isSavingDraft ? 'Menyimpan...' : savedQuoteId ? 'Tersimpan' : 'Simpan Draf'}</span>
          </button>

          <button
            type="button"
            id="btn-download-pdf"
            onClick={() => handleSimpanPenawaran(true)}
            disabled={!isPdfDownloadEnabled || isGeneratingPdf || isSavingDraft || userRole === 'owner'}
            className="min-h-[44px] px-5 py-2 bg-accent text-accent-ink rounded-xl text-xs font-bold flex items-center gap-2 hover:opacity-95 transition cursor-pointer disabled:opacity-40"
          >
            {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{isGeneratingPdf ? 'Membuat PDF...' : 'Unduh Penawaran PDF'}</span>
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-4 bg-ok-bg border border-ok/30 rounded-[18px] text-ok text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-ok shrink-0" />
            <span className="font-medium">{saveSuccessMsg}</span>
          </div>
          {savedQuoteId && (
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`/api/penawaran/${savedQuoteId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-surface text-ink hover:bg-raised border border-line rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-accent" />
                <span>Lihat PDF</span>
              </a>
              <a
                href={`/api/penawaran/${savedQuoteId}/pdf?download=true`}
                className="px-3.5 py-1.5 bg-accent text-accent-ink rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh PDF</span>
              </a>
            </div>
          )}
        </div>
      )}

      {/* Banner Mode Revisi Penawaran Nego */}
      {revisiInfo && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Mode Revisi Nego untuk Penawaran <strong>{revisiInfo.nomor}</strong>. Sesuaikan spesifikasi atau harga di kalkulator, lalu simpan sebagai penawaran revisi baru.
            </span>
          </div>
          <Link href="/penawaran" className="text-[11px] font-semibold underline hover:opacity-80">
            Kembali ke Daftar
          </Link>
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
                  placeholder="Ketik nama klien..."
                  className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink placeholder:text-muted/60 focus:bg-surface focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Kota Tujuan
                </label>
                <CityCombobox
                  value={kotaKlien}
                  kodeWilayah={kodeWilayah}
                  onChange={({ nama, kode, isCustom }) => {
                    setKotaKlien(nama);
                    setKodeWilayah(kode);
                    setIsCustomKota(Boolean(isCustom));
                    if (isCustom) {
                      // Kota manual otomatis zona luar kota (ongkir aktual/isi manual)
                      setZona('luar_kota');
                      setOngkirInputText('');
                    } else {
                      const autoZona = detectZonaPengiriman(kode || nama);
                      setZona(autoZona);
                      setOngkirInputText('');
                    }
                  }}
                  placeholder="Pilih atau ketik kota tujuan"
                />
                {isCustomKota && (
                  <p id="msg-kota-manual-warning" className="text-[11px] text-muted font-medium mt-1">
                    Kota tidak ada di daftar. Pilih zona ongkir secara manual.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Zona Pengiriman
                </label>
                <select
                  id="select-zona-pengiriman"
                  value={zona}
                  onChange={(e) => {
                    const newZona = e.target.value;
                    setZona(newZona);
                    setOngkirInputText('');
                  }}
                  className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface"
                >
                  <option value="">-- Pilih Zona Pengiriman --</option>
                  {DAFTAR_ZONA_PENGIRIMAN.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.nama} (Rp{z.fastTrackPerKg.toLocaleString('id-ID')}/kg · SLA {z.sla})
                    </option>
                  ))}
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

                      {/* KONTROL CUSTOM: 4 Pilihan Kartu Paket dari Buku Harga */}
                      <div className="space-y-2 pt-1">
                        <label className="block text-xs font-semibold text-muted">
                          Pilihan Paket Kontrol Custom:
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

                          {/* Paket 2: Touchscreen + Baterai (1.850.000) */}
                          <button
                            type="button"
                            onClick={() => updateItem(idx, { lampu: '3_warna', kontrol: 'touchscreen_baterai' })}
                            className={`p-3.5 rounded-xl border text-left transition cursor-pointer min-h-[44px] ${
                              item.kontrol === 'touchscreen_baterai'
                                ? 'border-accent bg-tint text-ink'
                                : 'border-line bg-raised text-muted hover:bg-surface'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-ink text-sm">Touchscreen + Baterai</p>
                              {item.kontrol === 'touchscreen_baterai' && (
                                <span className="w-2 h-2 rounded-full bg-led shadow-[0_0_6px_var(--led)]" />
                              )}
                            </div>
                            <p className="text-xs text-muted mt-1 leading-snug">
                              Touchscreen tombol + modul baterai cas Type-C tanpa kabel
                            </p>
                            <span className="block text-xs font-bold text-accent mt-2 tabular-nums">
                              Tarif {formatRupiah(config.tarif_m2.touchscreen_baterai_m2 || 1850000)}/m²
                            </span>
                          </button>

                          {/* Paket 3: Sensor Tangan + Baterai */}
                          <button
                            type="button"
                            onClick={() => updateItem(idx, { lampu: '3_warna', kontrol: 'sensor_baterai' })}
                            className={`p-3.5 rounded-xl border text-left transition cursor-pointer min-h-[44px] ${
                              item.kontrol === 'sensor_baterai'
                                ? 'border-accent bg-tint text-ink'
                                : 'border-line bg-raised text-muted hover:bg-surface'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-ink text-sm">Sensor Tangan + Baterai</p>
                              {item.kontrol === 'sensor_baterai' && (
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

                          {/* Paket 4: LED 1 Warna Basic */}
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
                  {kalkulasi ? formatRupiah(kalkulasi.total) : 'Rp0'}
                </span>
                {!zona && (
                  <span id="note-ongkir-belum-dipilih" className="text-[11px] text-muted block">
                    Ongkir dihitung setelah kota dipilih.
                  </span>
                )}
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

                <div className="space-y-2 pt-2 border-t border-line/40">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-ink flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-accent" /> 1. JASA PENGIRIMAN
                    </span>
                    <span className="font-extrabold text-ink tabular-nums text-sm">
                      {zona ? formatRupiah(kalkulasi?.ongkir.final ?? kalkulasi?.ongkir.deal ?? 0) : 'Rp0'}
                    </span>
                  </div>

                  {/* Toggle Cepat Zona Pengiriman */}
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-raised rounded-xl border border-line text-xs font-semibold">
                      <button
                        type="button"
                        id="btn-zona-dalam-kota"
                        onClick={() => {
                          setZona('dalam_kota');
                          setOngkirInputText('');
                        }}
                        className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer text-center text-xs ${
                          isDalamKota
                            ? 'bg-surface text-accent font-bold shadow-xs'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        Dalam kota
                      </button>
                      <button
                        type="button"
                        id="btn-zona-luar-kota"
                        onClick={() => {
                          setZona((prev) => (!prev || prev === 'dalam_kota' ? 'dki_jakarta' : prev));
                          setOngkirInputText('');
                        }}
                        className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer text-center text-xs ${
                          !isDalamKota && Boolean(zona)
                            ? 'bg-surface text-accent font-bold shadow-xs'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        Luar kota
                      </button>
                    </div>

                    {/* Opsi khusus Dalam Kota: Ambil Sendiri di Workshop (Rp0) */}
                    {isDalamKota && (
                      <button
                        type="button"
                        onClick={() => {
                          setOngkirInputText('0');
                          setBagiDuaAktif(false);
                          if (!ongkirAlasan) setOngkirAlasan('Ambil sendiri di workshop');
                        }}
                        className={`w-full py-1.5 px-2 text-[11px] font-semibold rounded-lg border transition text-center cursor-pointer ${
                          ongkirDealVal === 0
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                            : 'border-line/60 bg-raised/50 text-muted hover:text-ink'
                        }`}
                      >
                        Ambil sendiri di workshop (Rp0)
                      </button>
                    )}
                  </div>

                  {/* Input Dimensi & Berat Paket (ala J&T Cargo) */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-muted block">
                      Dimensi &amp; Berat Paket:
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      <div>
                        <input
                          type="text"
                          id="input-paket-panjang"
                          value={paketPanjang}
                          onChange={(e) => setPaketPanjang(e.target.value)}
                          placeholder="P (cm)"
                          className="w-full text-xs px-2 py-1.5 min-h-[36px] border border-line rounded-lg bg-raised text-ink focus:bg-surface focus:outline-none tabular-nums text-center font-medium"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          id="input-paket-lebar"
                          value={paketLebar}
                          onChange={(e) => setPaketLebar(e.target.value)}
                          placeholder="L (cm)"
                          className="w-full text-xs px-2 py-1.5 min-h-[36px] border border-line rounded-lg bg-raised text-ink focus:bg-surface focus:outline-none tabular-nums text-center font-medium"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          id="input-paket-tinggi"
                          value={paketTinggi}
                          onChange={(e) => setPaketTinggi(e.target.value)}
                          placeholder="T (cm)"
                          className="w-full text-xs px-2 py-1.5 min-h-[36px] border border-line rounded-lg bg-raised text-ink focus:bg-surface focus:outline-none tabular-nums text-center font-medium"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          id="input-paket-berat"
                          value={paketBerat}
                          onChange={(e) => setPaketBerat(e.target.value)}
                          placeholder="Kg aktual"
                          className="w-full text-xs px-2 py-1.5 min-h-[36px] border border-line rounded-lg bg-raised text-ink focus:bg-surface focus:outline-none tabular-nums text-center font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Ringkas Admin: Volumetrik, Berat Dipakai, Ongkir Dasar */}
                  {zona && kalkulasi && (
                    <div className="p-2.5 bg-tint/60 rounded-xl border border-line/60 space-y-2 text-[11px]">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-muted block text-[10px]">Volumetrik</span>
                          <span className="font-bold text-ink tabular-nums">{kalkulasi.ongkir.berat_volumetrik} kg</span>
                        </div>
                        <div>
                          <span className="text-muted block text-[10px]">Dikenakan</span>
                          <span className="font-bold text-ink tabular-nums">{kalkulasi.ongkir.berat_dikenakan} kg</span>
                        </div>
                        <div>
                          <span className="text-muted block text-[10px]">Ongkir Dasar</span>
                          <span className="font-bold text-accent tabular-nums">{formatRupiah(kalkulasi.ongkir.ongkir_dasar)}</span>
                        </div>
                      </div>
                      {kalkulasi.ongkir.layanan && (
                        <div className="flex items-center justify-between pt-1 border-t border-line/40 text-[10px]">
                          <span className="text-muted font-medium">
                            {kalkulasi.ongkir.layanan} · {kalkulasi.ongkir.sla}
                          </span>
                          <span className="font-semibold text-accent">
                            {formatRupiah(kalkulasi.ongkir.tarif_per_kg)}/kg
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Input Deal Ongkir */}
                  <input
                    id="input-ongkir-deal"
                    type="text"
                    value={ongkirInputText}
                    onChange={(e) => setOngkirInputText(e.target.value)}
                    placeholder={`Ketik nominal deal pengiriman (dasar: ${formatRupiah(kalkulasi?.ongkir.ongkir_dasar || 0)})...`}
                    className="w-full text-xs px-3 py-2 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none tabular-nums font-semibold"
                  />

                  {/* Toggle Batasi Minimal 50% (Bagi Dua) */}
                  <div className="space-y-1 pt-1">
                    <label className="flex items-center justify-between text-xs text-ink cursor-pointer select-none">
                      <span className="font-medium">Batasi minimal 50% (bagi dua)</span>
                      <input
                        type="checkbox"
                        id="check-bagi-dua-ongkir"
                        checked={bagiDuaAktif}
                        onChange={(e) => setBagiDuaAktif(e.target.checked)}
                        className="w-4 h-4 rounded text-accent cursor-pointer"
                      />
                    </label>
                    {bagiDuaAktif && zona && (
                      <div className="text-[11px] text-muted flex justify-between items-center">
                        <span>Minimal (dibagi dua):</span>
                        <span className="font-semibold text-ink tabular-nums">
                          {formatRupiah(kalkulasi?.ongkir.minimal_bayar || 0)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Level 3: Ditolak (< 50%) */}
                  {kalkulasi?.ongkir.wewenang === 'ditolak' && (
                    <p id="error-ongkir-ditolak" className="text-xs text-warn font-semibold mt-1">
                      {kalkulasi.ongkir.pesan}
                    </p>
                  )}

                  {/* Level 2: Di bawah list sampai 50% (Boleh oleh admin, wajib isi alasan singkat) */}
                  {kalkulasi?.ongkir.wewenang === 'perlu_alasan' && (
                    <div className="p-3 bg-raised border border-line rounded-xl space-y-1.5 mt-2">
                      <p className="text-xs font-semibold text-ink">
                        Alasan potongan ongkir (wajib diisi):
                      </p>
                      <input
                        type="text"
                        id="input-alasan-ongkir"
                        value={ongkirAlasan}
                        onChange={(e) => setOngkirAlasan(e.target.value)}
                        placeholder="Alasan potongan (misal: negosiasi/bagi dua)"
                        className="w-full text-xs px-2.5 py-1.5 min-h-[36px] border border-line rounded-lg bg-surface text-ink"
                      />
                    </div>
                  )}

                  {/* Bagian Opsional: Biaya Tambahan (Asuransi, Packing, Handling) */}
                  <div className="pt-2 border-t border-line/40 space-y-2">
                    <span className="text-xs font-bold text-ink block">Biaya Tambahan (Opsional)</span>

                    {/* Asuransi 0.2% */}
                    <div className="space-y-1.5 p-2.5 bg-raised/40 rounded-xl border border-line/60">
                      <label className="flex items-center justify-between text-xs text-ink cursor-pointer select-none">
                        <span className="font-medium">
                          Asuransi Pengiriman ({((config.logistik?.persen_asuransi ?? 0.002) * 100).toFixed(1)}%)
                        </span>
                        <input
                          type="checkbox"
                          id="check-asuransi-pengiriman"
                          checked={asuransiAktif}
                          onChange={(e) => setAsuransiAktif(e.target.checked)}
                          className="w-4 h-4 rounded text-accent cursor-pointer"
                        />
                      </label>
                      {asuransiAktif && (
                        <div className="pt-1.5 space-y-1">
                          <span className="text-[10px] text-muted block">Nilai barang (default subtotal cermin):</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              id="input-nilai-barang-asuransi"
                              value={nilaiBarangInput}
                              onChange={(e) => setNilaiBarangInput(e.target.value)}
                              placeholder={formatRupiah(kalkulasi?.subtotal_cermin || 0)}
                              className="flex-1 text-xs px-2 py-1 min-h-[32px] border border-line rounded-lg bg-surface text-ink tabular-nums"
                            />
                            <span className="text-[11px] font-bold text-accent tabular-nums">
                              +{formatRupiah(kalkulasi?.ongkir.biaya_tambahan.nominal_asuransi || 0)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Packing & Handling */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-muted block mb-0.5">Biaya Packing</span>
                        <input
                          type="text"
                          id="input-biaya-packing"
                          value={packingInput}
                          onChange={(e) => setPackingInput(e.target.value)}
                          placeholder="Rp0"
                          className="w-full text-xs px-2 py-1 min-h-[32px] border border-line rounded-lg bg-surface text-ink tabular-nums"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-muted block mb-0.5">Biaya Handling</span>
                        <input
                          type="text"
                          id="input-biaya-handling"
                          value={handlingInput}
                          onChange={(e) => setHandlingInput(e.target.value)}
                          placeholder="Rp0 (oversized)"
                          className="w-full text-xs px-2 py-1 min-h-[32px] border border-line rounded-lg bg-surface text-ink tabular-nums"
                        />
                      </div>
                    </div>

                    {Boolean(kalkulasi?.ongkir.biaya_tambahan.total && kalkulasi.ongkir.biaya_tambahan.total > 0) && (
                      <div className="flex justify-between items-center text-[11px] text-muted px-1">
                        <span>Total Biaya Tambahan:</span>
                        <span className="font-semibold text-accent tabular-nums">
                          +{formatRupiah(kalkulasi?.ongkir.biaya_tambahan.total || 0)}
                        </span>
                      </div>
                    )}
                  </div>
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
                        setPasangInputText('');
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
                  id="btn-download-pdf-mobile"
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

export default function PenawaranPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted">
          Memuat kalkulator penawaran...
        </div>
      }
    >
      <PenawaranContent />
    </Suspense>
  );
}
