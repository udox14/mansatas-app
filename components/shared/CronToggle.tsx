'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Toggle aktif/nonaktif pemrosesan otomatis per modul (cron).
// Mengubah system_settings via server action, lalu refresh server components.
export function CronToggle({
  enabled,
  onToggle,
  title,
  description,
}: {
  enabled: boolean
  onToggle: (enabled: boolean) => Promise<{ success?: string; error?: string }>
  title: string
  description: string
}) {
  const router = useRouter()
  const [current, setCurrent] = useState(enabled)
  const [isPending, startTransition] = useTransition()
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)

  const handleToggle = () => {
    startTransition(async () => {
      const res = await onToggle(!current)
      if (!res.error) setCurrent(!current)
      setPesan({ ok: !res.error, teks: res.success || res.error || '' })
      router.refresh()
      setTimeout(() => setPesan(null), 4000)
    })
  }

  return (
    <div className={cn(
      'rounded-xl border p-4 flex flex-col gap-3 transition-opacity',
      current ? 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800' : 'bg-slate-50 border-slate-200 opacity-80 dark:bg-slate-900/60 dark:border-slate-800'
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
            <span className={cn(
              'text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase shrink-0',
              current ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-800'
            )}>
              {current ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          className={cn(
            'shrink-0 h-8 flex items-center gap-1.5 text-xs font-semibold px-3 rounded-lg transition-colors',
            current
              ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-900'
              : 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900'
          )}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {current ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
      </div>
      {pesan && (
        <div className={cn('text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5',
          pesan.ok ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 border-rose-200 text-rose-700')}>
          {pesan.ok ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <AlertCircle className="h-3 w-3 shrink-0" />}
          {pesan.teks}
        </div>
      )}
    </div>
  )
}
