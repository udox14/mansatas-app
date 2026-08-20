'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, ChevronRight, Clock3 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type {
  TeacherAttendanceItem,
  TeacherAttendanceStatus,
  TeacherAttendanceSummary,
} from '@/lib/teacher-attendance'

type DetailStatus = Extract<TeacherAttendanceStatus, 'SAKIT' | 'IZIN' | 'ALFA'>

const STATUS_META: Record<DetailStatus, { label: string; color: string; bg: string; dot: string }> = {
  SAKIT: { label: 'Sakit', color: 'text-amber-600', bg: 'hover:bg-amber-50 dark:hover:bg-amber-900/20', dot: 'bg-amber-500' },
  IZIN: { label: 'Izin', color: 'text-blue-600', bg: 'hover:bg-blue-50 dark:hover:bg-blue-900/20', dot: 'bg-blue-500' },
  ALFA: { label: 'Alfa', color: 'text-rose-600', bg: 'hover:bg-rose-50 dark:hover:bg-rose-900/20', dot: 'bg-rose-500' },
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function jamLabel(item: TeacherAttendanceItem) {
  const jamKe = item.jamKeMulai === item.jamKeSelesai
    ? `Jam ke-${item.jamKeMulai}`
    : `Jam ke-${item.jamKeMulai}-${item.jamKeSelesai}`
  return item.slotMulai && item.slotSelesai
    ? `${jamKe} · ${item.slotMulai}-${item.slotSelesai}`
    : jamKe
}

export function KehadiranPribadiCardClient({
  month,
  monthLabel,
  subtitle,
  summary,
  items,
}: {
  month: string
  monthLabel: string
  subtitle: string
  summary: TeacherAttendanceSummary
  items: TeacherAttendanceItem[]
}) {
  const [detailStatus, setDetailStatus] = useState<DetailStatus | null>(null)
  const pct = summary.total > 0 ? Math.round((summary.hadir / summary.total) * 100) : null
  const pctColor = pct === null ? 'text-slate-400' : pct >= 90 ? 'text-emerald-600' : pct >= 75 ? 'text-amber-600' : 'text-rose-600'
  const detailItems = detailStatus ? items.filter(item => item.status === detailStatus) : []
  const detailMeta = detailStatus ? STATUS_META[detailStatus] : null

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-surface bg-surface shadow-sm">
        <div className="flex items-center gap-2 border-b border-surface-2 px-4 py-3">
          <div className="rounded-md border border-emerald-100 bg-emerald-50 p-1.5 dark:border-emerald-800 dark:bg-emerald-900/20">
            <BookOpen className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Performa Kehadiran</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">{subtitle}</p>
          </div>
          {pct !== null && <span className={`text-xl font-bold tabular-nums ${pctColor}`}>{pct}%</span>}
        </div>

        {summary.total === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-6">
            <p className="text-xs text-slate-400 dark:text-slate-500">Tidak ada kewajiban agenda pada periode ini</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800">
            <div className="flex flex-col items-center gap-0.5 py-3">
              <span className="text-xl font-bold leading-none tabular-nums text-emerald-600">{summary.hadir}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Hadir</span>
            </div>
            {(['SAKIT', 'IZIN', 'ALFA'] as const).map(status => {
              const meta = STATUS_META[status]
              const value = status === 'SAKIT' ? summary.sakit : status === 'IZIN' ? summary.izin : summary.alfa
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => value > 0 && setDetailStatus(status)}
                  disabled={value === 0}
                  className={`flex flex-col items-center gap-0.5 py-3 transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 ${value > 0 ? `${meta.bg} cursor-pointer` : 'cursor-default'}`}
                  aria-label={value > 0 ? `Lihat ${value} rincian ${meta.label.toLowerCase()}` : `Tidak ada catatan ${meta.label.toLowerCase()}`}
                >
                  <span className={`text-xl font-bold leading-none tabular-nums ${meta.color} ${value > 0 ? 'underline decoration-dotted underline-offset-4' : ''}`}>{value}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{meta.label}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className={`flex items-center justify-between gap-2 border-t border-surface-2 px-4 py-2 ${summary.telat > 0 ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}`}>
          <div className="flex items-center gap-1.5">
            {summary.telat > 0 && <Clock3 className="h-3 w-3 shrink-0 text-amber-500" />}
            <p className={`text-[10px] ${summary.telat > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {summary.telat > 0 ? <>Terlambat <span className="font-bold">{summary.telat}×</span> sesi mengajar bulan ini</> : 'Ringkasan kehadiran bulan ini'}
            </p>
          </div>
          <Link
            href={`/dashboard/agenda?tab=riwayat&bulan=${month}`}
            className="group inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold text-emerald-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-400"
          >
            Lihat detail
            <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <Dialog open={detailStatus !== null} onOpenChange={open => !open && setDetailStatus(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md gap-3 rounded-xl p-0">
          <DialogHeader className="border-b px-4 pb-3 pt-4 text-left">
            <DialogTitle className="flex items-center gap-2 text-base">
              {detailMeta && <span className={`h-2.5 w-2.5 rounded-full ${detailMeta.dot}`} />}
              Rincian {detailMeta?.label}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {detailItems.length} sesi pada {monthLabel} · tanggal, kelas, dan jam pelajaran.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[65dvh] divide-y overflow-y-auto px-4 pb-4">
            {detailItems.map(item => (
              <div key={item.key} className="py-3 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{formatDate(item.tanggal)}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">{item.mapelNama} · {item.kelasLabel}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {jamLabel(item)}
                  </span>
                </div>
                {item.catatan && <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{item.catatan}</p>}
                {item.status === 'ALFA' && <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400">Agenda tidak diisi sampai jadwal selesai.</p>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
