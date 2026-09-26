'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, LockKeyhole, X } from 'lucide-react'
import type { AgendaAccessWarning } from '@/lib/agenda-access-audit'

export function AgendaAccessSecurityBanner({ warning, userId }: { warning: AgendaAccessWarning | null; userId: string }) {
  const [dismissed, setDismissed] = useState(false)
  const dismissalKey = warning ? `mansatas_agenda_access_warning_dismissed:${userId}` : null

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setDismissed(Boolean(
          warning && !warning.isBlocked && dismissalKey &&
          window.localStorage.getItem(dismissalKey) === warning.detectedAt
        ))
      } catch {
        setDismissed(false)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [dismissalKey, warning])

  if (!warning || (dismissed && !warning.isBlocked)) return null

  function dismiss() {
    if (!warning || warning.isBlocked || !dismissalKey) return
    try {
      window.localStorage.setItem(dismissalKey, warning.detectedAt)
    } catch {
      // Tetap tutup untuk sesi halaman ini jika penyimpanan browser tidak tersedia.
    }
    setDismissed(true)
  }

  return (
    <div className={`relative rounded-xl border px-4 py-3 text-sm ${warning.isBlocked
      ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-100'
      : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100'
    }`}>
      {!warning.isBlocked && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Tutup peringatan"
          title="Tutup peringatan"
          className="absolute right-2 top-2 rounded-md p-1.5 text-amber-800 transition-colors hover:bg-amber-100 hover:text-amber-950 dark:text-amber-200 dark:hover:bg-amber-900/70 dark:hover:text-amber-50"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div className={`flex items-start gap-3 ${warning.isBlocked ? '' : 'pr-8'}`}>
        {warning.isBlocked ? <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
        <div className="space-y-1">
          <p className="font-semibold">{warning.isBlocked ? 'Pengisian Agenda Guru diblokir' : 'Pergantian akun mencurigakan terdeteksi'}</p>
          <p>
            {warning.isBlocked
              ? `Akun Anda sementara tidak dapat mengisi Agenda Guru.${warning.blockReason ? ` Alasan: ${warning.blockReason}` : ''}`
              : 'Sistem mendeteksi perangkat yang sama digunakan untuk berganti akun dalam waktu berdekatan. Aktivitas ini telah dicatat sebagai bahan pemeriksaan pengelola.'}
          </p>
        </div>
      </div>
    </div>
  )
}
