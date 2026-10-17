'use client';

import React, { useState } from 'react';
import { BarChart3, Table as TableIcon } from 'lucide-react';

export interface WeeklyChartItem {
  label_minggu: string;
  total_penawaran: number;
  total_deal: number;
}

interface WeeklyTrendChartProps {
  chartData: WeeklyChartItem[];
}

export function WeeklyTrendChartSkeleton() {
  return (
    <div className="bg-surface border border-line rounded-[20px] p-6 space-y-4 shadow-none min-h-[320px] animate-pulse">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="h-5 w-44 bg-raised rounded" />
        <div className="h-7 w-20 bg-raised rounded-xl" />
      </div>
      <div className="pt-6 pb-2">
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-4 items-end h-48">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center h-full justify-end gap-2">
              <div className="w-full bg-raised rounded-t h-28" />
              <div className="w-10 h-3 bg-raised rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WeeklyTrendChart({ chartData }: WeeklyTrendChartProps) {
  const [showTableModal, setShowTableModal] = useState(false);

  const maxChartVal = Math.max(
    1,
    ...chartData.map((c) => Math.max(c.total_penawaran, c.total_deal))
  );

  return (
    <div className="bg-surface border border-line rounded-[20px] p-6 space-y-4 shadow-none min-h-[320px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 className="text-[17px] font-bold text-ink flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent" />
            <span>Tren Penawaran vs Deal (8 Minggu Terakhir)</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Komparasi volume draf penawaran yang dibuat dengan penawaran yang berhasil deal
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Legenda Grafik */}
          <div className="flex items-center gap-3 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-chart-1" />
              <span className="text-muted">Penawaran</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-chart-2" />
              <span className="text-muted">Deal</span>
            </div>
          </div>

          <button
            onClick={() => setShowTableModal(!showTableModal)}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-line bg-raised hover:bg-surface text-ink transition cursor-pointer"
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>{showTableModal ? 'Tutup Tabel' : 'Buka Tabel'}</span>
          </button>
        </div>
      </div>

      {/* Tabel Data Agregat Mingguan */}
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
                const ratio =
                  c.total_penawaran > 0
                    ? Math.round((c.total_deal / c.total_penawaran) * 100)
                    : 0;
                return (
                  <tr key={i} className="hover:bg-surface">
                    <td className="py-2.5 font-semibold text-ink">{c.label_minggu}</td>
                    <td className="py-2.5 text-right font-bold text-chart-1 tabular-nums">
                      {c.total_penawaran}
                    </td>
                    <td className="py-2.5 text-right font-bold text-chart-2 tabular-nums">
                      {c.total_deal}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-muted tabular-nums">
                      {ratio}%
                    </td>
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
                          height:
                            c.total_penawaran > 0
                              ? `${Math.max(10, penawaranHeight * 0.85)}%`
                              : '2px',
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
                          height:
                            c.total_deal > 0
                              ? `${Math.max(10, dealHeight * 0.85)}%`
                              : '2px',
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
  );
}
