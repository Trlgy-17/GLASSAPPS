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
    return <div className="text-center py-12 text-[#6B7385] text-sm">Memuat pengaturan...</div>;
  }

  if (userRole !== 'owner') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 mx-auto text-amber-600" />
        <h2 className="text-lg font-bold text-[#253254]">Akses Khusus Owner</h2>
        <p className="text-xs text-[#6B7385]">
          Pengaturan buku harga dan informasi resmi hanya dapat diubah oleh peran Owner. Silakan login menggunakan akun Owner.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#E3E7EE]">
        <div>
          <h1 className="text-2xl font-bold text-[#253254] flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#275087]" /> Pengaturan Buku Harga (Owner)
          </h1>
          <p className="text-sm text-[#6B7385] mt-1">
            Edit informasi rekening resmi, kontak WA, nama admin, dan parameter dokumen PDF
          </p>
        </div>
        <span className="text-xs bg-[#253254] text-white px-3 py-1 rounded font-medium">
          Versi Aktif: v{priceBook?.versi || 1}
        </span>
      </div>

      {saveSuccess && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Buku harga versi baru berhasil disimpan dan diaktifkan di database (tercatat di audit log)!
          </span>
        </div>
      )}
      {/* Tabel Potongan Minggu Ini dari audit_log */}
      <div className="mb-8 bg-white p-6 rounded-xl border border-[#E3E7EE] shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#F2F5F9] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#253254] uppercase tracking-wider">
              Potongan Minggu Ini (Audit Log)
            </h2>
            <p className="text-xs text-[#6B7385] mt-0.5">
              Rekap diskon di bawah batas admin yang dikonfirmasi langsung oleh owner dalam 7 hari terakhir
            </p>
          </div>
          <span className="text-xs bg-[#F2F5F9] text-[#253254] font-bold px-2.5 py-1 rounded">
            {potonganMingguIni.length} Kejadian
          </span>
        </div>

        {potonganMingguIni.length === 0 ? (
          <p className="text-xs text-[#6B7385] py-4 text-center">
            Belum ada potongan di bawah batas admin dalam 7 hari terakhir.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E3E7EE] text-[#98A0B0] uppercase text-[10px] font-bold">
                  <th className="py-2">Waktu</th>
                  <th className="py-2">Admin</th>
                  <th className="py-2">Komponen</th>
                  <th className="py-2">Nilai List</th>
                  <th className="py-2">Nilai Deal</th>
                  <th className="py-2">Selisih Diskon</th>
                  <th className="py-2">Alasan Konfirmasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F5F9]">
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
                    <tr key={log.id} className="hover:bg-[#F2F5F9]/50">
                      <td className="py-2.5 font-mono text-[#6B7385]">{dateStr}</td>
                      <td className="py-2.5 font-medium text-[#1B2233]">
                        {log.users?.email || log.aktor}
                      </td>
                      <td className="py-2.5 capitalize text-[#253254] font-semibold">
                        {log.objek?.split(':')[2] || log.objek}
                      </td>
                      <td className="py-2.5 font-mono text-[#6B7385]">
                        Rp{listVal.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 font-mono font-bold text-[#253254]">
                        Rp{dealVal.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 font-mono font-bold text-red-600">
                        -Rp{selisih.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 text-[#1B2233] italic">
                        "{log.alasan}"
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
          <div className="bg-white p-6 rounded-xl border border-[#E3E7EE] shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[#253254] uppercase tracking-wider border-b border-[#F2F5F9] pb-3">
              Informasi Resmi Dokumen Penawaran PDF
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B7385] mb-1">
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
                  className="w-full text-xs px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#275087]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7385] mb-1">
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
                  className="w-full text-xs px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#275087]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7385] mb-1">
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
                  className="w-full text-xs px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#275087]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7385] mb-1">
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
                  className="w-full text-xs px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#275087]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7385] mb-1">
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
                  className="w-full text-xs px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#275087]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B7385] mb-1">
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
                  className="w-full text-xs px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#275087]"
                />
              </div>
            </div>
          </div>

          {/* Catatan Perubahan & Tombol Simpan */}
          <div className="bg-white p-6 rounded-xl border border-[#E3E7EE] shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#6B7385] mb-1">
                Catatan Perubahan Versi Baru
              </label>
              <input
                type="text"
                required
                value={catatanPerubahan}
                onChange={(e) => setCatatanPerubahan(e.target.value)}
                placeholder="Alasan perubahan versi..."
                className="w-full text-xs px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9]"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 bg-[#253254] hover:bg-[#1f2845] text-white font-medium text-xs px-5 py-2.5 rounded shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Simpan &amp; Aktifkan Versi Baru
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
