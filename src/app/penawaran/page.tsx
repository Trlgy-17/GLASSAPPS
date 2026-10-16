'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatRupiah } from '@/lib/pricing/format-rupiah';
import {
  FileText,
  Search,
  Filter,
  Download,
  Plus,
  Copy,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  Calendar,
} from 'lucide-react';

interface PenawaranRow {
  id: string;
  nomor: string;
  lead_id: string;
  status: 'draf' | 'terkirim' | 'nego' | 'deal' | 'lunas' | 'batal' | 'kadaluwarsa';
  kanal: string;
  total_nilai: number;
  valid_until: string;
  created_at: string;
  deal_at?: string;
  alasan_batal?: string;
  leads?: { nama: string; kota: string; no_wa: string };
  ringkasan_json?: Record<string, unknown>;
}

export default function PenawaranListPage() {
  const [quotes, setQuotes] = useState<PenawaranRow[]>([]);
  const [userRole, setUserRole] = useState<'owner' | 'admin'>('admin');
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal Dialogs for Deal & Batal
  const [dealModalQuoteId, setDealModalQuoteId] = useState<string | null>(null);
  const [dealDateInput, setDealDateInput] = useState(new Date().toISOString().split('T')[0]);

  const [batalModalQuoteId, setBatalModalQuoteId] = useState<string | null>(null);
  const [alasanBatalInput, setAlasanBatalInput] = useState('harga');

  const loadQuotes = async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase.from('users').select('peran').eq('id', user.id).single();
      setUserRole(profile?.peran || 'admin');
    }

    const { data, error } = await supabase
      .from('penawaran')
      .select('*, leads(nama, kota, no_wa)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Periksa status kadaluwarsa otomatis jika valid_until lewat & masih draf/terkirim/nego
      const nowStr = new Date().toISOString().split('T')[0];
      const normalized = (data as unknown as PenawaranRow[]).map((q) => {
        if (['draf', 'terkirim', 'nego'].includes(q.status) && q.valid_until < nowStr) {
          return { ...q, status: 'kadaluwarsa' as const };
        }
        return q;
      });
      setQuotes(normalized);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadQuotes();
  }, []);

  // Update Status Penawaran via PATCH /api/penawaran/[id]/status
  const handleUpdateStatus = async (
    quoteId: string,
    newStatus: string,
    extraData?: { deal_at?: string; alasan_batal?: string }
  ) => {
    if (newStatus === 'deal' && !extraData?.deal_at) {
      setDealModalQuoteId(quoteId);
      return;
    }
    if (newStatus === 'batal' && !extraData?.alasan_batal) {
      setBatalModalQuoteId(quoteId);
      return;
    }

    try {
      const res = await fetch(`/api/penawaran/${quoteId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          deal_at: extraData?.deal_at,
          alasan_batal: extraData?.alasan_batal,
        }),
      });

      if (res.ok) {
        await loadQuotes();
        setDealModalQuoteId(null);
        setBatalModalQuoteId(null);
      } else {
        const json = await res.json();
        alert(`Gagal mengubah status: ${json.error || 'Terjadi kesalahan'}`);
      }
    } catch {
      alert('Gagal menghubungi server');
    }
  };

  // Filter List
  const filteredQuotes = quotes.filter((q) => {
    const matchesSearch =
      (q.leads?.nama || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.leads?.kota || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.nomor.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-[#E3E7EE]">
        <div>
          <h1 className="text-2xl font-bold text-[#253254] flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#275087]" /> Daftar Penawaran
          </h1>
          <p className="text-sm text-[#6B7385] mt-1">
            {userRole === 'owner'
              ? 'Monitoring riwayat penawaran klien Putra Glass (Mode Baca Saja)'
              : 'Kelola status dan buat penawaran custom cermin LED'}
          </p>
        </div>

        {userRole === 'admin' && (
          <Link
            href="/penawaran/baru"
            className="flex items-center gap-2 bg-[#253254] hover:bg-[#1f2845] text-white font-medium text-xs px-4 py-2 rounded shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Buat Penawaran Baru
          </Link>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E3E7EE] shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#98A0B0] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Cari nomor, nama klien, atau kota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-[#6B7385]" />
          <span className="text-xs text-[#6B7385] whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9] focus:bg-white"
          >
            <option value="all">Semua Status</option>
            <option value="draf">Draf</option>
            <option value="terkirim">Terkirim</option>
            <option value="nego">Nego</option>
            <option value="deal">Deal (DP)</option>
            <option value="lunas">Lunas</option>
            <option value="batal">Batal</option>
            <option value="kadaluwarsa">Kadaluwarsa</option>
          </select>
        </div>
      </div>

      {/* Tabel Penawaran */}
      {isLoading ? (
        <div className="text-center py-12 text-[#6B7385] text-sm">Memuat data penawaran...</div>
      ) : filteredQuotes.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-[#E3E7EE] text-[#6B7385] text-sm">
          Tidak ada penawaran yang cocok dengan pencarian.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E3E7EE] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F2F5F9] border-b border-[#E3E7EE] text-[#98A0B0] uppercase text-[10px] font-bold">
                  <th className="py-3 px-4">Nomor &amp; Waktu</th>
                  <th className="py-3 px-4">Klien &amp; Kota</th>
                  <th className="py-3 px-4">Kanal</th>
                  <th className="py-3 px-4 text-right">Total Nilai</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F5F9]">
                {filteredQuotes.map((q) => {
                  const dateStr = new Date(q.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <tr key={q.id} className="hover:bg-[#F2F5F9]/60 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-[#253254] block">{q.nomor}</span>
                        <span className="text-[10px] text-[#6B7385]">{dateStr}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-[#1B2233] block">{q.leads?.nama || 'Klien'}</span>
                        <span className="text-[10px] text-[#6B7385]">{q.leads?.kota || '-'}</span>
                      </td>

                      <td className="py-3 px-4 capitalize text-[#6B7385] font-medium">
                        {q.kanal || 'whatsapp'}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-[#253254]">
                        {formatRupiah(Number(q.total_nilai || q.ringkasan_json?.total || 0))}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {userRole === 'admin' ? (
                          /* Dropdown status satu klik untuk Admin */
                          <div className="inline-block relative">
                            <select
                              value={q.status}
                              onChange={(e) => handleUpdateStatus(q.id, e.target.value)}
                              className={`text-[11px] font-bold px-2 py-1 rounded border focus:outline-none cursor-pointer ${
                                q.status === 'deal' || q.status === 'lunas'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : q.status === 'terkirim'
                                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                                  : q.status === 'nego'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : q.status === 'batal'
                                  ? 'bg-red-50 text-red-800 border-red-300'
                                  : 'bg-gray-100 text-gray-800 border-gray-300'
                              }`}
                            >
                              <option value="draf">Draf</option>
                              <option value="terkirim">Terkirim</option>
                              <option value="nego">Nego</option>
                              <option value="deal">Deal (DP)</option>
                              <option value="lunas">Lunas</option>
                              <option value="batal">Batal</option>
                              <option value="kadaluwarsa">Kadaluwarsa</option>
                            </select>
                          </div>
                        ) : (
                          /* Badge statis untuk Owner */
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              q.status === 'deal' || q.status === 'lunas'
                                ? 'bg-emerald-100 text-emerald-800'
                                : q.status === 'terkirim'
                                ? 'bg-blue-100 text-blue-800'
                                : q.status === 'nego'
                                ? 'bg-amber-100 text-amber-800'
                                : q.status === 'batal'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {q.status}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-2">
                        <Link
                          href={`/api/penawaran/${q.id}/pdf`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#275087] hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" /> Unduh PDF
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Input Tanggal DP (Deal) */}
      {dealModalQuoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-lg border border-[#E3E7EE] max-w-sm w-full p-5 space-y-4">
            <h3 className="font-bold text-sm text-[#253254] flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" /> Konfirmasi Status Deal (DP)
            </h3>
            <p className="text-xs text-[#6B7385]">
              Masukkan tanggal pembayaran DP dari bukti transfer klien:
            </p>
            <div>
              <label className="block text-xs font-semibold mb-1">Tanggal DP:</label>
              <input
                type="date"
                required
                value={dealDateInput}
                onChange={(e) => setDealDateInput(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-[#E3E7EE] rounded"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDealModalQuoteId(null)}
                className="px-3 py-1.5 text-xs text-[#6B7385] hover:bg-gray-100 rounded"
              >
                Batal
              </button>
              <button
                onClick={() =>
                  handleUpdateStatus(dealModalQuoteId, 'deal', { deal_at: new Date(dealDateInput).toISOString() })
                }
                className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded"
              >
                Konfirmasi Deal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Input Alasan Batal */}
      {batalModalQuoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-lg border border-[#E3E7EE] max-w-sm w-full p-5 space-y-4">
            <h3 className="font-bold text-sm text-[#253254] flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" /> Penawaran Dibatalkan
            </h3>
            <p className="text-xs text-[#6B7385]">
              Pilih alasan utama klien membatalkan pesanan untuk analitik dasbor owner:
            </p>
            <div>
              <label className="block text-xs font-semibold mb-1">Alasan Pembatalan:</label>
              <select
                value={alasanBatalInput}
                onChange={(e) => setAlasanBatalInput(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-[#E3E7EE] rounded bg-[#F2F5F9]"
              >
                <option value="harga">Harga cermin dianggap mahal</option>
                <option value="ongkir">Ongkir terlalu mahal</option>
                <option value="lokasi">Lokasi jauh / takut pecah</option>
                <option value="waktu produksi">Waktu produksi terlalu lama</option>
                <option value="menghilang">Klien menghilang / ghosting</option>
                <option value="pilih toko lain">Pilih toko lain</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setBatalModalQuoteId(null)}
                className="px-3 py-1.5 text-xs text-[#6B7385] hover:bg-gray-100 rounded"
              >
                Batal
              </button>
              <button
                onClick={() =>
                  handleUpdateStatus(batalModalQuoteId, 'batal', { alasan_batal: alasanBatalInput })
                }
                className="px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Simpan Pembatalan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
