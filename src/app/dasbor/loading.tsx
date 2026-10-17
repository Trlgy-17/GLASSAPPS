import React from 'react';

export default function DasborLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="space-y-2">
          <div className="h-8 w-44 bg-surface rounded-xl" />
          <div className="h-4 w-72 bg-surface/60 rounded-md" />
        </div>
        <div className="flex gap-2.5">
          <div className="h-11 w-40 bg-surface rounded-xl" />
          <div className="h-11 w-32 bg-surface rounded-xl" />
        </div>
      </div>

      {/* 4 Cards Skeleton */}
      <div className="bg-surface border border-line rounded-[20px] p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 space-y-2">
            <div className="h-3.5 w-24 bg-raised rounded" />
            <div className="h-8 w-36 bg-raised rounded-lg" />
            <div className="h-3 w-28 bg-raised rounded" />
          </div>
        ))}
      </div>

      {/* Charts & Follow-up Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-surface p-6 rounded-[20px] border border-line space-y-4">
          <div className="h-5 w-48 bg-raised rounded-md" />
          <div className="h-64 w-full bg-raised rounded-2xl" />
        </div>
        <div className="lg:col-span-4 bg-surface p-6 rounded-[20px] border border-line space-y-4">
          <div className="h-5 w-36 bg-raised rounded-md" />
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 w-full bg-raised rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
