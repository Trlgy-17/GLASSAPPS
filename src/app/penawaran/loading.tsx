import React from 'react';

export default function PenawaranLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="space-y-2">
          <div className="h-8 w-52 bg-surface rounded-xl" />
          <div className="h-4 w-80 bg-surface/60 rounded-md" />
        </div>
        <div className="h-11 w-44 bg-surface rounded-xl" />
      </div>

      {/* 5 Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 bg-surface rounded-[20px] border border-line space-y-2">
            <div className="h-3 w-16 bg-raised rounded" />
            <div className="h-7 w-20 bg-raised rounded-lg" />
            <div className="h-2.5 w-24 bg-raised rounded" />
          </div>
        ))}
      </div>

      {/* Search & Filter Bar Skeleton */}
      <div className="bg-surface p-4 rounded-[20px] border border-line flex flex-col md:flex-row gap-3.5 justify-between">
        <div className="h-11 w-full md:w-80 bg-raised rounded-xl" />
        <div className="flex gap-2.5">
          <div className="h-11 w-44 bg-raised rounded-xl" />
          <div className="h-11 w-36 bg-raised rounded-xl" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-surface rounded-[20px] border border-line p-5 space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-line/40">
            <div className="space-y-1.5 w-1/4">
              <div className="h-4 w-32 bg-raised rounded" />
              <div className="h-3 w-20 bg-raised rounded" />
            </div>
            <div className="space-y-1.5 w-1/4">
              <div className="h-4 w-28 bg-raised rounded" />
              <div className="h-3 w-16 bg-raised rounded" />
            </div>
            <div className="h-4 w-20 bg-raised rounded" />
            <div className="h-6 w-24 bg-raised rounded-lg" />
            <div className="h-8 w-16 bg-raised rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
