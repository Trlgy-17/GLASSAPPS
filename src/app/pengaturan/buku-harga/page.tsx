'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PriceBookData } from '@/types/pricing';
import { Settings, Save, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react';

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
  const [userRole, setUserRole] = useState<'owner' | 'admin'>('admin');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [catatanPerubahan, setCatatanPerubahan] = useState('Pembaruan data rekening, kontak WA, dan admin resmi');
  const [potonganMingguIni, setPotonganMingguIni] = useState<PotonganLogItem[]>([]);

  useEffect(() => {
    async function fetchBook() {
      try {
        const res = await fetch('/api/buku-harga');
        const json = await res.json();
        if (json.price_book) {
          setPriceBook(json.price_book);
          setUserRole(json.role || 'admin');
          if (json.potongan_minggu_ini) {
            setPotonganMingguIni(json.potongan_minggu_ini);
          }
        }
      } catch (e) {
        console.error('Gagal mengambil buku harga:', e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchBook();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceBook) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/buku-harga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_json: priceBook,
          aktifkan_sekarang: true,
          catatan_perubahan: catatanPerubahan,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        const json = await res.json();
        if (json.price_book) {
          setPriceBook(json.price_book.data_json);
        }
      } else {
        const json = await res.json();
        alert(`Gagal menyimpan: ${json.error || 'Terjadi kesalahan'}`);
      }
    } catch {
      alert('Gagal menghubungi server');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-16 text-muted text-sm">Memuat pengaturan...</div>;
  }

  if (userRole !== 'owner') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 mx-auto text-warn" />
        <h2 className="text-lg font-bold text-ink">Akses Khusus Owner</h2>
        <p className="text-sm text-muted">
          Pengaturan buku harga dan parameter resmi hanya dapat diubah oleh peran Owner. Silakan login menggunakan akun Owner.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-[30px] font-extrabold text-ink leading-tight flex items-center gap-3">
            <Settings className="w-7 h-7 text-accent" />
            <span>Pengaturan Buku Harga</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Edit informasi rekening resmi, kontak WA, nama admin, dan parameter dokumen penawaran PDF
          </p>
        </div>

        <span className="text-xs px-3 py-1.5 bg-surface border border-line rounded-xl text-ink font-semibold self-start sm:self-auto">
          Versi aktif: v{priceBook?.versi || 1}
        </span>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-ok-bg border border-ok/30 text-ok text-sm rounded-[18px] flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-ok shrink-0" />
          <span>
            Buku harga versi baru berhasil disimpan dan diaktifkan di database (tercatat di audit log)!
          </span>
        </div>
      )}

      {/* Tabel Potongan Minggu Ini */}
      <div className="bg-surface p-6 rounded-[20px] border border-line shadow-none space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <h2 className="text-[17px] font-bold text-ink">
              Potongan Minggu Ini
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Rekap diskon di bawah batas admin yang dikonfirmasi langsung oleh owner dalam 7 hari terakhir
            </p>
          </div>
          <span className="text-xs bg-raised border border-line text-ink font-bold px-3 py-1.5 rounded-xl tabular-nums">
            {potonganMingguIni.length} kejadian
          </span>
        </div>

        {potonganMingguIni.length === 0 ? (
          <p className="text-sm text-muted py-6 text-center">
            Belum ada potongan di bawah batas admin dalam 7 hari terakhir.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted text-xs font-semibold">
                  <th className="py-2.5">Waktu</th>
                  <th className="py-2.5">Admin</th>
                  <th className="py-2.5">Komponen</th>
                  <th className="py-2.5 text-right">Nilai List</th>
                  <th className="py-2.5 text-right">Nilai Deal</th>
                  <th className="py-2.5 text-right">Selisih Diskon</th>
                  <th className="py-2.5">Alasan Konfirmasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {potonganMingguIni.map((log) => {
                  const listVal = log.sebelum?.nilai_list || 0;
                  const dealVal = log.sesudah?.nilai_deal || 0;
                  const selisih = Math.max(0, listVal - dealVal);
                  const dateStr = new Date(log.created_at).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={log.id} className="hover:bg-raised transition">
                      <td className="py-3 text-xs text-muted tabular-nums">{dateStr}</td>
                      <td className="py-3 font-medium text-ink">
                        {log.users?.email || log.aktor}
                      </td>
                      <td className="py-3 capitalize text-ink font-semibold">
                        {log.objek?.split(':')[2] || log.objek}
                      </td>
                      <td className="py-3 text-right text-muted tabular-nums">
                        Rp{listVal.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 text-right font-bold text-ink tabular-nums">
                        Rp{dealVal.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 text-right font-bold text-warn tabular-nums">
                        -Rp{selisih.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 text-muted text-xs italic">
                        &ldquo;{log.alasan}&rdquo;
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {priceBook && (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Bagian Rekening & Kontak PDF */}
          <div className="bg-surface p-6 rounded-[20px] border border-line shadow-none space-y-4">
            <h2 className="text-[17px] font-bold text-ink border-b border-line pb-3">
              Informasi Resmi Dokumen Penawaran PDF
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Nama Bank
                </label>
                <input
                  type="text"
                  required
                  value={priceBook.dokumen_pdf.bank_nama}
                  onChange={(e) =>
                    setPriceBook({
                      ...priceBook,
                      dokumen_pdf: { ...priceBook.dokumen_pdf, bank_nama: e.target.value },
                    })
                  }
                  className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Nomor Rekening
                </label>
                <input
                  type="text"
                  required
                  value={priceBook.dokumen_pdf.bank_nomor}
                  onChange={(e) =>
                    setPriceBook({
                      ...priceBook,
                      dokumen_pdf: { ...priceBook.dokumen_pdf, bank_nomor: e.target.value },
                    })
                  }
                  className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Atas Nama Rekening
                </label>
                <input
                  type="text"
                  required
                  value={priceBook.dokumen_pdf.bank_atas_nama}
                  onChange={(e) =>
                    setPriceBook({
                      ...priceBook,
                      dokumen_pdf: { ...priceBook.dokumen_pdf, bank_atas_nama: e.target.value },
                    })
                  }
                  className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Nomor WhatsApp Resmi
                </label>
                <input
                  type="text"
                  required
                  value={priceBook.dokumen_pdf.kontak_wa_resmi}
                  onChange={(e) =>
                    setPriceBook({
                      ...priceBook,
                      dokumen_pdf: { ...priceBook.dokumen_pdf, kontak_wa_resmi: e.target.value },
                    })
                  }
                  className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Instagram Handle
                </label>
                <input
                  type="text"
                  value={priceBook.dokumen_pdf.instagram_handle}
                  onChange={(e) =>
                    setPriceBook({
                      ...priceBook,
                      dokumen_pdf: { ...priceBook.dokumen_pdf, instagram_handle: e.target.value },
                    })
                  }
                  className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">
                  Nama Admin Penanggung Jawab
                </label>
                <input
                  type="text"
                  value={priceBook.dokumen_pdf.nama_admin || ''}
                  placeholder="Contoh: Mita (CS Putra Glass)"
                  onChange={(e) =>
                    setPriceBook({
                      ...priceBook,
                      dokumen_pdf: { ...priceBook.dokumen_pdf, nama_admin: e.target.value },
                    })
                  }
                  className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Catatan Perubahan & Tombol Simpan */}
          <div className="bg-surface p-6 rounded-[20px] border border-line shadow-none space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Catatan Perubahan Versi Baru
              </label>
              <input
                type="text"
                required
                value={catatanPerubahan}
                onChange={(e) => setCatatanPerubahan(e.target.value)}
                placeholder="Alasan perubahan versi..."
                className="w-full text-sm px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="min-h-[44px] px-6 py-2.5 bg-accent text-accent-ink font-bold text-sm rounded-xl flex items-center gap-2 hover:opacity-95 disabled:opacity-50 transition cursor-pointer shadow-none"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Simpan &amp; Aktifkan Versi Baru</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
