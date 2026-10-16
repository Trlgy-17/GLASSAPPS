'use client';

import React, { useEffect, useState } from 'react';
import { formatRupiah } from '@/lib/pricing/format-rupiah';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Filter,
  AlertTriangle,
  History,
  Tag,
  BarChart3,
  User,
} from 'lucide-react';

interface DashboardSummary {
  dibuat: { jumlah: number; nilai: number };
  proses: { jumlah: number; nilai: number };
  deal: { jumlah: number; nilai: number };
  batal: { jumlah: number; nilai: number; top_alasan: Array<{ alasan: string; jumlah: number }> };
  closing_rate: number | null;
  selesai_90h: number;
  closing_rate_90h: number | null;
  proyeksi_omzet: number;
  median_hari_deal: number | null;
}

interface FollowUpItem {
  id: string;
  nomor: string;
  nama_klien: string;
  kota: string;
  total_nilai: number;
  status: string;
  hari_tanpa_perubahan: number;
  admin_nama: string;
}

interface WeeklyChartItem {
  label_minggu: string;
  minggu_ke: string;
  total_penawaran: number;
  total_deal: number;
}

interface PotonganItem {
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

interface PriceLogItem {
  id: string;
  aktor: string;
  aksi: string;
  objek: string;
  sebelum?: unknown;
  sesudah?: unknown;
  alasan: string;
  created_at: string;
  users?: { nama: string; email: string };
}

interface AdminOption {
  id: string;
  nama: string;
  email: string;
}

export default function OwnerDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [periode, setPeriode] = useState('bulan_ini');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [kanal, setKanal] = useState('all');
  const [adminId, setAdminId] = useState('all');

  // Data
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [followUpList, setFollowUpList] = useState<FollowUpItem[]>([]);
  const [chartData, setChartData] = useState<WeeklyChartItem[]>([]);
  const [potonganList, setPotonganList] = useState<PotonganItem[]>([]);
  const [priceLogs, setPriceLogs] = useState<PriceLogItem[]>([]);
  const [admins, setAdmins] = useState<AdminOption[]>([]);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('periode', periode);
      if (kanal !== 'all') params.set('kanal', kanal);
      if (adminId !== 'all') params.set('admin_id', adminId);
      if (periode === 'custom') {
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
      }

      const res = await fetch(`/api/dasbor?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setFollowUpList(data.follow_up || []);
        setChartData(data.chart || []);
        setPotonganList(data.potongan_minggu_ini || []);
        setPriceLogs(data.perubahan_harga_terakhir || []);
        setAdmins(data.admins || []);
      }
    } catch (err) {
      console.error('Gagal mengambil data dasbor:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [periode, kanal, adminId, startDate, endDate]);

  // Hitung nilai tertinggi grafik untuk skala tinggi batang
  const maxChartVal = Math.max(
    1,
    ...chartData.map((c) => Math.max(c.total_penawaran, c.total_deal))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E3E7EE]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#253254] flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-[#275087]" /> Dasbor Analitik Owner
            </h1>
            <span className="text-xs bg-[#253254] text-white px-2.5 py-0.5 rounded font-medium">
              Read-Only
            </span>
          </div>
          <p className="text-sm text-[#6B7385] mt-1">
            Metrik penjualan real-time, closing rate, proyeksi omzet, dan kepatuhan harga
          </p>
        </div>

        {/* Filter Bar (Periode, Kanal, Admin) */}
        <div className="flex flex-wrap items-center gap-2.5 bg-white p-2 rounded-xl border border-[#E3E7EE] shadow-sm text-xs">
          <div className="flex items-center gap-1.5 px-2 text-[#6B7385]">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-semibold">Filter:</span>
          </div>

          {/* 1. Filter Periode */}
          <select
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            className="px-2.5 py-1.5 bg-[#F2F5F9] border border-[#E3E7EE] rounded font-medium text-[#253254] focus:outline-none"
          >
            <option value="minggu_ini">Minggu Ini</option>
            <option value="bulan_ini">Bulan Ini</option>
            <option value="bulan_lalu">Bulan Lalu</option>
            <option value="custom">Rentang Khusus</option>
          </select>

          {periode === 'custom' && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2 py-1 border border-[#E3E7EE] rounded text-xs"
              />
              <span className="text-[#98A0B0]">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2 py-1 border border-[#E3E7EE] rounded text-xs"
              />
            </div>
          )}

          {/* 2. Filter Kanal */}
          <select
            value={kanal}
            onChange={(e) => setKanal(e.target.value)}
            className="px-2.5 py-1.5 bg-[#F2F5F9] border border-[#E3E7EE] rounded font-medium text-[#253254] focus:outline-none"
          >
            <option value="all">Semua Kanal</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="shopee">Shopee</option>
          </select>

          {/* 3. Filter Admin */}
          <select
            value={adminId}
            onChange={(e) => setAdminId(e.target.value)}
            className="px-2.5 py-1.5 bg-[#F2F5F9] border border-[#E3E7EE] rounded font-medium text-[#253254] focus:outline-none"
          >
            <option value="all">Semua Admin</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email || a.nama}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-sm text-[#6B7385]">
          Menghitung analitik di database...
        </div>
      ) : summary ? (
        <>
          {/* Baris 1: Empat Kartu Status Utama */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Dibuat */}
            <div className="bg-white p-5 rounded-xl border border-[#E3E7EE] shadow-sm space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-[#6B7385] uppercase tracking-wider">
                <span>Penawaran Dibuat</span>
                <FileText className="w-4 h-4 text-[#275087]" />
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-2xl font-bold tabular-nums text-[#253254]">
                  {summary.dibuat.jumlah}
                </span>
                <span className="text-xs tabular-nums font-semibold text-[#6B7385]">
                  {formatRupiah(summary.dibuat.nilai)}
                </span>
              </div>
              <p className="text-[11px] text-[#98A0B0]">Total dokumen masuk pada periode</p>
            </div>

            {/* 2. Proses */}
            <div className="bg-white p-5 rounded-xl border border-[#E3E7EE] shadow-sm space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-blue-700 uppercase tracking-wider">
                <span>Sedang Proses</span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-2xl font-bold tabular-nums text-blue-900">
                  {summary.proses.jumlah}
                </span>
                <span className="text-xs tabular-nums font-semibold text-blue-700">
                  {formatRupiah(summary.proses.nilai)}
                </span>
              </div>
              <p className="text-[11px] text-[#6B7385]">Status Terkirim &amp; Nego aktif</p>
            </div>

            {/* 3. Deal */}
            <div className="bg-white p-5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-emerald-800 uppercase tracking-wider">
                <span>Deal (DP / Lunas)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-2xl font-bold tabular-nums text-emerald-900">
                  {summary.deal.jumlah}
                </span>
                <span className="text-xs tabular-nums font-bold text-emerald-700">
                  {formatRupiah(summary.deal.nilai)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700">Konfirmasi DP tanda jadi diterima</p>
            </div>

            {/* 4. Batal */}
            <div className="bg-white p-5 rounded-xl border border-red-200 bg-red-50/10 shadow-sm space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-red-800 uppercase tracking-wider">
                <span>Batal</span>
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-2xl font-bold tabular-nums text-red-900">
                  {summary.batal.jumlah}
                </span>
                <span className="text-xs tabular-nums font-semibold text-red-700">
                  {formatRupiah(summary.batal.nilai)}
                </span>
              </div>
              <div className="text-[10px] text-[#6B7385] pt-1">
                {summary.batal.top_alasan.length > 0 ? (
                  <span>Alasan: {summary.batal.top_alasan.map((a) => `${a.alasan} (${a.jumlah})`).join(', ')}</span>
                ) : (
                  <span>Belum ada pembatalan</span>
                )}
              </div>
            </div>
          </div>

          {/* Baris 2: Kartu Metrik Strategis */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Closing Rate */}
            <div className="bg-white p-5 rounded-xl border border-[#E3E7EE] shadow-sm space-y-2">
              <span className="text-xs font-bold text-[#6B7385] uppercase tracking-wider block">
                Closing Rate Periode
              </span>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-3xl font-extrabold tabular-nums text-[#253254]">
                  {summary.closing_rate !== null ? `${summary.closing_rate}%` : '–'}
                </span>
                <span className="text-[11px] text-[#6B7385]">
                  dari deal + batal + kadaluwarsa
                </span>
              </div>
              <div className="w-full bg-[#F2F5F9] h-2 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-[#275087] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, summary.closing_rate || 0)}%` }}
                />
              </div>
            </div>

            {/* Proyeksi Omzet Bulan Ini */}
            <div className="bg-white p-5 rounded-xl border border-[#E3E7EE] shadow-sm space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-[#6B7385] uppercase tracking-wider">
                  Proyeksi Omzet Bulan Ini
                </span>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded">
                  perkiraan
                </span>
              </div>
              <div className="pt-1">
                <span className="text-2xl font-bold tabular-nums text-[#253254] block">
                  {formatRupiah(summary.proyeksi_omzet)}
                </span>
                <span className="text-[11px] text-[#6B7385] mt-1 block">
                  {summary.closing_rate_90h !== null
                    ? `Nilai deal + (proses × ${summary.closing_rate_90h}% rate 90h)`
                    : 'Proyeksi aktif setelah 10 penawaran selesai'}
                </span>
              </div>
            </div>

            {/* Median Hari Deal */}
            <div className="bg-white p-5 rounded-xl border border-[#E3E7EE] shadow-sm space-y-2">
              <span className="text-xs font-bold text-[#6B7385] uppercase tracking-wider block">
                Kecepatan Closing (Median)
              </span>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-3xl font-extrabold tabular-nums text-[#253254]">
                  {summary.median_hari_deal !== null ? summary.median_hari_deal : '–'}
                </span>
                {summary.median_hari_deal !== null && (
                  <span className="text-xs font-semibold text-[#1B2233]">Hari</span>
                )}
                <span className="text-[11px] text-[#6B7385] ml-auto">
                  Terkirim → Deal DP
                </span>
              </div>
              <p className="text-[11px] text-[#98A0B0] pt-1">Rata-rata siklus pertimbangan klien</p>
            </div>
          </div>

          {/* Baris 3: Tabel Perlu Follow-Up & Potongan Minggu Ini */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Tabel Perlu Follow-Up (7 / 12) */}
            <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-[#E3E7EE] shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#F2F5F9] pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <h3 className="font-bold text-sm text-[#253254]">
                    Perlu Follow-Up (Tanpa Update ≥ 3 Hari)
                  </h3>
                </div>
                <span className="text-xs text-[#6B7385] tabular-nums font-semibold">
                  {followUpList.length} Penawaran
                </span>
              </div>

              {followUpList.length === 0 ? (
                <p className="text-xs text-[#6B7385] py-8 text-center">
                  Semua penawaran aktif telah di-follow up dalam 3 hari terakhir.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E3E7EE] text-[#98A0B0] uppercase text-[10px] font-bold">
                        <th className="py-2">Nomor</th>
                        <th className="py-2">Klien &amp; Kota</th>
                        <th className="py-2 text-right">Nilai</th>
                        <th className="py-2 text-center">Diam</th>
                        <th className="py-2 text-right">Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2F5F9]">
                      {followUpList.map((item) => (
                        <tr key={item.id} className="hover:bg-[#F2F5F9]/60">
                          <td className="py-2.5 font-bold text-[#253254]">
                            {item.nomor}
                          </td>
                          <td className="py-2.5">
                            <span className="font-medium text-[#1B2233] block">{item.nama_klien}</span>
                            <span className="text-[10px] text-[#6B7385]">{item.kota}</span>
                          </td>
                          <td className="py-2.5 text-right tabular-nums font-bold text-[#253254]">
                            {formatRupiah(item.total_nilai)}
                          </td>
                          <td className="py-2.5 text-center">
                            <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[10px] tabular-nums">
                              {item.hari_tanpa_perubahan} Hari
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-[#6B7385]">
                            {item.admin_nama}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Potongan Minggu Ini (5 / 12) */}
            <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-[#E3E7EE] shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#F2F5F9] pb-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#275087]" />
                  <h3 className="font-bold text-sm text-[#253254]">
                    Potongan Minggu Ini (Audit Log)
                  </h3>
                </div>
                <span className="text-xs bg-[#F2F5F9] text-[#253254] font-bold px-2 py-0.5 rounded tabular-nums">
                  {potonganList.length} Diskon
                </span>
              </div>

              {potonganList.length === 0 ? (
                <p className="text-xs text-[#6B7385] py-8 text-center">
                  Tidak ada potongan di bawah batas admin minggu ini.
                </p>
              ) : (
                <div className="space-y-3">
                  {potonganList.map((item) => {
                    const listVal = item.sebelum?.nilai_list || 0;
                    const dealVal = item.sesudah?.nilai_deal || 0;
                    const selisih = Math.max(0, listVal - dealVal);

                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-[#F2F5F9] rounded-lg border border-[#E3E7EE] text-xs space-y-1"
                      >
                        <div className="flex justify-between items-center font-bold text-[#253254]">
                          <span className="capitalize">{item.objek?.split(':')[2] || item.objek}</span>
                          <span className="tabular-nums text-red-600">-{formatRupiah(selisih)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-[#6B7385]">
                          <span>Admin: {item.users?.email || item.aktor}</span>
                          <span className="tabular-nums">Deal: {formatRupiah(dealVal)}</span>
                        </div>
                        <p className="text-[11px] text-[#1B2233] italic pt-1 border-t border-[#E3E7EE]">
                          "{item.alasan}"
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Baris 4: Grafik Batang Tren 8 Minggu */}
          <div className="bg-white p-6 rounded-xl border border-[#E3E7EE] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F2F5F9] pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#275087]" />
                <h3 className="font-bold text-sm text-[#253254]">
                  Tren Penawaran vs Deal Mingguan (8 Minggu Terakhir)
                </h3>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#275087]" />
                  <span className="text-[#6B7385]">Penawaran Dibuat</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-600" />
                  <span className="text-[#6B7385]">Deal (DP / Lunas)</span>
                </div>
              </div>
            </div>

            {chartData.length === 0 ? (
              <p className="text-xs text-[#6B7385] py-8 text-center">Data grafik belum cukup</p>
            ) : (
              <div className="pt-6 pb-2">
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-4 items-end h-44">
                  {chartData.map((c, i) => {
                    const penawaranHeightPercent = Math.round((c.total_penawaran / maxChartVal) * 100);
                    const dealHeightPercent = Math.round((c.total_deal / maxChartVal) * 100);

                    return (
                      <div key={i} className="flex flex-col items-center h-full justify-end group">
                        {/* Area Batang Kembar */}
                        <div className="flex items-end justify-center gap-1.5 w-full h-32 px-1 border-b border-[#E3E7EE]">
                          {/* Batang 1: Penawaran */}
                          <div className="flex flex-col items-center flex-1 h-full justify-end">
                            <span className="text-[10px] font-bold tabular-nums text-[#275087] mb-1">
                              {c.total_penawaran}
                            </span>
                            <div
                              className="w-full bg-[#275087] rounded-t transition-all duration-500 hover:brightness-110"
                              style={{
                                height: c.total_penawaran > 0 ? `${Math.max(8, (penawaranHeightPercent * 0.8))}%` : '2px',
                              }}
                            />
                          </div>

                          {/* Batang 2: Deal */}
                          <div className="flex flex-col items-center flex-1 h-full justify-end">
                            <span className="text-[10px] font-bold tabular-nums text-emerald-700 mb-1">
                              {c.total_deal}
                            </span>
                            <div
                              className="w-full bg-emerald-600 rounded-t transition-all duration-500 hover:brightness-110"
                              style={{
                                height: c.total_deal > 0 ? `${Math.max(8, (dealHeightPercent * 0.8))}%` : '2px',
                              }}
                            />
                          </div>
                        </div>

                        {/* Label Minggu */}
                        <span className="mt-2 text-[10px] font-semibold text-[#6B7385] whitespace-nowrap">
                          {c.label_minggu}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Baris 5: Panel Perubahan Harga Terakhir (Audit Log) */}
          <div className="bg-white p-6 rounded-xl border border-[#E3E7EE] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[#F2F5F9] pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#275087]" />
                <h3 className="font-bold text-sm text-[#253254]">
                  Perubahan Harga Terakhir (Audit Log)
                </h3>
              </div>
              <span className="text-xs text-[#6B7385]">Riwayat versi buku harga</span>
            </div>

            {priceLogs.length === 0 ? (
              <p className="text-xs text-[#6B7385] py-4 text-center">
                Belum ada riwayat perubahan buku harga tercatat.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E3E7EE] text-[#98A0B0] uppercase text-[10px] font-bold">
                      <th className="py-2">Waktu</th>
                      <th className="py-2">Pengubah</th>
                      <th className="py-2">Objek</th>
                      <th className="py-2">Alasan / Catatan Perubahan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2F5F9]">
                    {priceLogs.map((log) => {
                      const dateStr = new Date(log.created_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <tr key={log.id} className="hover:bg-[#F2F5F9]/50">
                          <td className="py-2.5 font-medium tabular-nums text-[#6B7385]">{dateStr}</td>
                          <td className="py-2.5 font-semibold text-[#1B2233]">
                            {log.users?.email || log.aktor}
                          </td>
                          <td className="py-2.5 font-bold text-[#275087] uppercase">
                            {log.objek}
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
        </>
      ) : null}
    </div>
  );
}
