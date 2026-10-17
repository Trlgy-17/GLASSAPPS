'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { formatRupiah } from '@/lib/pricing/format-rupiah';
import { getPeriode, getAvailablePeriods, ClosingPeriod } from '@/lib/closing-period';
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
  Trash2,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight,
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
  updated_at: string;
  deal_at?: string;
  alasan_batal?: string;
  deleted_at?: string;
  delete_reason?: string;
  created_by?: string;
  leads?: { nama: string; kota: string; no_wa: string };
  users?: { id?: string; nama: string; email: string };
  ringkasan_json?: Record<string, unknown>;
}

interface RingkasanKartu {
  terkirim_count: number;
  deal_count: number;
  deal_nilai: number;
  closing_rate: number;
  perlu_followup_count: number;
}

export default function PenawaranListPage() {
  const [quotes, setQuotes] = useState<PenawaranRow[]>([]);
  const [userRole, setUserRole] = useState<'owner' | 'admin'>('admin');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodeFilter, setPeriodeFilter] = useState<string>(''); // Default will be set from getPeriode().key
  const [followupOnly, setFollowupOnly] = useState(false);
  const [includeTest, setIncludeTest] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Cards summary
  const [ringkasanKartu, setRingkasanKartu] = useState<RingkasanKartu>({
    terkirim_count: 0,
    deal_count: 0,
    deal_nilai: 0,
    closing_rate: 0,
    perlu_followup_count: 0,
  });

  // Modal Dialogs for Deal & Batal
  const [dealModalQuoteId, setDealModalQuoteId] = useState<string | null>(null);
  const [dealDateInput, setDealDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [batalModalQuoteId, setBatalModalQuoteId] = useState<string | null>(null);
  const [alasanBatalInput, setAlasanBatalInput] = useState('harga');

  // Modal Dialog for Soft Delete
  const [deleteModalQuote, setDeleteModalQuote] = useState<{ id: string; nomor: string; isBulk?: boolean } | null>(null);
  const [deleteAlasan, setDeleteAlasan] = useState<'Demo / percobaan' | 'Salah input'>('Demo / percobaan');
  const [deleteCatatan, setDeleteCatatan] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // List of available closing periods for dropdown
  const availablePeriods = useMemo(() => getAvailablePeriods(12), []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('followup_only') === 'true') {
        setFollowupOnly(true);
      }
      if (sp.get('periode')) {
        setPeriodeFilter(sp.get('periode')!);
      } else {
        setPeriodeFilter(getPeriode().key);
      }
      if (sp.get('status')) {
        setStatusFilter(sp.get('status')!);
      }
      if (sp.get('include_test') === 'true') {
        setIncludeTest(true);
      }
    }
  }, []);

  const loadQuotes = useCallback(async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      if (authRes.ok) {
        const authJson = await authRes.json();
        if (authJson.user?.peran) {
          setUserRole(authJson.user.peran);
        }
        if (authJson.user?.id) {
          setCurrentUserId(authJson.user.id);
        }
      }
    } catch {}

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        search: searchQuery,
        status: statusFilter,
      });

      if (periodeFilter) {
        params.set('periode', periodeFilter);
      }
      if (followupOnly) {
        params.set('followup_only', 'true');
      }
      if (includeTest) {
        params.set('include_test', 'true');
      }

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
        if (json.ringkasan_kartu) {
          setRingkasanKartu(json.ringkasan_kartu);
        }
      }
    } catch (e) {
      console.warn('Gagal memuat penawaran:', e);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter, periodeFilter, followupOnly]);

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

  const handleOpenDelete = (q: PenawaranRow) => {
    if (q.status === 'deal' || q.status === 'lunas') {
      alert(
        `Penawaran ${q.nomor} berstatus Deal.\n\nPenawaran deal tidak dapat dihapus agar omzet di dasbor tidak berubah. Jika penawaran ini demo/salah input, silakan ubah statusnya terlebih dahulu ke selain Deal.`
      );
      return;
    }
    setDeleteModalQuote({ id: q.id, nomor: q.nomor });
    setDeleteAlasan('Demo / percobaan');
    setDeleteCatatan('');
  };

  const handleOpenBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setDeleteModalQuote({
      id: selectedIds[0],
      nomor: `${selectedIds.length} penawaran terpilih`,
      isBulk: true,
    });
    setDeleteAlasan('Demo / percobaan');
    setDeleteCatatan('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalQuote) return;
    setIsDeleting(true);
    try {
      const payload = deleteModalQuote.isBulk
        ? { ids: selectedIds, alasan: deleteAlasan, catatan: deleteCatatan }
        : { id: deleteModalQuote.id, alasan: deleteAlasan, catatan: deleteCatatan };

      const res = await fetch('/api/penawaran', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setDeleteModalQuote(null);
        setSelectedIds([]);
        await loadQuotes();
      } else {
        alert(`Gagal menghapus penawaran: ${json.error || 'Terjadi kesalahan'}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Terjadi kesalahan server';
      alert(`Gagal menghapus: ${msg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle selection
  const handleToggleSelectAll = () => {
    const selectable = quotes.filter(
      (q) => q.status !== 'deal' && q.status !== 'lunas' && (!currentUserId || q.created_by === currentUserId)
    );
    if (selectedIds.length === selectable.length && selectable.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectable.map((q) => q.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

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

  const formatAdminName = (rawName?: string, rawEmail?: string) => {
    if (rawName && !rawName.includes('@')) {
      return rawName.replace(/^\[TES\]\s*/i, '');
    }
    if (rawEmail) {
      if (rawEmail.includes('+admin1')) return 'Admin 1';
      if (rawEmail.includes('+tes-admin')) return 'Admin Tes';
      if (rawEmail.includes('+tes-owner')) return 'Owner Tes';
      return rawEmail.split('@')[0];
    }
    return 'Admin';
  };

  const formatKanalName = (kanal?: string) => {
    if (!kanal) return 'WhatsApp';
    const l = kanal.toLowerCase();
    if (l === 'whatsapp') return 'WhatsApp';
    if (l === 'tiktok') return 'TikTok';
    if (l === 'shopee') return 'Shopee';
    if (l === 'instagram') return 'Instagram';
    return kanal.charAt(0).toUpperCase() + kanal.slice(1);
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
              : 'Kelola status, closing periode berjalan, dan follow-up penawaran custom cermin LED'}
          </p>
        </div>

        {userRole === 'admin' && (
          <Link
            href="/penawaran/baru"
            id="btn-buat-penawaran-baru"
            className="min-h-[44px] px-5 py-2.5 bg-accent text-accent-ink rounded-xl font-bold text-xs flex items-center gap-2 hover:opacity-95 transition shadow-none cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Penawaran Baru</span>
          </Link>
        )}
      </div>

      {/* 5 KARTU METRIK PERIODE BERJALAN & FOLLOW-UP */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Kartu 1: Terkirim */}
        <div className="p-4 bg-surface rounded-[20px] border border-line shadow-none space-y-1">
          <span className="text-[11px] font-semibold text-muted tracking-wider uppercase block">
            Terkirim
          </span>
          <p className="text-2xl font-black text-ink tabular-nums">
            {ringkasanKartu.terkirim_count}
          </p>
          <span className="text-[10px] text-muted block">
            {userRole === 'admin' ? 'Penawaran Anda aktif' : 'Total penawaran aktif'}
          </span>
        </div>

        {/* Kartu 2: Deal */}
        <div className="p-4 bg-surface rounded-[20px] border border-line shadow-none space-y-1">
          <span className="text-[11px] font-semibold text-muted tracking-wider uppercase block">
            Deal
          </span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
            {ringkasanKartu.deal_count}
          </p>
          <span className="text-[10px] text-muted block">Closing DP diterima</span>
        </div>

        {/* Kartu 3: Nilai Deal (Rp) */}
        <div className="p-4 bg-surface rounded-[20px] border border-line shadow-none space-y-1">
          <span className="text-[11px] font-semibold text-muted tracking-wider uppercase block">
            Nilai Deal
          </span>
          <p className="text-lg font-black text-ink tabular-nums truncate">
            {formatRupiah(ringkasanKartu.deal_nilai)}
          </p>
          <span className="text-[10px] text-muted block">Omzet periode terpilih</span>
        </div>

        {/* Kartu 4: Closing Rate (%) */}
        <div className="p-4 bg-surface rounded-[20px] border border-line shadow-none space-y-1">
          <span className="text-[11px] font-semibold text-muted tracking-wider uppercase block">
            Closing Rate
          </span>
          <p className="text-2xl font-black text-accent tabular-nums">
            {ringkasanKartu.closing_rate}%
          </p>
          <span className="text-[10px] text-muted block">deal / total selesai</span>
        </div>

        {/* Kartu 5: Perlu Follow-Up (Paling Menonjol, Interaktif) */}
        <button
          type="button"
          id="card-perlu-followup"
          onClick={() => {
            setFollowupOnly(!followupOnly);
            setCurrentPage(1);
          }}
          className={`col-span-2 md:col-span-1 p-4 rounded-[20px] border text-left transition-all cursor-pointer relative overflow-hidden ${
            followupOnly
              ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30 text-amber-950 dark:text-amber-100'
              : ringkasanKartu.perlu_followup_count > 0
              ? 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200'
              : 'bg-surface hover:bg-raised border-line text-ink'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider block">
              Perlu Follow-Up
            </span>
            {ringkasanKartu.perlu_followup_count > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          <p className="text-2xl font-black tabular-nums my-1">
            {ringkasanKartu.perlu_followup_count}
          </p>
          <span className="text-[10px] flex items-center gap-1 font-semibold opacity-80">
            {followupOnly ? '✓ Filter aktif (klik untuk lepas)' : '&gt; 2 hari tanpa update (klik)'}
          </span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-surface p-4 rounded-[20px] border border-line shadow-none flex flex-col md:flex-row gap-3.5 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-3.5" />
          <input
            type="text"
            id="input-cari-penawaran"
            placeholder="Cari nomor, nama klien, atau kota..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full text-xs pl-10 pr-3.5 py-2.5 min-h-[44px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Dropdown Periode Closing (Tanggal 26 s/d 25) */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-muted" />
            <select
              id="select-periode"
              aria-label="Pilih Periode Closing"
              value={periodeFilter}
              onChange={(e) => {
                setPeriodeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs px-3 py-2 min-h-[40px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none font-medium cursor-pointer"
            >
              {availablePeriods.map((p, idx) => (
                <option key={p.key} value={p.key}>
                  {idx === 0 ? `${p.nama} (Berjalan)` : p.nama}
                </option>
              ))}
              <option value="all">Semua Periode</option>
            </select>
          </div>

          {/* Dropdown Status */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-muted" />
            <select
              id="select-status"
              aria-label="Pilih Status Penawaran"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs px-3 py-2 min-h-[40px] border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none font-medium cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="draf">Draf</option>
              <option value="terkirim">Terkirim</option>
              <option value="nego">Nego</option>
              <option value="deal">Deal (DP)</option>
              <option value="lunas">Lunas</option>
              <option value="batal">Batal</option>
              <option value="kadaluwarsa">Kadaluwarsa</option>
              {userRole === 'owner' && <option value="dihapus">Dihapus (Soft Delete)</option>}
            </select>
          </div>

          {/* Reset filter jika follow-up aktif */}
          {followupOnly && (
            <button
              type="button"
              onClick={() => setFollowupOnly(false)}
              className="text-xs px-3 py-2 bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/30 rounded-xl font-semibold hover:bg-amber-500/20 cursor-pointer"
            >
              Lepas filter follow-up ×
            </button>
          )}
        </div>
      </div>

      {/* Bar Aksi Hapus Massal (Jika Ada Baris Terpilih) */}
      {userRole === 'admin' && selectedIds.length > 0 && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-[18px] flex items-center justify-between gap-3 text-xs text-rose-950 dark:text-rose-200 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 font-semibold">
            <CheckSquare className="w-4 h-4 text-rose-600" />
            <span>{selectedIds.length} penawaran terpilih</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-lg border border-line bg-surface hover:bg-raised text-ink font-medium cursor-pointer"
            >
              Batal Pilih
            </button>
            <button
              type="button"
              id="btn-bulk-delete"
              onClick={handleOpenBulkDelete}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-none"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Terpilih</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabel Penawaran */}
      {isLoading ? (
        <div className="text-center py-16 text-muted text-sm">Memuat data penawaran...</div>
      ) : quotes.length === 0 ? (
        <div className="bg-surface p-16 text-center rounded-[20px] border border-line text-muted text-sm">
          Belum ada penawaran pada periode ini. Penawaran muncul di sini setelah dibuat.
        </div>
      ) : (
        <div className="bg-surface rounded-[20px] border border-line shadow-none overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" id="table-daftar-penawaran">
              <thead>
                <tr className="bg-raised border-b border-line text-muted text-xs font-semibold">
                  {userRole === 'admin' && (
                    <th className="py-3.5 pl-4 pr-1 w-10 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        aria-label="Pilih semua baris"
                        className="p-1 hover:text-ink cursor-pointer"
                      >
                        {selectedIds.length > 0 &&
                        selectedIds.length ===
                          quotes.filter(
                            (q) =>
                              q.status !== 'deal' &&
                              q.status !== 'lunas' &&
                              (!currentUserId || q.created_by === currentUserId)
                          ).length ? (
                          <CheckSquare className="w-4 h-4 text-accent" />
                        ) : (
                          <Square className="w-4 h-4 text-muted" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="py-3.5 px-4">Nomor &amp; Waktu</th>
                  <th className="py-3.5 px-4">Klien &amp; Kota</th>
                  <th className="py-3.5 px-4">Kanal</th>
                  <th className="py-3.5 px-4 text-right">Total Nilai</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/40">
                {quotes.map((q) => {
                  const dateStr = new Date(q.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                  const adminDisplayName = formatAdminName(q.users?.nama, q.users?.email);
                  const isDealOrLunas = q.status === 'deal' || q.status === 'lunas';
                  const isOwnQuote = !currentUserId || q.created_by === currentUserId;
                  const isSelectable = userRole === 'admin' && !isDealOrLunas && isOwnQuote && !q.deleted_at;

                  return (
                    <tr
                      key={q.id}
                      className={`hover:bg-raised transition ${
                        selectedIds.includes(q.id) ? 'bg-raised/70' : ''
                      }`}
                    >
                      {userRole === 'admin' && (
                        <td className="py-4 pl-4 pr-1 text-center">
                          {isSelectable ? (
                            <button
                              type="button"
                              onClick={() => handleToggleSelect(q.id)}
                              aria-label={`Pilih penawaran ${q.nomor}`}
                              className="p-1 hover:text-ink cursor-pointer"
                            >
                              {selectedIds.includes(q.id) ? (
                                <CheckSquare className="w-4 h-4 text-accent" />
                              ) : (
                                <Square className="w-4 h-4 text-muted" />
                              )}
                            </button>
                          ) : (
                            <span className="w-4 h-4 inline-block opacity-20">—</span>
                          )}
                        </td>
                      )}

                      <td className="py-4 px-4">
                        <span className="font-bold text-accent block">{q.nomor}</span>
                        <span className="text-xs text-muted tabular-nums">
                          {dateStr} · {adminDisplayName}
                        </span>
                        {q.deleted_at && (
                          <span className="text-[10px] text-rose-500 font-semibold block mt-0.5">
                            Dihapus ({q.delete_reason || 'Soft delete'})
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-semibold text-ink block">{q.leads?.nama || 'Klien'}</span>
                        <span className="text-xs text-muted">{q.leads?.kota || '-'}</span>
                      </td>

                      <td className="py-4 px-4 text-muted text-xs font-medium">
                        {formatKanalName(q.kanal)}
                      </td>

                      <td className="py-4 px-4 text-right tabular-nums font-bold text-ink">
                        {formatRupiah(Number(q.total_nilai || q.ringkasan_json?.total || 0))}
                      </td>

                      <td className="py-4 px-4 text-center">
                        {userRole === 'admin' && !q.deleted_at ? (
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
                            className={`inline-block px-3 py-1 text-xs font-bold rounded-lg border capitalize ${
                              q.deleted_at ? 'bg-rose-500/10 text-rose-600 border-rose-500/30' : getStatusBadge(q.status)
                            }`}
                          >
                            {q.deleted_at ? 'Dihapus' : q.status}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <a
                            href={`/api/penawaran/${q.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center p-2 text-muted hover:text-accent rounded-lg hover:bg-raised transition cursor-pointer"
                            title="Unduh PDF Penawaran"
                          >
                            <Download className="w-4 h-4" />
                          </a>

                          {/* Tombol Hapus (Hanya untuk Admin, Bukan Owner) */}
                          {userRole === 'admin' && !q.deleted_at && (
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(q)}
                              data-testid={`btn-hapus-${q.nomor}`}
                              className={`min-h-[38px] min-w-[38px] inline-flex items-center justify-center p-2 rounded-lg transition cursor-pointer ${
                                isDealOrLunas
                                  ? 'text-muted/40 hover:text-rose-400/60 hover:bg-raised'
                                  : 'text-muted hover:text-rose-600 hover:bg-rose-500/10'
                              }`}
                              title={
                                isDealOrLunas
                                  ? 'Penawaran deal tidak bisa dihapus (ubah status terlebih dahulu jika salah input)'
                                  : 'Hapus penawaran'
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
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
                <span className="text-xs font-bold text-ink px-2 tabular-nums">
                  {currentPage} / {totalPages}
                </span>
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

      {/* Modal Dialog: Konfirmasi Hapus Penawaran (Single / Bulk) */}
      {deleteModalQuote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-100">
          <div className="bg-surface border border-line rounded-[22px] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3 text-rose-600">
              <div className="p-2.5 rounded-full bg-rose-500/10 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-ink text-base">Konfirmasi Hapus Penawaran</h3>
                <p className="text-xs text-muted mt-1">
                  Hapus penawaran <strong className="text-ink">{deleteModalQuote.nomor}</strong>?
                  Tindakan ini tidak bisa dibatalkan dari menu admin.
                </p>
              </div>
            </div>

            {/* Pilihan Cepat Alasan (Wajib) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink block">
                Alasan Hapus <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteAlasan('Demo / percobaan')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer text-center ${
                    deleteAlasan === 'Demo / percobaan'
                      ? 'border-accent bg-accent/10 text-accent font-bold'
                      : 'border-line bg-raised text-muted hover:text-ink'
                  }`}
                >
                  Demo / percobaan
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteAlasan('Salah input')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer text-center ${
                    deleteAlasan === 'Salah input'
                      ? 'border-accent bg-accent/10 text-accent font-bold'
                      : 'border-line bg-raised text-muted hover:text-ink'
                  }`}
                >
                  Salah input
                </button>
              </div>
            </div>

            {/* Kolom Catatan Tambahan (Opsional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted block">
                Catatan Tambahan (Opsional):
              </label>
              <textarea
                value={deleteCatatan}
                onChange={(e) => setDeleteCatatan(e.target.value)}
                placeholder="Misal: nomor kontak salah ketik, draf diganti nomor baru..."
                rows={2}
                className="w-full text-xs p-3 border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setDeleteModalQuote(null)}
                disabled={isDeleting}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold rounded-xl border border-line bg-raised hover:bg-surface text-ink cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-delete"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="min-h-[40px] px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-none flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Hapus Penawaran'}
              </button>
            </div>
          </div>
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
              className="w-full text-xs p-3 border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent"
            />
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setDealModalQuoteId(null)}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold rounded-xl border border-line bg-raised hover:bg-surface text-ink cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateStatus(dealModalQuoteId, 'deal', { deal_at: dealDateInput })
                }
                className="min-h-[40px] px-4 py-2 text-xs font-bold rounded-xl bg-ok-bg text-ok border border-ok/30 hover:opacity-90 cursor-pointer"
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
            <h3 className="font-bold text-ink text-base">Konfirmasi Pembatalan Penawaran</h3>
            <p className="text-xs text-muted">Pilih alasan penawaran ini dibatalkan oleh klien:</p>
            <select
              value={alasanBatalInput}
              onChange={(e) => setAlasanBatalInput(e.target.value)}
              className="w-full text-xs p-3 border border-line rounded-xl bg-raised text-ink focus:bg-surface focus:outline-none focus:border-accent"
            >
              <option value="harga">Kemahalan / Masalah Harga</option>
              <option value="ongkir">Ongkos Kirim Terlalu Berat</option>
              <option value="lokasi">Lokasi Terlalu Jauh</option>
              <option value="waktu produksi">Waktu Produksi Kurang Cepat</option>
              <option value="menghilang">Klien Menghilang / No Response</option>
              <option value="pilih toko lain">Klien Memilih Toko Lain</option>
              <option value="lainnya">Alasan Lainnya</option>
            </select>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setBatalModalQuoteId(null)}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold rounded-xl border border-line bg-raised hover:bg-surface text-ink cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateStatus(batalModalQuoteId, 'batal', { alasan_batal: alasanBatalInput })
                }
                className="min-h-[40px] px-4 py-2 text-xs font-bold rounded-xl bg-warn-bg text-warn border border-warn/30 hover:opacity-90 cursor-pointer"
              >
                Tandai Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
