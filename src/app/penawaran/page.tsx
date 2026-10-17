'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatRupiah } from '@/lib/pricing/format-rupiah';
import {
  FileText,
  Search,
  Filter,
  Download,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
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
  users?: { nama: string; email: string };
  ringkasan_json?: Record<string, unknown>;
}

export default function PenawaranListPage() {
  const [quotes, setQuotes] = useState<PenawaranRow[]>([]);
  const [userRole, setUserRole] = useState<'owner' | 'admin'>('admin');
  const [isLoading, setIsLoading] = useState(true);
  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  // Modal Dialogs for Deal & Batal
  const [dealModalQuoteId, setDealModalQuoteId] = useState<string | null>(null);
  const [dealDateInput, setDealDateInput] = useState(new Date().toISOString().split('T')[0]);

  const [batalModalQuoteId, setBatalModalQuoteId] = useState<string | null>(null);
  const [alasanBatalInput, setAlasanBatalInput] = useState('harga');

  const loadQuotes = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase.from('users').select('peran').eq('id', user.id).single();
      setUserRole(profile?.peran || 'admin');
    }

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        search: searchQuery,
        status: statusFilter,
      });
      const res = await fetch(`/api/penawaran?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const nowStr = new Date().toISOString().split('T')[0];
        const normalized = (json.penawaran || []).map((q: PenawaranRow) => {
          if (['draf', 'terkirim', 'nego'].includes(q.status) && q.valid_until < nowStr) {
            return { ...q, status: 'kadaluwarsa' as const };
          }
          return q;
        });
        setQuotes(normalized);
        setTotalPages(json.total_pages || 1);
        setTotalCount(json.total || 0);
      }
    } catch (e) {
      console.warn('Gagal memuat penawaran:', e);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

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

  const filteredQuotes = quotes;

  const getStatusBadge = (status: PenawaranRow['status']) => {
    switch (status) {
      case 'deal':
      case 'lunas':
        return 'bg-ok-bg text-ok border-ok/30';
      case 'terkirim':
      case 'nego':
        return 'bg-tint text-accent border-accent/30';
      case 'batal':
      case 'kadaluwarsa':
        return 'bg-warn-bg text-warn border-warn/30';
      default:
        return 'bg-raised text-muted border-line';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-[30px] font-extrabold text-ink leading-tight flex items-center gap-3">
            <FileText className="w-7 h-7 text-accent" />
            <span>Daftar Penawaran</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            {userRole === 'owner'
              ? 'Monitoring riwayat penawaran klien Putra Glass (mode baca saja)'
              : 'Kelola status dan riwayat penawaran custom cermin LED'}
          </p>
        </div>

        {userRole === 'admin' && (
          <Link
            href="/penawaran/baru"
            className="min-h-[44px] px-5 py-2.5 bg-accent text-accent-ink rounded-xl font-bold text-xs flex items-center gap-2 hover:opacity-95 transition shadow-none cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Penawaran Baru</span>
          </Link>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-surface p-4 rounded-[20px] border border-line shadow-none flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Cari nomor, nama klien, atau kota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-10 pr-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Filter className="w-4 h-4 text-muted" />
          <span className="text-xs text-muted whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none"
          >
            <option value="all">Semua status</option>
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
        <div className="text-center py-16 text-muted text-sm">Memuat data penawaran...</div>
      ) : quotes.length === 0 ? (
        <div className="bg-surface p-16 text-center rounded-[20px] border border-line text-muted text-sm">
          Belum ada penawaran. Penawaran muncul di sini setelah admin membuatnya.
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="bg-surface p-16 text-center rounded-[20px] border border-line text-muted text-sm space-y-3">
          <p>Tidak ada penawaran yang cocok.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="px-4 py-2 bg-raised hover:bg-tint text-accent border border-line rounded-xl text-xs font-semibold cursor-pointer"
          >
            Hapus filter
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-[20px] border border-line shadow-none overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-raised border-b border-line text-muted text-xs font-semibold">
                  <th className="py-3.5 px-5">Nomor &amp; Waktu</th>
                  <th className="py-3.5 px-5">Klien &amp; Kota</th>
                  <th className="py-3.5 px-5">Kanal</th>
                  <th className="py-3.5 px-5 text-right">Total Nilai</th>
                  <th className="py-3.5 px-5 text-center">Status</th>
                  <th className="py-3.5 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {filteredQuotes.map((q) => {
                  const dateStr = new Date(q.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <tr key={q.id} className="hover:bg-raised transition">
                      <td className="py-4 px-5">
                        <span className="font-bold text-accent block">{q.nomor}</span>
                        <span className="text-xs text-muted tabular-nums">
                          {dateStr} · {q.users?.nama || 'Admin'}
                        </span>
                      </td>

                      <td className="py-4 px-5">
                        <span className="font-semibold text-ink block">{q.leads?.nama || 'Klien'}</span>
                        <span className="text-xs text-muted">{q.leads?.kota || '-'}</span>
                      </td>

                      <td className="py-4 px-5 capitalize text-muted text-xs font-medium">
                        {q.kanal || 'whatsapp'}
                      </td>

                      <td className="py-4 px-5 text-right tabular-nums font-bold text-ink">
                        {formatRupiah(Number(q.total_nilai || q.ringkasan_json?.total || 0))}
                      </td>

                      <td className="py-4 px-5 text-center">
                        {userRole === 'admin' ? (
                          <div className="relative inline-block">
                            <select
                              value={q.status}
                              onChange={(e) => handleUpdateStatus(q.id, e.target.value)}
                              className={`text-xs font-bold px-3 py-1.5 rounded-lg border appearance-none pr-7 cursor-pointer focus:outline-none ${getStatusBadge(
                                q.status
                              )}`}
                            >
                              <option value="draf">Draf</option>
                              <option value="terkirim">Terkirim</option>
                              <option value="nego">Nego</option>
                              <option value="deal">Deal (DP)</option>
                              <option value="lunas">Lunas</option>
                              <option value="batal">Batal</option>
                              <option value="kadaluwarsa">Kadaluwarsa</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2.5 pointer-events-none opacity-60" />
                          </div>
                        ) : (
                          <span
                            className={`inline-block px-3 py-1 text-xs font-bold rounded-lg border capitalize ${getStatusBadge(
                              q.status
                            )}`}
                          >
                            {q.status}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 text-right">
                        <a
                          href={`/api/penawaran/${q.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 text-muted hover:text-accent rounded-xl hover:bg-raised transition cursor-pointer"
                          title="Unduh PDF Penawaran"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-line px-5 py-3 gap-3 bg-surface">
              <span className="text-xs text-muted">
                Halaman {currentPage} dari {totalPages} ({totalCount} total penawaran)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-line bg-raised hover:bg-surface disabled:opacity-40 cursor-pointer"
                >
                  Sebelumnya
                </button>
                <span className="text-xs font-bold text-ink px-2 tabular-nums">{currentPage} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-line bg-raised hover:bg-surface disabled:opacity-40 cursor-pointer"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Dialog: Konfirmasi Deal */}
      {dealModalQuoteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-line rounded-[20px] max-w-sm w-full p-6 space-y-4 shadow-none">
            <h3 className="font-bold text-ink text-base">Konfirmasi Deal Penawaran</h3>
            <p className="text-xs text-muted">
              Masukkan tanggal kesepakatan deal / transfer DP untuk penghitungan metrik sales:
            </p>
            <input
              type="date"
              value={dealDateInput}
              onChange={(e) => setDealDateInput(e.target.value)}
              className="w-full text-xs p-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink"
            />
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDealModalQuoteId(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-muted hover:text-ink cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(dealModalQuoteId, 'deal', { deal_at: dealDateInput })}
                className="min-h-[44px] px-4 py-2 bg-ok text-white text-xs font-bold rounded-xl hover:opacity-95 cursor-pointer"
              >
                Simpan Deal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Konfirmasi Batal */}
      {batalModalQuoteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-line rounded-[20px] max-w-sm w-full p-6 space-y-4 shadow-none">
            <h3 className="font-bold text-ink text-base">Konfirmasi Pembatalan</h3>
            <p className="text-xs text-muted">Pilih alasan penolakan/pembatalan klien:</p>
            <select
              value={alasanBatalInput}
              onChange={(e) => setAlasanBatalInput(e.target.value)}
              className="w-full text-xs p-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink"
            >
              <option value="harga">Harga terlalu tinggi / anggaran tidak masuk</option>
              <option value="ongkir">Ongkir terlalu mahal</option>
              <option value="lokasi">Lokasi workshop terlalu jauh</option>
              <option value="waktu_produksi">Waktu produksi terlalu lama</option>
              <option value="menghilang">Klien menghilang / ghosting</option>
              <option value="toko_lain">Memilih toko lain</option>
              <option value="lainnya">Lainnya</option>
            </select>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setBatalModalQuoteId(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-muted hover:text-ink cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(batalModalQuoteId, 'batal', { alasan_batal: alasanBatalInput })}
                className="min-h-[44px] px-4 py-2 bg-warn text-white text-xs font-bold rounded-xl hover:opacity-95 cursor-pointer"
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
