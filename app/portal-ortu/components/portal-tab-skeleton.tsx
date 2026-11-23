'use client'

import { ArrowsClockwise } from '@phosphor-icons/react'

export type PortalLazyTabVariant =
  | 'jadwal'
  | 'kehadiran'
  | 'kedisiplinan'
  | 'nilai'
  | 'psikotes'
  | 'keuangan-detail'
  | 'saran-list'
  | 'dokumentasi'

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-[#E8E5E0] ${className}`} />
}

export function PortalTabRetryCard({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#D8D4CC] bg-white px-5 py-8 text-center">
      <p className="text-sm font-semibold text-[#1A1A18]">{message || 'Gagal memuat data bagian ini.'}</p>
      <p className="text-xs text-[#6B6B63]">Periksa koneksi internet Anda lalu coba muat ulang.</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D8D4CC] bg-[#FAF9F7] px-4 py-2 text-xs font-semibold text-[#1A1A18] transition-colors hover:border-[#C2522D]/50 hover:bg-[#F2F0EC]"
      >
        <ArrowsClockwise className="h-4 w-4 text-[#C2522D]" />
        Muat ulang
      </button>
    </div>
  )
}

export function PortalTabSkeleton({ variant }: { variant: PortalLazyTabVariant }) {
  if (variant === 'keuangan-detail' || variant === 'saran-list') {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Memuat data...">
        {[0, 1].map((idx) => (
          <div key={idx} className="rounded-2xl border border-[#D8D4CC] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <SkeletonBar className="h-4 w-40" />
              <SkeletonBar className="h-5 w-20 rounded-full" />
            </div>
            <SkeletonBar className="mt-3 h-3 w-3/4" />
            <SkeletonBar className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'kehadiran') {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Memuat data kehadiran...">
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 sm:gap-3">
          <div className="col-span-3 rounded-2xl border border-[#D8D4CC] bg-[#E8E5E0]/55 p-5 sm:col-span-2">
            <SkeletonBar className="h-3 w-28" />
            <SkeletonBar className="mt-3 h-9 w-20" />
            <SkeletonBar className="mt-4 h-3 w-full" />
          </div>
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="rounded-2xl border border-[#D8D4CC] bg-white p-3.5 sm:p-4">
              <SkeletonBar className="h-8 w-8 rounded-lg" />
              <SkeletonBar className="mt-3 h-7 w-10" />
              <SkeletonBar className="mt-2 h-3 w-14" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[#D8D4CC] bg-white p-5">
          <SkeletonBar className="h-5 w-44" />
          <div className="mt-4 grid grid-cols-7 gap-2">
            {Array.from({ length: 28 }).map((_, idx) => (
              <SkeletonBar key={idx} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'nilai') {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Memuat nilai akademik...">
        <div className="flex flex-col items-center rounded-2xl border border-[#D8D4CC] bg-white p-6">
          <SkeletonBar className="h-12 w-12 rounded-full" />
          <SkeletonBar className="mt-4 h-3.5 w-44" />
          <SkeletonBar className="mt-3 h-10 w-24" />
        </div>
        {[0, 1, 2].map((idx) => (
          <div key={idx} className="flex items-center justify-between rounded-2xl border border-[#D8D4CC] bg-white p-4">
            <div className="space-y-2">
              <SkeletonBar className="h-4 w-28" />
              <SkeletonBar className="h-3 w-36" />
            </div>
            <SkeletonBar className="h-8 w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'psikotes') {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Memuat hasil psikotes...">
        <div className="rounded-2xl border border-[#D8D4CC] bg-white p-5">
          <div className="flex items-center gap-3">
            <SkeletonBar className="h-11 w-11 rounded-xl" />
            <div className="space-y-2">
              <SkeletonBar className="h-5 w-40" />
              <SkeletonBar className="h-3 w-64" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="rounded-2xl border border-[#D8D4CC] bg-white p-4">
              <SkeletonBar className="h-3 w-20" />
              <SkeletonBar className="mt-3 h-7 w-16" />
              <SkeletonBar className="mt-2 h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((idx) => (
            <div key={idx} className="rounded-2xl border border-[#D8D4CC] bg-white p-5">
              <SkeletonBar className="h-4 w-44" />
              <SkeletonBar className="mt-4 h-48 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (variant === 'dokumentasi') {
    return (
      <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]" aria-busy="true" aria-label="Memuat dokumentasi...">
        <div className="hidden space-y-2 md:block">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="rounded-2xl border border-[#D8D4CC] bg-white p-4">
              <SkeletonBar className="h-4 w-32" />
              <SkeletonBar className="mt-2 h-3 w-full" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-[#D8D4CC] bg-white p-6">
          <SkeletonBar className="h-3 w-20" />
          <SkeletonBar className="mt-2 h-6 w-56" />
          <SkeletonBar className="mt-4 h-3.5 w-full" />
          <SkeletonBar className="mt-2 h-3.5 w-5/6" />
          <SkeletonBar className="mt-2 h-3.5 w-2/3" />
        </div>
      </div>
    )
  }

  if (variant === 'kedisiplinan') {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Memuat kedisiplinan...">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="rounded-2xl border border-[#D8D4CC] bg-white p-4">
              <SkeletonBar className="h-3 w-20" />
              <SkeletonBar className="mt-2 h-6 w-12" />
            </div>
          ))}
        </div>
        {[0, 1].map((idx) => (
          <div key={idx} className="rounded-2xl border border-[#D8D4CC] bg-white p-4">
            <SkeletonBar className="h-4 w-48" />
            <SkeletonBar className="mt-2 h-3 w-36" />
          </div>
        ))}
      </div>
    )
  }

  // 'jadwal'
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Memuat jadwal pelajaran...">
      <div className="rounded-2xl border border-[#D8D4CC] bg-[#F2F0EC] p-2">
        <div className="grid grid-cols-6 gap-2">
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <SkeletonBar key={idx} className="h-9 w-full bg-white/80" />
          ))}
        </div>
      </div>
      {[0, 1, 2].map((idx) => (
        <div key={idx} className="rounded-2xl border border-[#D8D4CC] bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <SkeletonBar className="h-5 w-24" />
            <SkeletonBar className="h-4 w-20" />
          </div>
          <SkeletonBar className="mt-3 h-4 w-44" />
          <SkeletonBar className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  )
}
