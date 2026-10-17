import React from 'react';

export default function PengaturanLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-surface rounded-xl" />
          <div className="h-4 w-72 bg-surface/60 rounded-md" />
        </div>
        <div className="h-11 w-40 bg-surface rounded-xl" />
      </div>

      {/* Settings Form Skeleton */}
      <div className="space-y-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface p-6 rounded-[20px] border border-line space-y-4">
            <div className="h-5 w-48 bg-raised rounded-md" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-10 w-full bg-raised rounded-xl" />
              <div className="h-10 w-full bg-raised rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
