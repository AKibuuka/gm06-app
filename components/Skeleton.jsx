"use client";

export function SkeletonCard({ className = "" }) {
  return (
    <div className={`card animate-pulse ${className}`}>
      <div className="h-3 w-20 bg-surface-3 rounded mb-3" />
      <div className="h-6 w-32 bg-surface-3 rounded mb-2" />
      <div className="h-3 w-16 bg-surface-3 rounded" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-surface-3 animate-pulse">
      <div className="h-4 w-24 bg-surface-3 rounded" />
      <div className="h-4 w-20 bg-surface-3 rounded flex-1" />
      <div className="h-4 w-16 bg-surface-3 rounded" />
    </div>
  );
}

export function SkeletonPage({ cards = 4, rows = 5 }) {
  return (
    <div className="animate-in">
      <div className="mb-7">
        <div className="h-7 w-48 bg-surface-3 rounded animate-pulse mb-2" />
        <div className="h-4 w-32 bg-surface-3 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: cards }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="card p-0 overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    </div>
  );
}
