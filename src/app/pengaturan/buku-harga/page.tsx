'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PriceBookData } from '@/types/pricing';
import { CompanySettings, DEFAULT_SETTINGS } from '@/types/settings';
import {
  Settings as SettingsIcon,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  MapPin,
  CreditCard,
  Phone,
  Share2,
} from 'lucide-react';

interface PotonganLogItem {
  id: string;
  aktor: string;
  aksi: string;
  objek: string;
  sebelum?: { nilai_list?: number };
  sesudah?: { nilai_deal?: number };
  alasan: string;
  created_at: string;
  users?: { nama: string; email: string };
}

export default function PengaturanBukuHargaPage() {
  const router = useRouter();
  const [priceBook, setPriceBook] = useState<PriceBookData | null>(null);
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [userRole, setUserRole] = useState<'owner' | 'admin'>('admin');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [catatanPerubahan, setCatatanPerubahan] = useState(
    'Pembaruan data workshop, rekening, dan kontak resmi'
  );
  const [potonganMingguIni, setPotonganMingguIni] = useState<PotonganLogItem[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [resBook, resSettings] = await Promise.all([
          fetch('/api/buku-harga'),
          fetch('/api/settings'),
        ]);

        const jsonBook = await resBook.json();
        if (jsonBook.price_book) {
          setPriceBook(jsonBook.price_book);
          setUserRole(jsonBook.role || 'admin');
          if (jsonBook.potongan_minggu_ini) {
            setPotonganMingguIni(jsonBook.potongan_minggu_ini);
          }
        }

        const jsonSettings = await resSettings.json();
        if (jsonSettings.settings) {
          setSettings(jsonSettings.settings);
        }
      } catch (e) {
        console.error('Gagal mengambil data pengaturan:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSaveSuccess(false);

    // 1. Validasi Client-Side
    if (!settings.maps_url.trim().startsWith('https://')) {
      setErrorMessage('Link Google Maps (maps_url) harus diawali dengan https://');
      return;
    }

    const cleanNoRek = settings.no_rekening.replace(/\s/g, '');
    if (!/^\d+$/.test(cleanNoRek)) {
      setErrorMessage('Nomor rekening hanya boleh berisi angka tanpa huruf/simbol');
      return;
    }

    const trimmedWa = settings.whatsapp.trim();
    if (!trimmedWa.startsWith('+62')) {
      setErrorMessage('Nomor WhatsApp harus berawalan +62 (contoh: +62 812-3753-3173)');
      return;
    }

    setIsSaving(true);

    try {
      // 1. Simpan Settings Kontak & Workshop
      const resSettings = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          no_rekening: cleanNoRek,
          catatan_perubahan: catatanPerubahan,
        }),
      });

      const jsonSettings = await resSettings.json();
      if (!resSettings.ok) {
        throw new Error(jsonSettings.error || 'Gagal menyimpan data kontak');
      }

      // 2. Simpan & Sinkronkan Buku Harga jika ada
      if (priceBook) {
        const syncedBook: PriceBookData = {
          ...priceBook,
          dokumen_pdf: {
            ...priceBook.dokumen_pdf,
            bank_nama: settings.bank,
            bank_nomor: cleanNoRek,
            bank_atas_nama: settings.nama_rekening,
            kontak_wa_resmi: trimmedWa,
            instagram_handle: `@${settings.instagram.replace(/^@/, '')}`,
          },
        };

        const resBook = await fetch('/api/buku-harga', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data_json: syncedBook,
            aktifkan_sekarang: true,
            catatan_perubahan: catatanPerubahan,
          }),
        });

        const jsonBook = await resBook.json();
        if (!resBook.ok) {
          throw new Error(jsonBook.error || 'Gagal menyimpan buku harga');
        }

        if (jsonBook.price_book?.data_json) {
          setPriceBook(jsonBook.price_book.data_json);
        }
      }

      setSettings(jsonSettings.settings);
      setSaveSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-16 text-muted text-sm">Memuat pengaturan...</div>;
  }

  // Jika owner: tampilkan banner informasi bahwa owner mode pemantauan saja
  const isReadOnly = userRole === 'owner';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-[30px] font-extrabold text-ink leading-tight flex items-center gap-3">
            <SettingsIcon className="w-7 h-7 text-accent" />
            <span>Pengaturan &amp; Kontak Resmi</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Data kontak workshop, QR lokasi, rekening bank, dan parameter dokumen penawaran PDF
          </p>
        </div>

        <span className="text-xs px-3 py-1.5 bg-surface border border-line rounded-xl text-ink font-semibold self-start sm:self-auto">
          {isReadOnly ? 'Mode Owner (Baca Saja)' : 'Akses Admin (Bisa Edit)'}
        </span>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-ok-bg border border-ok/30 text-ok text-sm rounded-[18px] flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-ok shrink-0" />
          <span>
            Perubahan data kontak, workshop, dan buku harga berhasil disimpan dan dicatat di audit log!
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-warn-bg border border-warn/30 text-warn text-sm rounded-[18px] flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-warn shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. BAGIAN DATA WORKSHOP & LOKASI MAPS */}
        <div className="bg-surface p-6 rounded-[20px] border border-line shadow-none space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <MapPin className="w-5 h-5 text-accent" />
            <h2 className="text-[17px] font-bold text-ink">
              1. Lokasi Workshop &amp; QR Maps
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Alamat Lengkap Workshop
              </label>
              <textarea
                required
                disabled={isReadOnly}
                rows={2}
                value={settings.alamat_workshop}
                onChange={(e) =>
                  setSettings({ ...settings, alamat_workshop: e.target.value })
                }
                className="w-full text-sm px-3.5 py-2.5 border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent disabled:opacity-75 resize-none"
              />
              <p className="text-[11px] text-muted mt-1">
                Dicetak pada pita bawah PDF penawaran dan digunakan sebagai referensi AI saat menjawab pertanyaan lokasi.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Link Google Maps (Harus diawali https://)
              </label>
              <input
                type="url"
                required
                disabled={isReadOnly}
                value={settings.maps_url}
                onChange={(e) =>
                  setSettings({ ...settings, maps_url: e.target.value })
                }
                placeholder="https://maps.app.goo.gl/..."
                className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent tabular-nums disabled:opacity-75"
              />
              <p className="text-[11px] text-muted mt-1">
                Link ini akan dikonversi menjadi QR Code berukuran 23 mm di server dan dibungkus link aktif pada PDF.
              </p>
            </div>
          </div>
        </div>

        {/* 2. BAGIAN REKENING BANK RESMI */}
        <div className="bg-surface p-6 rounded-[20px] border border-line shadow-none space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <CreditCard className="w-5 h-5 text-accent" />
            <h2 className="text-[17px] font-bold text-ink">
              2. Rekening Pembayaran Resmi
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Nama Bank
              </label>
              <input
                type="text"
                required
                disabled={isReadOnly}
                value={settings.bank}
                onChange={(e) => setSettings({ ...settings, bank: e.target.value })}
                className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent disabled:opacity-75"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Nomor Rekening (Hanya Angka)
              </label>
              <input
                type="text"
                required
                disabled={isReadOnly}
                value={settings.no_rekening}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    no_rekening: e.target.value.replace(/\D/g, ''),
                  })
                }
                className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent tabular-nums disabled:opacity-75"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Atas Nama Rekening
              </label>
              <input
                type="text"
                required
                disabled={isReadOnly}
                value={settings.nama_rekening}
                onChange={(e) =>
                  setSettings({ ...settings, nama_rekening: e.target.value })
                }
                className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent disabled:opacity-75"
              />
            </div>
          </div>
        </div>

        {/* 3. BAGIAN KONTAK & MEDIA SOSIAL */}
        <div className="bg-surface p-6 rounded-[20px] border border-line shadow-none space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <Phone className="w-5 h-5 text-accent" />
            <h2 className="text-[17px] font-bold text-ink">
              3. Kontak WhatsApp &amp; Media Sosial
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                WhatsApp Resmi (+62 ...)
              </label>
              <input
                type="text"
                required
                disabled={isReadOnly}
                value={settings.whatsapp}
                onChange={(e) =>
                  setSettings({ ...settings, whatsapp: e.target.value })
                }
                placeholder="+62 812-3753-3173"
                className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent tabular-nums disabled:opacity-75"
              />
              <p className="text-[11px] text-muted mt-1">
                Link wa.me dibentuk otomatis dari nomor ini.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Instagram Handle
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-muted text-sm">@</span>
                <input
                  type="text"
                  required
                  disabled={isReadOnly}
                  value={settings.instagram}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      instagram: e.target.value.replace(/^@/, ''),
                    })
                  }
                  placeholder="putraglass.id"
                  className="w-full text-sm pl-8 pr-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent disabled:opacity-75"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                TikTok Handle
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-muted text-sm">@</span>
                <input
                  type="text"
                  required
                  disabled={isReadOnly}
                  value={settings.tiktok}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      tiktok: e.target.value.replace(/^@/, ''),
                    })
                  }
                  placeholder="putraglass_"
                  className="w-full text-sm pl-8 pr-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent disabled:opacity-75"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 4. PARAMETER LOGISTIK RESMI */}
        {priceBook && (
          <div className="bg-surface p-6 rounded-[20px] border border-line shadow-none space-y-4">
            <h2 className="text-[17px] font-bold text-ink border-b border-line pb-3">
              4. Tarif Pengiriman &amp; Pemasangan Resmi
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-raised rounded-xl border border-line space-y-3">
                <span className="font-bold text-sm text-ink block">
                  Luar Kota (Packing Kayu)
                </span>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Harga List (Rp)
                  </label>
                  <input
                    type="number"
                    disabled={isReadOnly}
                    value={priceBook.logistik?.kirim_luar_kota?.list || 1300000}
                    onChange={(e) =>
                      setPriceBook({
                        ...priceBook,
                        logistik: {
                          ...priceBook.logistik,
                          kirim_luar_kota: {
                            ...priceBook.logistik?.kirim_luar_kota,
                            list: Number(e.target.value),
                            batas_admin:
                              priceBook.logistik?.kirim_luar_kota?.batas_admin || 1150000,
                            skema_50_aktif: true,
                          },
                        },
                      })
                    }
                    className="w-full text-sm px-3 py-2 border border-line rounded-lg bg-surface text-ink tabular-nums disabled:opacity-75"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Harga Net Admin (Rp)
                  </label>
                  <input
                    type="number"
                    disabled={isReadOnly}
                    value={priceBook.logistik?.kirim_luar_kota?.batas_admin || 1150000}
                    onChange={(e) =>
                      setPriceBook({
                        ...priceBook,
                        logistik: {
                          ...priceBook.logistik,
                          kirim_luar_kota: {
                            ...priceBook.logistik?.kirim_luar_kota,
                            list: priceBook.logistik?.kirim_luar_kota?.list || 1300000,
                            batas_admin: Number(e.target.value),
                            skema_50_aktif: true,
                          },
                        },
                      })
                    }
                    className="w-full text-sm px-3 py-2 border border-line rounded-lg bg-surface text-ink tabular-nums disabled:opacity-75"
                  />
                </div>
                <p className="text-[11px] text-muted">LUAR KOTA = 1.300.000 NET DI 1.150.000</p>
              </div>

              <div className="p-4 bg-raised rounded-xl border border-line space-y-3">
                <span className="font-bold text-sm text-ink block">
                  Dalam Kota (Bandung Raya &amp; Cimahi)
                </span>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Harga List (Rp)
                  </label>
                  <input
                    type="number"
                    disabled={isReadOnly}
                    value={priceBook.logistik?.kirim_bandung?.list || 750000}
                    onChange={(e) =>
                      setPriceBook({
                        ...priceBook,
                        logistik: {
                          ...priceBook.logistik,
                          kirim_bandung: {
                            ...priceBook.logistik?.kirim_bandung,
                            list: Number(e.target.value),
                            batas_admin:
                              priceBook.logistik?.kirim_bandung?.batas_admin || 500000,
                          },
                        },
                      })
                    }
                    className="w-full text-sm px-3 py-2 border border-line rounded-lg bg-surface text-ink tabular-nums disabled:opacity-75"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Harga Net Admin (Rp)
                  </label>
                  <input
                    type="number"
                    disabled={isReadOnly}
                    value={priceBook.logistik?.kirim_bandung?.batas_admin || 500000}
                    onChange={(e) =>
                      setPriceBook({
                        ...priceBook,
                        logistik: {
                          ...priceBook.logistik,
                          kirim_bandung: {
                            ...priceBook.logistik?.kirim_bandung,
                            list: priceBook.logistik?.kirim_bandung?.list || 750000,
                            batas_admin: Number(e.target.value),
                          },
                        },
                      })
                    }
                    className="w-full text-sm px-3 py-2 border border-line rounded-lg bg-surface text-ink tabular-nums disabled:opacity-75"
                  />
                </div>
                <p className="text-[11px] text-muted">DALAM KOTA = 750.000 NET DI 500 AJA</p>
              </div>
            </div>
          </div>
        )}

        {/* 5. Catatan Perubahan & Tombol Simpan */}
        {!isReadOnly && (
          <div className="bg-surface p-6 rounded-[20px] border border-line shadow-none space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Catatan Perubahan (Tercatat di Audit Log)
              </label>
              <input
                type="text"
                required
                value={catatanPerubahan}
                onChange={(e) => setCatatanPerubahan(e.target.value)}
                placeholder="Alasan perubahan data..."
                className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="min-h-[44px] px-6 py-2.5 bg-accent text-accent-ink font-bold text-sm rounded-xl flex items-center gap-2 hover:opacity-95 disabled:opacity-50 transition cursor-pointer shadow-none"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Simpan Pengaturan &amp; Aktifkan</span>
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
