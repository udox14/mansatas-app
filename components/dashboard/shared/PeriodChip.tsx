'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { getDashboardPeriod, type LessonPattern } from '@/lib/dashboard-period'

export function PeriodChip({ patterns }: { patterns: LessonPattern[] }) {
  const [label, setLabel] = useState('Menghitung...')
  useEffect(() => {
    const update = () => setLabel(getDashboardPeriod(new Date(), patterns))
    const initial = window.setTimeout(update, 0)
    const timer = window.setInterval(update, 30_000)
    return () => { window.clearTimeout(initial); window.clearInterval(timer) }
  }, [patterns])
  return <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
    <Clock size={15} aria-hidden="true" /><span>{label}</span>
  </span>
}
