import React from 'react';

export default function KalkulatorLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-surface rounded-xl" />
          <div className="h-4 w-72 bg-surface/60 rounded-md" />
        </div>
        <div className="h-10 w-28 bg-surface rounded-xl" />
      </div>

      {/* Calculator 2-column Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: Form Input */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-surface p-6 rounded-[20px] border border-line space-y-4">
            <div className="h-5 w-40 bg-raised rounded-md" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-10 w-full bg-raised rounded-xl" />
              <div className="h-10 w-full bg-raised rounded-xl" />
            </div>
            <div className="h-28 w-full bg-raised rounded-xl" />
          </div>

          <div className="bg-surface p-6 rounded-[20px] border border-line space-y-4">
            <div className="h-5 w-36 bg-raised rounded-md" />
            <div className="h-32 w-full bg-raised rounded-xl" />
          </div>
        </div>

        {/* Kolom Kanan: Rangkuman & Total */}
        <div className="lg:col-span-5 bg-surface p-6 rounded-[20px] border border-line space-y-5">
          <div className="h-6 w-48 bg-raised rounded-md" />
          <div className="space-y-3 py-3 border-y border-line">
            <div className="flex justify-between"><div className="h-4 w-28 bg-raised rounded" /><div className="h-4 w-20 bg-raised rounded" /></div>
            <div className="flex justify-between"><div className="h-4 w-24 bg-raised rounded" /><div className="h-4 w-16 bg-raised rounded" /></div>
            <div className="flex justify-between"><div className="h-4 w-32 bg-raised rounded" /><div className="h-4 w-20 bg-raised rounded" /></div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <div className="h-5 w-24 bg-raised rounded" />
            <div className="h-8 w-36 bg-raised rounded-lg" />
          </div>
          <div className="h-12 w-full bg-raised rounded-xl" />
        </div>
      </div>
    </div>
  );
}
