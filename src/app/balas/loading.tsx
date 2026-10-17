import React from 'react';

export default function BalasLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="space-y-2">
          <div className="h-8 w-44 bg-surface rounded-xl" />
          <div className="h-4 w-72 bg-surface/60 rounded-md" />
        </div>
        <div className="h-10 w-32 bg-surface rounded-xl" />
      </div>

      {/* Follow-up reminder bar skeleton */}
      <div className="h-11 w-full bg-surface rounded-[18px]" />

      {/* Main 2-column Layout Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Kolom Kiri: Input */}
        <div className="bg-surface p-6 rounded-[20px] border border-line space-y-4">
          <div className="h-5 w-36 bg-raised rounded-md" />
          <div className="h-48 w-full bg-raised rounded-2xl" />
          <div className="h-11 w-full bg-raised rounded-xl" />
        </div>

        {/* Kolom Kanan: Draf Output */}
        <div className="bg-surface p-6 rounded-[20px] border border-line space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-40 bg-raised rounded-md" />
            <div className="h-6 w-24 bg-raised rounded-md" />
          </div>
          <div className="space-y-3">
            <div className="h-16 w-full bg-raised rounded-2xl" />
            <div className="h-20 w-3/4 bg-raised rounded-2xl" />
            <div className="h-12 w-5/6 bg-raised rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
