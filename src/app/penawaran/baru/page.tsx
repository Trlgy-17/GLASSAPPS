'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { defaultPriceBookV1 } from '@/lib/pricing/default-price-book';
import { hitungPenawaran } from '@/lib/pricing/pricing';
import { parseRupiah, formatRupiah } from '@/lib/pricing/format-rupiah';
import { CerminItemInput, PenawaranInput, PriceBookData } from '@/types/pricing';
import { PenawaranDocument } from '@/lib/pdf/PenawaranDocument';
import { pdf } from '@react-pdf/renderer';
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
} from 'lucide-react';

interface LocalItemState {
  bentuk_kode: string;
  panjang_cm: number;
  lebar_cm: number;
  lampu: '3_warna' | '1_warna';
  kontrol: 'touchscreen' | 'touchscreen_baterai' | 'sensor' | 'sensor_baterai' | 'saklar';
  frame: 'tanpa' | 'hpl' | 'aluminium';
  antifog: boolean;
  sandblast_pakai: boolean;
  sandblast_lebar_cm: number;
  sandblast_tepi_cm: number;
  qty: number;
}

export default function PenawaranPage() {
  const [config, setConfig] = useState<PriceBookData>(defaultPriceBookV1);
  const [userRole, setUserRole] = useState<'owner' | 'admin'>('admin');

  // Header State: Form mulai KOSONG (placeholder abu-abu "contoh: Kak Rina")
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
  const batasOngkirOwner = batasKirim?.batas_owner || (isDalamKota ? 375000 : 650000);

  const batasPasang = isDalamKota ? config.logistik?.pasang_bandung : config.logistik?.pasang_luar_kota;
  const pasangListPrice = batasPasang?.list || (isDalamKota ? 800000 : 1300000);
  const batasPasangAdmin = batasPasang?.batas_admin || (isDalamKota ? 500000 : 1000000);
  const batasPasangOwner = batasPasang?.batas_owner || (isDalamKota ? 300000 : 800000);

  // Nilai Deal Ongkir (Integer Rupiah)
  const [ongkirDealVal, setOngkirDealVal] = useState<number | undefined>(undefined);
  const [ongkirInputText, setOngkirInputText] = useState('');
  const [isOngkirFocused, setIsOngkirFocused] = useState(false);
  const [ongkirKonfirmasiOwner, setOngkirKonfirmasiOwner] = useState(false);
  const [ongkirAlasan, setOngkirAlasan] = useState('');

  // Nilai Deal Pasang (Integer Rupiah)
  const [pasangDealVal, setPasangDealVal] = useState<number | undefined>(undefined);
  const [pasangInputText, setPasangInputText] = useState('');
  const [isPasangFocused, setIsPasangFocused] = useState(false);
  const [pasangKonfirmasiOwner, setPasangKonfirmasiOwner] = useState(false);
  const [pasangAlasan, setPasangAlasan] = useState('');

  // Items State (Default Bagian 6: 60x80 cm, Premium, sensor+baterai, antifog, Surabaya luar kota)
  const [items, setItems] = useState<LocalItemState[]>([
    {
      bentuk_kode: 'rectangle',
      panjang_cm: 60,
      lebar_cm: 80,
      lampu: '3_warna',
      kontrol: 'sensor_baterai',
      frame: 'tanpa',
      antifog: true,
      sandblast_pakai: false,
      sandblast_lebar_cm: 3,
      sandblast_tepi_cm: 2,
      qty: 1,
    },
  ]);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Load Buku Harga Aktif dari API (/api/buku-harga)
  useEffect(() => {
    async function loadPriceBook() {
      try {
        const res = await fetch('/api/buku-harga');
        if (res.ok) {
          const json = await res.json();
          if (json.price_book) {
            setConfig(json.price_book);
            setUserRole(json.role || 'admin');
          }
        }
      } catch (err) {
        console.warn('Gagal memuat buku harga dari API, menggunakan fallback v1:', err);
      }
    }
    loadPriceBook();
  }, []);

  // Effective Deal Values (Kolom kosong = default harga list, bukan 0)
  const effectiveOngkirDeal = ongkirDealVal !== undefined ? ongkirDealVal : ongkirListPrice;
  const effectivePasangDeal = pasangDealVal !== undefined ? pasangDealVal : pasangListPrice;

  // Transform UI items ke Input Mesin Harga
  const penawaranInput: PenawaranInput = useMemo(() => {
    const formattedItems: CerminItemInput[] = items.map((it) => ({
      bentuk_kode: it.bentuk_kode,
      panjang_mm: Math.round(it.panjang_cm * 10),
      lebar_mm: Math.round(it.lebar_cm * 10),
      lampu: it.lampu,
      kontrol: it.kontrol,
      frame: it.frame,
      antifog: it.antifog,
      sandblast: {
        pakai: it.sandblast_pakai,
        lebar_mm: it.sandblast_pakai ? Math.round(it.sandblast_lebar_cm * 10) : undefined,
        jarak_tepi_mm: it.sandblast_pakai ? Math.round(it.sandblast_tepi_cm * 10) : undefined,
      },
      qty: it.qty,
    }));

    return {
      items: formattedItems,
      zona,
      perlu_pasang: perluPasang,
      ongkir_deal: effectiveOngkirDeal,
      pasang_deal: effectivePasangDeal,
      segmen,
      user_role: userRole,
      throw_on_item_error: false, // Jangan pernah throw untuk UI
      konfirmasi_owner: {
        ongkir: {
          sudah_dikonfirmasi: ongkirKonfirmasiOwner,
          alasan: ongkirAlasan,
        },
        pasang: {
          sudah_dikonfirmasi: pasangKonfirmasiOwner,
          alasan: pasangAlasan,
        },
      },
    };
  }, [
    items,
    zona,
    perluPasang,
    effectiveOngkirDeal,
    effectivePasangDeal,
    ongkirKonfirmasiOwner,
    ongkirAlasan,
    pasangKonfirmasiOwner,
    pasangAlasan,
    segmen,
    userRole,
  ]);

  // Kalkulasi Real-Time: TIDAK BOLEH THROW, Total selalu tampil
  const kalkulasi = useMemo(() => {
    try {
      return hitungPenawaran(penawaranInput, config);
    } catch (err: unknown) {
      console.error('Kalkulasi error fallback:', err);
      return null;
    }
  }, [penawaranInput, config]);

  // Handlers input rupiah ongkir (Validasi saat Blur)
  const handleOngkirBlur = () => {
    setIsOngkirFocused(false);
    if (!ongkirInputText.trim()) {
      setOngkirDealVal(undefined); // Kembali ke default list
    } else {
      const parsed = parseRupiah(ongkirInputText, ongkirListPrice);
      setOngkirDealVal(parsed);
    }
  };

  const handleOngkirFocus = () => {
    setIsOngkirFocused(true);
    setOngkirInputText(effectiveOngkirDeal.toString());
  };

  // Handlers input rupiah pasang (Validasi saat Blur)
  const handlePasangBlur = () => {
    setIsPasangFocused(false);
    if (!pasangInputText.trim()) {
      setPasangDealVal(undefined); // Kembali ke default list
    } else {
      const parsed = parseRupiah(pasangInputText, pasangListPrice);
      setPasangDealVal(parsed);
    }
  };

  const handlePasangFocus = () => {
    setIsPasangFocused(true);
    setPasangInputText(effectivePasangDeal.toString());
  };

  // Handler Items
  const updateItem = (index: number, updates: Partial<LocalItemState>) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        bentuk_kode: 'rectangle',
        panjang_cm: 60,
        lebar_cm: 40,
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

  // Unduh PDF (Hanya aktif jika kalkulasi valid untuk PDF)
  const isPdfDownloadEnabled = Boolean(kalkulasi && kalkulasi.is_valid_untuk_pdf && !isGeneratingPdf);

  const handleSimpanPenawaran = async (isUnduh: boolean) => {
    if (!kalkulasi || !isPdfDownloadEnabled) return;
    if (isUnduh) setIsGeneratingPdf(true);
    else setIsSavingDraft(true);
    setSaveSuccessMsg(null);

    try {
      const res = await fetch('/api/penawaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: '00000000-0000-0000-0000-000000000001',
          nama_klien: namaKlien.trim() || 'Klien Putra Glass',
          kota_klien: kotaKlien.trim() || 'Surabaya',
          kanal: 'whatsapp',
          is_unduh_pdf: isUnduh,
          penawaran_input: penawaranInput,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(`Gagal menyimpan: ${json.error || 'Terjadi kesalahan'}`);
        return;
      }

      if (isUnduh) {
        const doc = (
          <PenawaranDocument
            nomor={json.penawaran?.nomor || nomorPenawaran}
            tanggal={new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            berlakuSampai={new Date(Date.now() + 7 * 86400000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            namaKlien={namaKlien.trim() || 'Klien Putra Glass'}
            kotaKlien={kotaKlien.trim() || 'Bandung'}
            kalkulasi={kalkulasi}
            config={config}
          />
        );
        const asPdf = pdf(doc);
        const blob = await asPdf.toBlob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${json.penawaran?.nomor || nomorPenawaran}_${(namaKlien.trim() || 'Klien').replace(/\s+/g, '_')}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
        setSaveSuccessMsg(`Penawaran ${json.penawaran?.nomor} berhasil disimpan dengan status 'terkirim'!`);
      } else {
        setSaveSuccessMsg(`Penawaran ${json.penawaran?.nomor} berhasil disimpan sebagai 'draf'!`);
      }
    } catch (e) {
      console.error('Error saving:', e);
      alert('Terjadi kesalahan saat menyimpan');
    } finally {
      setIsGeneratingPdf(false);
      setIsSavingDraft(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Top Bar Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b border-[#E3E7EE]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#253254]">Kalkulator Penawaran</h1>
            <span className="text-xs bg-[#253254] text-white px-2 py-0.5 rounded font-mono">
              {nomorPenawaran}
            </span>
            <span className="text-xs bg-[#BFCBD9] text-[#253254] px-2 py-0.5 rounded font-medium">
              Buku Harga v{config.versi} (Live)
            </span>
          </div>
          <p className="text-sm text-[#6B7385] mt-1">
            Penghitungan instan &amp; penawaran PDF resmi Putra Glass
          </p>
        </div>

        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <button
            id="btn-simpan-penawaran"
            onClick={() => handleSimpanPenawaran(false)}
            disabled={!isPdfDownloadEnabled || isSavingDraft || userRole === 'owner'}
            className="flex items-center gap-1.5 bg-white border border-[#BFCBD9] hover:bg-[#F2F5F9] text-[#253254] font-medium text-xs px-3.5 py-2 rounded shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <FileText className="w-4 h-4 text-[#275087]" />
            {isSavingDraft ? 'Menyimpan...' : 'Simpan Penawaran (Draf)'}
          </button>

          <button
            id="btn-download-pdf"
            onClick={() => handleSimpanPenawaran(true)}
            disabled={!isPdfDownloadEnabled || isGeneratingPdf || userRole === 'owner'}
            className="flex items-center gap-2 bg-[#253254] hover:bg-[#1f2845] text-white font-medium text-xs px-4 py-2 rounded shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {isGeneratingPdf ? 'Membuat PDF...' : 'Unduh Penawaran PDF'}
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-300 rounded text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Kolom Kiri: Form Input Item (7 / 12) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Data Klien & Pengiriman */}
          <div className="bg-white p-5 rounded-lg border border-[#E3E7EE] shadow-sm">
            <h2 className="text-xs font-bold text-[#253254] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-[#275087]" /> Informasi Klien &amp; Tujuan
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B7385] mb-1">
                  Nama Klien
                </label>
                <input
                  id="input-nama-klien"
                  type="text"
                  value={namaKlien}
                  onChange={(e) => setNamaKlien(e.target.value)}
                  placeholder="contoh: Kak Rina"
                  className="w-full text-sm px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9] placeholder:text-[#98A0B0] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#275087]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7385] mb-1">
                  Kota Tujuan
                </label>
                <input
                  type="text"
                  value={kotaKlien}
                  onChange={(e) => setKotaKlien(e.target.value)}
                  placeholder="contoh: Surabaya"
                  className="w-full text-sm px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#275087]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7385] mb-1">
                  Zona Pengiriman
                </label>
                <select
                  value={zona}
                  onChange={(e) => {
                    const newZona = e.target.value as 'dalam_kota' | 'luar_kota';
                    setZona(newZona);
                    setOngkirDealVal(undefined); // Reset ke list zona baru
                  }}
                  className="w-full text-sm px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9] focus:bg-white"
                >
                  <option value="luar_kota">Luar Kota (Packing Kayu - List: Rp1.300.000)</option>
                  <option value="dalam_kota">Bandung Raya (List: Rp750.000)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7385] mb-1">
                  Segmen Klien
                </label>
                <select
                  value={segmen}
                  onChange={(e) => setSegmen(e.target.value as 'B2C' | 'B2B')}
                  className="w-full text-sm px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9] focus:bg-white"
                >
                  <option value="B2C">B2C (Retail)</option>
                  <option value="B2B">B2B (Proyek / Desainer)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Daftar Item Cermin */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#253254] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#275087]" /> Rincian Cermin ({items.length})
              </h2>
              <button
                onClick={addItem}
                className="flex items-center gap-1.5 text-xs bg-[#253254] text-white px-3 py-1.5 rounded hover:bg-[#1f2845] transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Cermin
              </button>
            </div>

            {items.map((item, idx) => {
              const currentShape = config.master_bentuk.find((b) => b.kode === item.bentuk_kode);
              const bolehAluminium = Boolean(currentShape?.boleh_aluminium);
              const calculatedItem = kalkulasi?.items[idx];
              const itemErrors = calculatedItem?.errors || [];

              return (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-lg border border-[#E3E7EE] shadow-sm relative space-y-4"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-[#F2F5F9]">
                    <span className="font-bold text-sm text-[#253254]">
                      Cermin #{idx + 1}
                    </span>
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Bentuk */}
                    <div>
                      <label className="block text-xs font-semibold text-[#6B7385] mb-1">
                        Bentuk Cermin
                      </label>
                      <select
                        value={item.bentuk_kode}
                        onChange={(e) => {
                          const newKode = e.target.value;
                          const shapeDef = config.master_bentuk.find((b) => b.kode === newKode);
                          updateItem(idx, {
                            bentuk_kode: newKode,
                            frame:
                              item.frame === 'aluminium' && !shapeDef?.boleh_aluminium
                                ? 'tanpa'
                                : item.frame,
                          });
                        }}
                        className="w-full text-sm px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9]"
                      >
                        {config.master_bentuk.map((b) => (
                          <option key={b.kode} value={b.kode}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Dimensi */}
                    <div>
                      <label className="block text-xs font-semibold text-[#6B7385] mb-1">
                        Panjang (cm)
                      </label>
                      <input
                        type="number"
                        min="15"
                        max="300"
                        value={item.panjang_cm}
                        onChange={(e) =>
                          updateItem(idx, { panjang_cm: Number(e.target.value) })
                        }
                        className="w-full text-sm px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#6B7385] mb-1">
                        Lebar (cm)
                      </label>
                      <input
                        type="number"
                        min="15"
                        max="300"
                        value={item.lebar_cm}
                        onChange={(e) =>
                          updateItem(idx, { lebar_cm: Number(e.target.value) })
                        }
                        className="w-full text-sm px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9]"
                      />
                    </div>
                  </div>

                  {/* Varian, Lampu, Kontrol, Frame */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#6B7385] mb-1">
                        Lampu LED
                      </label>
                      <select
                        value={item.lampu}
                        onChange={(e) =>
                          updateItem(idx, { lampu: e.target.value as '3_warna' | '1_warna' })
                        }
                        className="w-full text-sm px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9]"
                      >
                        <option value="3_warna">LED 3 Warna (Premium)</option>
                        <option value="1_warna">LED 1 Warna (Varian Basic)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#6B7385] mb-1">
                        Jenis Kontrol
                      </label>
                      <select
                        value={item.kontrol}
                        onChange={(e) =>
                          updateItem(idx, {
                            kontrol: e.target.value as LocalItemState['kontrol'],
                          })
                        }
                        className="w-full text-sm px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9]"
                      >
                        <option value="touchscreen">Touchscreen Kabel (Default)</option>
                        <option value="touchscreen_baterai">Touchscreen + Baterai (+150k)</option>
                        <option value="sensor">Sensor Tangan (+100k)</option>
                        <option value="sensor_baterai">Sensor Tangan + Baterai (+250k)</option>
                        <option value="saklar">Saklar Biasa (Varian Basic)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#6B7385] mb-1">
                        Frame Luar
                      </label>
                      <select
                        value={item.frame}
                        onChange={(e) =>
                          updateItem(idx, { frame: e.target.value as LocalItemState['frame'] })
                        }
                        className="w-full text-sm px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9]"
                      >
                        <option value="tanpa">Tanpa Frame (Frameless Bevel)</option>
                        <option value="hpl">Frame HPL (+200k)</option>
                        <option
                          value="aluminium"
                          disabled={!bolehAluminium}
                          className={!bolehAluminium ? 'text-gray-400 bg-gray-100' : ''}
                        >
                          Frame Aluminium (+400k) {!bolehAluminium ? '(Hanya Persegi)' : ''}
                        </option>
                      </select>
                      {!bolehAluminium && item.frame === 'aluminium' && (
                        <p className="text-[10px] text-red-600 mt-1 font-medium">
                          Aluminium hanya untuk bentuk persegi siku.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Add-ons & Sandblast */}
                  <div className="pt-3 border-t border-[#F2F5F9] flex flex-wrap items-center gap-6">
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.antifog}
                        onChange={(e) => updateItem(idx, { antifog: e.target.checked })}
                        className="rounded text-[#253254]"
                      />
                      Antifog Pad (+Rp200.000)
                    </label>

                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.sandblast_pakai}
                        onChange={(e) =>
                          updateItem(idx, { sandblast_pakai: e.target.checked })
                        }
                        className="rounded text-[#253254]"
                      />
                      Garis Sandblast
                    </label>

                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs font-semibold text-[#6B7385]">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) =>
                          updateItem(idx, { qty: Math.max(1, Number(e.target.value)) })
                        }
                        className="w-16 text-center text-sm px-2 py-1 border border-[#E3E7EE] rounded bg-[#F2F5F9]"
                      />
                    </div>
                  </div>

                  {/* Error spesifik item jika ada */}
                  {itemErrors.length > 0 && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                      {itemErrors.map((err, eIdx) => (
                        <p key={eIdx}>• {err}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Kolom Kanan: Ringkasan Harga & Nego Deals (5 / 12 Sticky) */}
        <div className="lg:col-span-5 sticky top-6 space-y-4">
          {kalkulasi && (
            <div className="bg-white rounded-lg border border-[#E3E7EE] shadow-sm p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-[#E3E7EE] pb-3">
                <h3 className="font-bold text-[#253254] text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E3A857]" /> Ringkasan Penawaran
                </h3>
                <span className="text-xs text-[#6B7385]">
                  Total {kalkulasi.total_unit} unit
                </span>
              </div>

              {/* Breakdown Per Item */}
              <div className="space-y-2.5">
                {kalkulasi.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#F2F5F9] rounded border border-[#E3E7EE] text-xs space-y-1"
                  >
                    <div className="flex justify-between items-start font-semibold text-[#253254]">
                      <span>
                        Cermin #{idx + 1} ({it.panjang_mm / 10} × {it.lebar_mm / 10} cm)
                      </span>
                      <span className="font-mono">
                        {formatRupiah(it.subtotal_item)}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#6B7385] flex justify-between">
                      <span>
                        {it.is_sku ? (
                          <span className="text-emerald-700 font-medium">SKU: {it.sku_kode}</span>
                        ) : (
                          `Custom (${it.luas_m2_display} m² @ ${formatRupiah(it.tarif_m2_dipakai)})`
                        )}
                      </span>
                      <span>
                        {it.qty > 1 ? `@ ${formatRupiah(it.harga_satuan_item)} × ${it.qty}` : ''}
                      </span>
                    </div>

                    {it.add_on_breakdown.length > 0 && (
                      <div className="text-[10px] text-[#6B7385] pt-1 border-t border-[#E3E7EE]">
                        Add-on: {it.add_on_breakdown.map((a) => `${a.label} (+${formatRupiah(a.total)})`).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Biaya Pengiriman & Pemasangan */}
              <div className="space-y-4 pt-3 border-t border-[#E3E7EE]">
                {/* 1. INPUT ONGKIR DEAL */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-semibold text-[#6B7385] flex items-center gap-1">
                      <Lock className="w-3 h-3 text-[#253254]" /> Ongkir Deal (List: {formatRupiah(ongkirListPrice)}):
                    </span>
                    <span className="font-mono font-semibold">
                      {formatRupiah(kalkulasi.ongkir.deal)}
                    </span>
                  </div>

                  <input
                    id="input-ongkir-deal"
                    type="text"
                    value={isOngkirFocused ? ongkirInputText : formatRupiah(kalkulasi.ongkir.deal)}
                    onFocus={handleOngkirFocus}
                    onBlur={handleOngkirBlur}
                    onChange={(e) => setOngkirInputText(e.target.value)}
                    placeholder={`Default: ${formatRupiah(ongkirListPrice)}`}
                    className="w-full text-xs px-3 py-1.5 border border-[#E3E7EE] rounded bg-[#F2F5F9] focus:bg-white focus:outline-none"
                  />
                  <div className="text-[10px] text-[#6B7385] mt-0.5">
                    Batas Admin: {formatRupiah(batasOngkirAdmin)} • Batas Owner: {formatRupiah(batasOngkirOwner)}
                  </div>

                  {/* KONDISI PERINGATAN ONGKIR */}
                  {/* KONDISI A: MERAH (< batas_owner) */}
                  {kalkulasi.ongkir.status === 'error_merah' && (
                    <div
                      id="box-ongkir-merah"
                      className="mt-2 p-3 bg-red-50 border border-red-300 rounded text-xs text-red-800 space-y-2"
                    >
                      <div className="flex items-start gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">
                            Minimal {formatRupiah(batasOngkirOwner)} (ongkir maks. dibagi 2)
                          </p>
                          <p className="text-[11px] mt-0.5">
                            Ongkir tidak dapat dinego di bawah 50% harga list.
                          </p>
                        </div>
                      </div>
                      <div>
                        <button
                          type="button"
                          id="btn-pakai-ongkir-min"
                          onClick={() => {
                            setOngkirDealVal(batasOngkirOwner);
                            setOngkirInputText(batasOngkirOwner.toString());
                          }}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold cursor-pointer transition shadow-sm"
                        >
                          Pakai {formatRupiah(batasOngkirOwner)}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* KONDISI B: DI BAWAH BATAS ADMIN (Input & Checkbox SELALU TAMPIL, Berubah Hijau Saat Sah) */}
                  {kalkulasi.ongkir.deal < batasOngkirAdmin && kalkulasi.ongkir.status !== 'error_merah' && (
                    <div
                      id="box-ongkir-kuning"
                      className={`mt-2 p-3 rounded text-xs border space-y-2.5 transition-colors ${
                        kalkulasi.ongkir.dikonfirmasi_owner
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                          : 'bg-amber-50 border-amber-300 text-amber-950'
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        {kalkulasi.ongkir.dikonfirmasi_owner ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-bold">
                            {kalkulasi.ongkir.dikonfirmasi_owner
                              ? 'Potongan Ongkir Dikonfirmasi Owner (Sah)'
                              : 'Di bawah batas admin. Konfirmasi owner?'}
                          </p>
                          <p className="text-[11px] opacity-80 mt-0.5">
                            {kalkulasi.ongkir.dikonfirmasi_owner
                              ? 'Potongan sah. Tombol unduh PDF aktif.'
                              : 'Centang konfirmasi dan isi alasan agar penawaran sah.'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-current/20 space-y-2">
                        <label className="flex items-center gap-2 font-bold cursor-pointer">
                          <input
                            id="checkbox-konfirmasi-ongkir"
                            type="checkbox"
                            checked={ongkirKonfirmasiOwner}
                            onChange={(e) => setOngkirKonfirmasiOwner(e.target.checked)}
                            className="rounded text-emerald-700"
                          />
                          Sudah dikonfirmasi owner
                        </label>

                        <div>
                          <label className="block text-[11px] font-semibold mb-0.5">
                            Alasan konfirmasi (wajib):
                          </label>
                          <input
                            id="input-alasan-ongkir"
                            type="text"
                            required
                            placeholder="Misal: Klien komitmen DP hari ini"
                            value={ongkirAlasan}
                            onChange={(e) => setOngkirAlasan(e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 bg-white border border-current/30 rounded focus:outline-none focus:ring-1 focus:ring-current text-[#1B2233]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. INPUT PASANG DEAL */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <label className="flex items-center gap-1.5 font-semibold text-[#6B7385] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={perluPasang}
                        onChange={(e) => setPerluPasang(e.target.checked)}
                        className="rounded"
                      />
                      Perlu Pemasangan
                    </label>
                    {perluPasang && (
                      <span className="font-mono font-semibold">
                        {formatRupiah(kalkulasi.pasang.deal)}
                      </span>
                    )}
                  </div>

                  {perluPasang && (
                    <>
                      <input
                        id="input-pasang-deal"
                        type="text"
                        value={isPasangFocused ? pasangInputText : formatRupiah(kalkulasi.pasang.deal)}
                        onFocus={handlePasangFocus}
                        onBlur={handlePasangBlur}
                        onChange={(e) => setPasangInputText(e.target.value)}
                        placeholder={`Default: ${formatRupiah(pasangListPrice)}`}
                        className="w-full text-xs px-3 py-1.5 border border-[#E3E7EE] rounded bg-[#F2F5F9] focus:bg-white focus:outline-none"
                      />
                      <div className="text-[10px] text-[#6B7385] mt-0.5">
                        Batas Admin: {formatRupiah(batasPasangAdmin)} • Batas Owner: {formatRupiah(batasPasangOwner)}
                      </div>

                      {/* Pasang Merah */}
                      {kalkulasi.pasang.status === 'error_merah' && (
                        <div
                          id="box-pasang-merah"
                          className="mt-2 p-3 bg-red-50 border border-red-300 rounded text-xs text-red-800 space-y-2"
                        >
                          <div className="flex items-start gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">
                                Minimal {formatRupiah(batasPasangOwner)}
                              </p>
                              <p className="text-[11px] mt-0.5">
                                Jasa pasang tidak dapat dinego di bawah batas owner.
                              </p>
                            </div>
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                setPasangDealVal(batasPasangOwner);
                                setPasangInputText(batasPasangOwner.toString());
                              }}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold cursor-pointer"
                            >
                              Pakai {formatRupiah(batasPasangOwner)}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* PASANG: DI BAWAH BATAS ADMIN (Input & Checkbox SELALU TAMPIL, Berubah Hijau Saat Sah) */}
                      {kalkulasi.pasang.deal < batasPasangAdmin && kalkulasi.pasang.status !== 'error_merah' && (
                        <div
                          id="box-pasang-kuning"
                          className={`mt-2 p-3 rounded text-xs border space-y-2.5 transition-colors ${
                            kalkulasi.pasang.dikonfirmasi_owner
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                              : 'bg-amber-50 border-amber-300 text-amber-950'
                          }`}
                        >
                          <div className="flex items-start gap-1.5">
                            {kalkulasi.pasang.dikonfirmasi_owner ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <p className="font-bold">
                                {kalkulasi.pasang.dikonfirmasi_owner
                                  ? 'Potongan Pemasangan Dikonfirmasi Owner (Sah)'
                                  : 'Di bawah batas admin. Konfirmasi owner?'}
                              </p>
                              <p className="text-[11px] opacity-80 mt-0.5">
                                {kalkulasi.pasang.dikonfirmasi_owner
                                  ? 'Potongan sah. Tombol unduh PDF aktif.'
                                  : 'Centang konfirmasi dan isi alasan agar penawaran sah.'}
                              </p>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-current/20 space-y-2">
                            <label className="flex items-center gap-2 font-bold cursor-pointer">
                              <input
                                id="checkbox-konfirmasi-pasang"
                                type="checkbox"
                                checked={pasangKonfirmasiOwner}
                                onChange={(e) => setPasangKonfirmasiOwner(e.target.checked)}
                                className="rounded text-emerald-700"
                              />
                              Sudah dikonfirmasi owner
                            </label>

                            <div>
                              <label className="block text-[11px] font-semibold mb-0.5">
                                Alasan konfirmasi (wajib):
                              </label>
                              <input
                                id="input-alasan-pasang"
                                type="text"
                                required
                                placeholder="Misal: Pasang paket 2 unit..."
                                value={pasangAlasan}
                                onChange={(e) => setPasangAlasan(e.target.value)}
                                className="w-full text-xs px-2.5 py-1.5 bg-white border border-current/30 rounded focus:outline-none focus:ring-1 focus:ring-current text-[#1B2233]"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Total & DP Final (SELALU TAMPIL) */}
              <div className="pt-4 border-t-2 border-[#253254] space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-[#253254]">TOTAL PENAWARAN:</span>
                  <span id="label-total-penawaran" className="text-2xl font-bold font-mono text-[#253254]">
                    {formatRupiah(kalkulasi.total)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-[#253254] text-white rounded">
                    <span className="block text-[10px] font-bold text-[#BFCBD9]">DP 50%</span>
                    <span className="text-base font-bold font-mono">
                      {formatRupiah(kalkulasi.dp_50)}
                    </span>
                    <span className="block text-[9px] text-[#BFCBD9]">untuk mulai produksi</span>
                  </div>

                  <div className="p-3 bg-[#F2F5F9] border border-[#E3E7EE] rounded">
                    <span className="block text-[10px] font-bold text-[#98A0B0]">PELUNASAN</span>
                    <span className="text-base font-bold font-mono text-[#253254]">
                      {formatRupiah(kalkulasi.pelunasan)}
                    </span>
                    <span className="block text-[9px] text-[#6B7385]">sebelum barang dikirim</span>
                  </div>
                </div>

                <div className="text-[11px] text-[#6B7385] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Garansi 7 hari pecah/tidak sesuai · fungsi LED &amp; touchscreen 3 bulan</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
