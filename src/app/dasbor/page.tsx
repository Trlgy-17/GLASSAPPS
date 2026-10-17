'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { formatRupiah } from '@/lib/pricing/format-rupiah';
import { WeeklyTrendChartSkeleton, WeeklyChartItem } from '@/components/dashboard/WeeklyTrendChart';

const WeeklyTrendChart = dynamic(
  () => import('@/components/dashboard/WeeklyTrendChart'),
  {
    loading: () => <WeeklyTrendChartSkeleton />,
    ssr: false,
  }
);
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  Tag,
  BarChart3,
  Calendar,
  Layers,
  Table as TableIcon,
} from 'lucide-react';

interface DasborSummary {
  dibuat: { jumlah: number; nilai: number };
  proses: { jumlah: number; nilai: number };
  deal: { jumlah: number; nilai: number };
  batal: {
    jumlah: number;
    nilai: number;
    top_alasan: Array<{ alasan: string; jumlah: number }>;
  };
  closing_rate: number | null;
  proyeksi_omzet: number;
  median_hari_deal: number | null;
}

interface FollowUpItem {
  id: string;
  nomor: string;
  nama_klien: string;
  kota: string;
  total_nilai: number;
  hari_tanpa_perubahan: number;
  admin_nama: string;
  status: string;
}


interface PotonganItem {
  id: string;
  penawaran_id?: string;
  nomor: string;
  nama_klien: string;
  kota: string;
  jenis: string;
  nilai_list: number;
  nilai_deal: number;
  selisih: number;
  keterangan_deal: string;
  ringkasan_baris: string;
  alasan: string;
  di_bawah_net: boolean;
  tanggal: string;
  admin_nama: string;
  penawaran?: any;
}
export default function DasborPage() {
  const [summary, setSummary] = useState<DasborSummary | null>(null);
  const [followUpList, setFollowUpList] = useState<FollowUpItem[]>([]);
  const [chartData, setChartData] = useState<WeeklyChartItem[]>([]);
  const [potonganList, setPotonganList] = useState<PotonganItem[]>([]);
  const [admins, setAdmins] = useState<Array<{ id: string; nama: string; email: string }>>([]);
  const [selectedDetailQuote, setSelectedDetailQuote] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [rentang, setRentang] = useState<'minggu_ini' | 'bulan_ini' | 'bulan_lalu' | 'custom'>('bulan_ini');
  const [kanal, setKanal] = useState<string>('all');
  const [adminId, setAdminId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showTableModal, setShowTableModal] = useState(false);

  useEffect(() => {
    async function fetchDasbor() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          rentang,
          kanal: kanal === 'all' ? '' : kanal,
          admin_id: adminId === 'all' ? '' : adminId,
        });

        const res = await fetch(`/api/dasbor?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          setSummary(json.summary);
          setFollowUpList(json.follow_up || []);
          setChartData(json.chart_data || []);
          setPotonganList(json.potongan_minggu_ini || []);
          if (json.admins) setAdmins(json.admins);
        }
      } catch (err) {
        console.warn('Gagal memuat dasbor:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchDasbor();
  }, [rentang, kanal, adminId]);

  const maxChartVal = Math.max(1, ...chartData.map((c) => Math.max(c.total_penawaran, c.total_deal)));

  const totalStatusCount = summary
    ? summary.dibuat.jumlah + summary.proses.jumlah + summary.deal.jumlah + summary.batal.jumlah
    : 1;
  const handleOpenDetail = async (nomor: string, fallbackData?: any) => {
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/penawaran?search=${encodeURIComponent(nomor)}&include_test=true`);
      if (res.ok) {
        const json = await res.json();
        const found = json.penawaran?.[0];
        if (found) {
          setSelectedDetailQuote({
            id: found.id,
            nomor: found.nomor,
            nama_klien: found.leads?.nama || fallbackData?.nama_klien || 'Klien',
            kota: found.leads?.kota || fallbackData?.kota || '-',
            admin_nama: found.users?.nama || fallbackData?.admin_nama || 'Admin',
            status: found.status,
            total_nilai: Number(found.total_nilai || fallbackData?.total_nilai || 0),
            subtotal_cermin: Number(found.ringkasan_json?.subtotal_cermin || 0),
            ongkir: Number(found.ringkasan_json?.ongkir?.deal || 0),
            pasang: Number(found.ringkasan_json?.pasang?.deal || 0),
            dp_50: Number(found.ringkasan_json?.dp_50 || 0),
            pelunasan: Number(found.ringkasan_json?.pelunasan || 0),
            items: Array.isArray(found.items_json) ? found.items_json : [],
            tanggal: new Date(found.created_at).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
          });
          return;
        }
      }
    } catch {} finally {
      setIsLoadingDetail(false);
    }

    if (fallbackData) {
      setSelectedDetailQuote({
        id: fallbackData.id || nomor,
        nomor,
        nama_klien: fallbackData.nama_klien || 'Klien',
        kota: fallbackData.kota || '-',
        admin_nama: fallbackData.admin_nama || 'Admin',
        status: fallbackData.status || 'terkirim',
        total_nilai: Number(fallbackData.total_nilai || fallbackData.nilai_deal || 0),
        subtotal_cermin: Number(fallbackData.total_nilai || fallbackData.nilai_deal || 0),
        ongkir: Number(fallbackData.nilai_deal || 0),
        pasang: 0,
        dp_50: Math.ceil(Number(fallbackData.total_nilai || fallbackData.nilai_deal || 0) / 2000) * 1000,
        pelunasan: Number(fallbackData.total_nilai || fallbackData.nilai_deal || 0) - Math.ceil(Number(fallbackData.total_nilai || fallbackData.nilai_deal || 0) / 2000) * 1000,
        items: [],
        tanggal: fallbackData.tanggal || 'Hari ini',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header: Judul & Filter (30px/800) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-[30px] font-extrabold text-ink leading-tight flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-accent" />
            <span>Dasbor Owner</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Metrik real-time closing rate, proyeksi omzet, dan kecepatan penawaran
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={rentang}
            onChange={(e) => setRentang(e.target.value as any)}
            className="px-3.5 py-2 min-h-[44px] bg-surface border border-line rounded-xl text-xs font-semibold text-ink focus:outline-none"
          >
            <option value="minggu_ini">Minggu ini</option>
            <option value="bulan_ini">Bulan ini</option>
            <option value="bulan_lalu">Bulan lalu</option>
            <option value="custom">90 hari terakhir</option>
          </select>

          <select
            value={kanal}
            onChange={(e) => setKanal(e.target.value)}
            className="px-3.5 py-2 min-h-[44px] bg-surface border border-line rounded-xl text-xs font-semibold text-ink focus:outline-none"
          >
            <option value="all">Semua kanal</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="shopee">Shopee</option>
          </select>

          <select
            value={adminId}
            onChange={(e) => setAdminId(e.target.value)}
            className="px-3.5 py-2 min-h-[44px] bg-surface border border-line rounded-xl text-xs font-semibold text-ink focus:outline-none"
          >
            <option value="all">Semua admin</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nama || a.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 text-center text-sm text-muted">
          Menghitung analitik di database...
        </div>
      ) : summary ? (
        <>
          {/* 1. Ringkasan dalam 1 Panel Bersekat */}
          <div className="bg-surface border border-line rounded-[20px] p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-line shadow-none">
            {/* Nilai Deal */}
            <div className="p-4 sm:p-5 space-y-1.5">
              <span className="text-xs font-semibold text-muted block">Nilai deal</span>
              <span className="text-[28px] font-extrabold text-ok tabular-nums leading-tight block">
                {formatRupiah(summary.deal.nilai)}
              </span>
              <p className="text-xs text-muted">
                {summary.deal.jumlah} pesanan deal (DP / lunas)
              </p>
            </div>

            {/* Sedang Berjalan */}
            <div className="p-4 sm:p-5 space-y-1.5">
              <span className="text-xs font-semibold text-muted block">Sedang berjalan</span>
              <span className="text-[28px] font-extrabold text-accent tabular-nums leading-tight block">
                {formatRupiah(summary.proses.nilai)}
              </span>
              <p className="text-xs text-muted">
                {summary.proses.jumlah} penawaran (terkirim / nego)
              </p>
            </div>

            {/* Closing Rate */}
            <div className="p-4 sm:p-5 space-y-1.5">
              <span className="text-xs font-semibold text-muted block">Closing rate</span>
              <span className="text-[28px] font-extrabold text-ink tabular-nums leading-tight block">
                {summary.closing_rate !== null ? `${summary.closing_rate}%` : '—'}
              </span>
              <p className="text-xs text-muted">
                dari deal + batal pada periode
              </p>
            </div>

            {/* Kecepatan Closing */}
            <div className="p-4 sm:p-5 space-y-1.5">
              <span className="text-xs font-semibold text-muted block">Kecepatan closing</span>
              <span className="text-[28px] font-extrabold text-ink tabular-nums leading-tight block">
                {summary.median_hari_deal !== null ? `${summary.median_hari_deal} hari` : '—'}
              </span>
              <p className="text-xs text-muted">
                median waktu dari terkirim ke deal
              </p>
            </div>
          </div>

          {/* 2. Bar Status Bertingkat (Draf / Terkirim / Nego / Deal / Batal) */}
          <div className="bg-surface border border-line rounded-[20px] p-6 space-y-4 shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-[17px] font-bold text-ink">Status Penawaran</h2>
              <span className="text-xs text-muted font-medium tabular-nums">
                Total {summary.dibuat.jumlah} penawaran masuk
              </span>
            </div>

            {/* Segmented Bar */}
            <div className="w-full h-3.5 bg-raised rounded-full overflow-hidden flex">
              <div
                className="bg-muted transition-all duration-300"
                style={{ width: `${Math.max(2, (summary.dibuat.jumlah / totalStatusCount) * 100)}%` }}
                title={`Draf: ${summary.dibuat.jumlah}`}
              />
              <div
                className="bg-accent transition-all duration-300"
                style={{ width: `${Math.max(2, (summary.proses.jumlah / totalStatusCount) * 100)}%` }}
                title={`Proses: ${summary.proses.jumlah}`}
              />
              <div
                className="bg-ok transition-all duration-300"
                style={{ width: `${Math.max(2, (summary.deal.jumlah / totalStatusCount) * 100)}%` }}
                title={`Deal: ${summary.deal.jumlah}`}
              />
              <div
                className="bg-warn transition-all duration-300"
                style={{ width: `${Math.max(2, (summary.batal.jumlah / totalStatusCount) * 100)}%` }}
                title={`Batal: ${summary.batal.jumlah}`}
              />
            </div>

            {/* Legenda & Angka */}
            <div className="flex flex-wrap items-center gap-6 pt-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-muted" />
                <span className="text-muted">Draf:</span>
                <span className="font-bold text-ink tabular-nums">{summary.dibuat.jumlah}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-accent" />
                <span className="text-muted">Proses (Terkirim / Nego):</span>
                <span className="font-bold text-ink tabular-nums">{summary.proses.jumlah}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-ok" />
                <span className="text-muted">Deal:</span>
                <span className="font-bold text-ink tabular-nums">{summary.deal.jumlah}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-warn" />
                <span className="text-muted">Batal / Kadaluwarsa:</span>
                <span className="font-bold text-ink tabular-nums">{summary.batal.jumlah}</span>
              </div>
            </div>
          </div>

          {/* 3. Grafik Mingguan: 2 Batang (--chart-1 penawaran, --chart-2 deal) */}
          {/* 3. Tren Penawaran vs Deal Mingguan (Dynamic Component + Zero CLS Skeleton) */}
          <WeeklyTrendChart chartData={chartData} />

          {/* 4. Tabel: Perlu Follow-Up & Potongan Minggu Ini */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Tabel Perlu Follow-Up (7 / 12) */}
            <div className="lg:col-span-7 bg-surface p-6 rounded-[20px] border border-line shadow-none space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="text-[17px] font-bold text-ink flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warn" />
                  <span>Perlu follow-up</span>
                </h3>
                <span className="text-xs text-muted tabular-nums font-semibold">
                  {followUpList.length} penawaran (≥ 3 hari tanpa update)
                </span>
              </div>

              {followUpList.length === 0 ? (
                <p className="text-sm text-muted py-8 text-center">
                  Semua penawaran aktif telah di-follow up dalam 3 hari terakhir.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-muted text-xs font-semibold">
                        <th className="py-2.5">Nomor</th>
                        <th className="py-2.5">Klien &amp; Kota</th>
                        <th className="py-2.5 text-right">Nilai</th>
                        <th className="py-2.5 text-center">Diam</th>
                        <th className="py-2.5 text-right">Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/40">
                      {followUpList.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => handleOpenDetail(item.nomor, item)}
                          className="hover:bg-raised transition cursor-pointer"
                        >
                          <td className="py-3 font-bold text-accent">{item.nomor}</td>
                          <td className="py-3">
                            <span className="font-semibold text-ink block">{item.nama_klien}</span>
                            <span className="text-xs text-muted">{item.kota}</span>
                          </td>
                          <td className="py-3 text-right tabular-nums font-bold text-ink">
                            {formatRupiah(item.total_nilai)}
                          </td>
                          <td className="py-3 text-center">
                            <span className="inline-block px-2.5 py-1 bg-warn-bg text-warn border border-warn/30 rounded-lg font-bold text-xs tabular-nums">
                              {item.hari_tanpa_perubahan} hari tanpa kabar
                            </span>
                          </td>
                          <td className="py-3 text-right text-muted text-xs font-semibold">{item.admin_nama}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Potongan Minggu Ini (5 / 12) */}
            <div className="lg:col-span-5 bg-surface p-6 rounded-[20px] border border-line shadow-none space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="text-[17px] font-bold text-ink flex items-center gap-2">
                  <Tag className="w-5 h-5 text-accent" />
                  <span>Potongan minggu ini</span>
                </h3>
                <span className="text-xs text-muted tabular-nums font-semibold">
                  {potonganList.length} potongan
                </span>
              </div>

              {potonganList.length === 0 ? (
                <p className="text-sm text-muted py-8 text-center">
                  Tidak ada potongan minggu ini.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {potonganList.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenDetail(item.nomor, item)}
                      className="p-3.5 bg-raised hover:bg-surface border border-line rounded-xl text-xs space-y-1.5 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-ink leading-snug">
                          {item.ringkasan_baris}
                        </span>
                        {item.di_bawah_net && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warn-bg text-warn border border-warn/30 shrink-0">
                            Di bawah net
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-muted text-[11px] pt-1 border-t border-line/40">
                        <span className="italic">Alasan: &ldquo;{item.alasan}&rdquo;</span>
                        <span>
                          {item.tanggal} · oleh <strong className="text-ink font-semibold">{item.admin_nama}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Modal Dialog: Detail Penawaran Baca Saja */}
          {selectedDetailQuote && (
            <div
              id="modal-detail-penawaran"
              className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
            >
              <div className="bg-surface border border-line rounded-[20px] max-w-lg w-full p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div>
                    <h3 className="font-bold text-ink text-base">
                      Detail Penawaran: {selectedDetailQuote.nomor}
                    </h3>
                    <p className="text-xs text-muted">
                      {selectedDetailQuote.tanggal} · oleh{' '}
                      <strong className="text-ink font-semibold">{selectedDetailQuote.admin_nama}</strong>
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg uppercase bg-raised border border-line text-accent">
                    {selectedDetailQuote.status}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3 p-3 bg-raised rounded-xl border border-line">
                    <div>
                      <span className="text-muted block">Nama Klien:</span>
                      <span className="font-bold text-ink text-sm block">
                        {selectedDetailQuote.nama_klien}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block">Kota Tujuan:</span>
                      <span className="font-semibold text-ink text-sm block">
                        {selectedDetailQuote.kota || '-'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3.5 bg-raised rounded-xl border border-line">
                    <div className="flex justify-between text-muted">
                      <span>Subtotal Cermin:</span>
                      <span className="font-semibold text-ink tabular-nums">
                        {formatRupiah(selectedDetailQuote.subtotal_cermin || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>Jasa Pengiriman:</span>
                      <span className="font-semibold text-ink tabular-nums">
                        {formatRupiah(selectedDetailQuote.ongkir || 0)}
                      </span>
                    </div>
                    {selectedDetailQuote.pasang > 0 && (
                      <div className="flex justify-between text-muted">
                        <span>Pemasangan:</span>
                        <span className="font-semibold text-ink tabular-nums">
                          {formatRupiah(selectedDetailQuote.pasang)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-ink pt-2 border-t border-line/60">
                      <span>Total Penawaran:</span>
                      <span className="text-accent tabular-nums">
                        {formatRupiah(selectedDetailQuote.total_nilai || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted pt-1">
                      <span>DP 50%: {formatRupiah(selectedDetailQuote.dp_50 || Math.ceil(selectedDetailQuote.total_nilai / 2000) * 1000)}</span>
                      <span>Pelunasan: {formatRupiah(selectedDetailQuote.pelunasan || (selectedDetailQuote.total_nilai - Math.ceil(selectedDetailQuote.total_nilai / 2000) * 1000))}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-line">
                  <button
                    type="button"
                    id="btn-tutup-detail-modal"
                    onClick={() => setSelectedDetailQuote(null)}
                    className="min-h-[44px] px-5 py-2 bg-raised hover:bg-surface border border-line text-ink rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Tutup (Baca Saja)
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
