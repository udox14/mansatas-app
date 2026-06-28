'use client'

// Error boundary khusus route /dashboard.
// Tanpa ini, error client (mis. ChunkLoadError pasca-deploy, atau render error)
// memunculkan halaman generik "This page couldn't load" tanpa info.
// Boundary ini menampilkan pesan asli supaya mudah didiagnosa.

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface ke console browser (kebaca di DevTools / remote debug WebView)
    console.error('[dashboard error]', error)
  }, [error])

  const isChunkError = /ChunkLoadError|Loading chunk|dynamically imported module/i.test(
    error?.message || ''
  )

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="max-w-md space-y-2">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Dashboard gagal dimuat
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isChunkError
            ? 'Versi aplikasi berubah (kemungkinan baru deploy). Muat ulang untuk ambil versi terbaru.'
            : 'Terjadi kesalahan saat menampilkan dashboard.'}
        </p>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 p-3 text-left text-[11px] text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error?.message || 'Unknown error'}
          {error?.digest ? `\n\ndigest: ${error.digest}` : ''}
        </pre>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            if (isChunkError && typeof window !== 'undefined') {
              window.location.reload()
            } else {
              reset()
            }
          }}
          className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-medium text-white hover:bg-emerald-700"
        >
          Coba lagi
        </button>
        <a
          href="/dashboard"
          className="h-9 rounded-lg border border-surface px-4 text-xs font-medium leading-9 text-slate-600 hover:bg-surface-2 dark:text-slate-300"
        >
          Muat ulang penuh
        </a>
      </div>
    </div>
  )
}
