'use client';

import React, { useEffect, useState } from 'react';
import { formatRupiah } from '@/lib/pricing/format-rupiah';
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

interface WeeklyChartItem {
  label_minggu: string;
  total_penawaran: number;
  total_deal: number;
}

interface PotonganItem {
  id: string;
  aktor: string;
  objek: string;
  sebelum: any;
  sesudah: any;
  alasan: string;
  created_at: string;
}

interface PriceBookAuditLog {
  id: string;
  aktor: string;
  aksi: string;
  created_at: string;
  alasan: string;
  sesudah: any;
}

export default function DasborPage() {
  const [summary, setSummary] = useState<DasborSummary | null>(null);
  const [followUpList, setFollowUpList] = useState<FollowUpItem[]>([]);
  const [chartData, setChartData] = useState<WeeklyChartItem[]>([]);
  const [potonganList, setPotonganList] = useState<PotonganItem[]>([]);
  const [priceBookLogs, setPriceBookLogs] = useState<PriceBookAuditLog[]>([]);
  const [admins, setAdmins] = useState<Array<{ id: string; nama: string; email: string }>>([]);

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
          setPriceBookLogs(json.perubahan_harga_terakhir || []);
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
          <div className="bg-surface border border-line rounded-[20px] p-6 space-y-4 shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <h2 className="text-[17px] font-bold text-ink flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-accent" />
                  <span>Tren Penawaran vs Deal Mingguan</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">8 minggu terakhir</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-chart-1" />
                    <span className="text-muted">Penawaran</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-chart-2" />
                    <span className="text-muted">Deal</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTableModal(!showTableModal)}
                  className="min-h-[44px] px-3.5 py-1.5 bg-raised hover:bg-tint text-ink border border-line rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <TableIcon className="w-4 h-4" />
                  <span>{showTableModal ? 'Tutup tabel' : 'Lihat tabel'}</span>
                </button>
              </div>
            </div>

            {/* Modal Tabel jika tombol 'Lihat tabel' diklik */}
            {showTableModal && (
              <div className="p-4 bg-raised border border-line rounded-[18px] overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line text-muted text-xs font-semibold">
                      <th className="py-2">Minggu</th>
                      <th className="py-2 text-right">Penawaran Dibuat</th>
                      <th className="py-2 text-right">Deal (DP / Lunas)</th>
                      <th className="py-2 text-right">Rasio Deal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {chartData.map((c, i) => {
                      const ratio = c.total_penawaran > 0 ? Math.round((c.total_deal / c.total_penawaran) * 100) : 0;
                      return (
                        <tr key={i} className="hover:bg-surface">
                          <td className="py-2.5 font-semibold text-ink">{c.label_minggu}</td>
                          <td className="py-2.5 text-right font-bold text-chart-1 tabular-nums">{c.total_penawaran}</td>
                          <td className="py-2.5 text-right font-bold text-chart-2 tabular-nums">{c.total_deal}</td>
                          <td className="py-2.5 text-right font-semibold text-muted tabular-nums">{ratio}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Grafik Batang */}
            {chartData.length === 0 ? (
              <p className="text-xs text-muted py-8 text-center">Data grafik belum cukup</p>
            ) : (
              <div className="pt-6 pb-2">
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-4 items-end h-48">
                  {chartData.map((c, i) => {
                    const penawaranHeight = Math.round((c.total_penawaran / maxChartVal) * 100);
                    const dealHeight = Math.round((c.total_deal / maxChartVal) * 100);

                    return (
                      <div key={i} className="flex flex-col items-center h-full justify-end group">
                        <div className="flex items-end justify-center gap-1.5 w-full h-36 px-1 border-b border-line">
                          {/* Batang 1: Penawaran */}
                          <div className="flex flex-col items-center flex-1 h-full justify-end">
                            <span className="text-[11px] font-bold tabular-nums text-chart-1 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {c.total_penawaran}
                            </span>
                            <div
                              className="w-full bg-chart-1 rounded-t transition-all duration-300 hover:brightness-110"
                              style={{
                                height: c.total_penawaran > 0 ? `${Math.max(10, penawaranHeight * 0.85)}%` : '2px',
                              }}
                              title={`Penawaran: ${c.total_penawaran}`}
                            />
                          </div>

                          {/* Batang 2: Deal */}
                          <div className="flex flex-col items-center flex-1 h-full justify-end">
                            <span className="text-[11px] font-bold tabular-nums text-chart-2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {c.total_deal}
                            </span>
                            <div
                              className="w-full bg-chart-2 rounded-t transition-all duration-300 hover:brightness-110"
                              style={{
                                height: c.total_deal > 0 ? `${Math.max(10, dealHeight * 0.85)}%` : '2px',
                              }}
                              title={`Deal: ${c.total_deal}`}
                            />
                          </div>
                        </div>

                        <span className="mt-2.5 text-xs font-semibold text-muted whitespace-nowrap">
                          {c.label_minggu}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

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
                        <tr key={item.id} className="hover:bg-raised transition">
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
                              {item.hari_tanpa_perubahan} hari
                            </span>
                          </td>
                          <td className="py-3 text-right text-muted text-xs">{item.admin_nama}</td>
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
                  {potonganList.length} diskon
                </span>
              </div>

              {potonganList.length === 0 ? (
                <p className="text-sm text-muted py-8 text-center">
                  Tidak ada potongan di bawah batas admin minggu ini.
                </p>
              ) : (
                <div className="space-y-3">
                  {potonganList.map((item) => {
                    const listVal = item.sebelum?.nilai_list || 0;
                    const dealVal = item.sesudah?.nilai_deal || 0;
                    const selisih = Math.max(0, listVal - dealVal);

                    return (
                      <div key={item.id} className="p-3.5 bg-raised rounded-xl border border-line text-sm space-y-1.5">
                        <div className="flex justify-between items-center font-bold text-ink">
                          <span className="capitalize">{item.objek?.split(':')[2] || item.objek}</span>
                          <span className="tabular-nums text-warn">-{formatRupiah(selisih)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted">
                          <span>Oleh: {item.aktor}</span>
                          <span className="tabular-nums">{new Date(item.created_at).toLocaleDateString('id-ID')}</span>
                        </div>
                        <p className="text-xs text-muted italic pt-1 border-t border-line">
                          &ldquo;{item.alasan}&rdquo;
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 5. Perubahan Harga Terakhir (Audit Log) */}
          <div className="bg-surface p-6 rounded-[20px] border border-line shadow-none space-y-4">
            <h3 className="text-[17px] font-bold text-ink">Perubahan Harga Terakhir</h3>
            {priceBookLogs.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">Belum ada riwayat audit buku harga</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-muted text-xs font-semibold">
                      <th className="py-2.5">Waktu</th>
                      <th className="py-2.5">Aktor</th>
                      <th className="py-2.5">Aksi</th>
                      <th className="py-2.5">Catatan Perubahan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {priceBookLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-raised transition">
                        <td className="py-3 text-xs text-muted tabular-nums">
                          {new Date(log.created_at).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 font-semibold text-ink">{log.aktor}</td>
                        <td className="py-3 font-semibold text-accent">{log.aksi}</td>
                        <td className="py-3 text-muted text-xs">{log.alasan || 'Pembaruan parameter buku harga'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
