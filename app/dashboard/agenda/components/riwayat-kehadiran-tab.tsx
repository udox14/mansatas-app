'use client'

import { TeacherLeaveBadge } from '@/components/teacher-leave-controls'
import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react'
import { formatTimeWIB, todayWIB } from '@/lib/time'
import {
  TEACHER_ATTENDANCE_START_DATE,
  type TeacherAttendanceItem,
  type TeacherAttendanceResult,
  type TeacherAttendanceStatus,
} from '@/lib/teacher-attendance-core'

type AttendanceFilter = 'SEMUA' | 'HADIR' | 'IZIN_SEKOLAH' | TeacherAttendanceStatus

const STATUS_META: Record<TeacherAttendanceStatus, { label: string; classes: string; dot: string }> = {
  TEPAT_WAKTU: {
    label: 'Hadir',
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  TELAT: {
    label: 'Telat',
    classes: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    dot: 'bg-orange-500',
  },
  SAKIT: {
    label: 'Sakit',
    classes: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  IZIN: {
    label: 'Izin',
    classes: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  ALFA: {
    label: 'Alfa',
    classes: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    dot: 'bg-rose-500',
  },
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', options)
}

function matchesFilter(item: TeacherAttendanceItem, filter: AttendanceFilter) {
  if (filter === 'SEMUA') return true
  if (filter === 'HADIR') return item.status === 'TEPAT_WAKTU' || item.status === 'TELAT'
  if (filter === 'IZIN_SEKOLAH') return item.status === 'IZIN' && item.kepentingan_sekolah
  if (filter === 'IZIN') return item.status === 'IZIN' && !item.kepentingan_sekolah
  return item.status === filter
}

export function RiwayatKehadiranTab({ result }: { result: TeacherAttendanceResult }) {
  const [filter, setFilter] = useState<AttendanceFilter>('SEMUA')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filteredItems = useMemo(
    () => result.items.filter(item => matchesFilter(item, filter)),
    [filter, result.items]
  )
  const groupedItems = useMemo(() => {
    const groups = new Map<string, TeacherAttendanceItem[]>()
    for (const item of filteredItems) {
      if (!groups.has(item.tanggal)) groups.set(item.tanggal, [])
      groups.get(item.tanggal)!.push(item)
    }
    return Array.from(groups.entries())
  }, [filteredItems])

  const updateMonth = (month: string) => {
    if (!month) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'riwayat')
    params.set('bulan', month)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const metrics: Array<{
    filter: AttendanceFilter
    label: string
    value: number
    color: string
    icon: typeof CalendarDays
  }> = [
    { filter: 'SEMUA', label: 'Total', value: result.summary.total, color: 'text-slate-700 dark:text-slate-200', icon: CalendarDays },
    { filter: 'HADIR', label: 'Hadir', value: result.summary.hadir, color: 'text-emerald-600', icon: CheckCircle2 },
    { filter: 'TELAT', label: 'Telat', value: result.summary.telat, color: 'text-orange-600', icon: Clock3 },
    { filter: 'SAKIT', label: 'Sakit', value: result.summary.sakit, color: 'text-amber-600', icon: Stethoscope },
    { filter: 'IZIN_SEKOLAH', label: 'Izin sekolah', value: result.summary.izinSekolah, color: 'text-emerald-600', icon: FileText },
    { filter: 'IZIN', label: 'Izin biasa', value: result.summary.izin - result.summary.izinSekolah, color: 'text-blue-600', icon: FileText },
    { filter: 'ALFA', label: 'Alfa', value: result.summary.alfa, color: 'text-rose-600', icon: ShieldAlert },
  ]

  return (
    <div className="space-y-3">
      <section className="rounded-xl border bg-white p-3 shadow-sm dark:bg-slate-900 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Riwayat & Kehadiran</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Detail setiap sesi mengajar sejak 20 Juli 2026.
            </p>
          </div>
          <label className="block w-full sm:w-52">
            <span className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">Pilih bulan</span>
            <input
              type="month"
              min={TEACHER_ATTENDANCE_START_DATE.slice(0, 7)}
              max={todayWIB().slice(0, 7)}
              value={result.month}
              onChange={event => updateMonth(event.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {metrics.map(metric => {
            const Icon = metric.icon
            const active = filter === metric.filter
            return (
              <button
                key={metric.label}
                type="button"
                onClick={() => setFilter(metric.filter)}
                aria-pressed={active}
                className={`rounded-lg border px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  active
                    ? 'border-emerald-400 bg-emerald-50/70 ring-1 ring-emerald-300 dark:border-emerald-700 dark:bg-emerald-900/20 dark:ring-emerald-800'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-lg font-bold tabular-nums ${metric.color}`}>{metric.value}</span>
                  <Icon className={`h-3.5 w-3.5 ${metric.color}`} />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{metric.label}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
          Hadir mencakup sesi tepat waktu dan telat. Tekan ringkasan untuk memfilter daftar.
        </p>
      </section>

      {result.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center dark:border-slate-800 dark:bg-slate-800/40">
          <BookOpen className="mb-2 h-9 w-9 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Tidak ada kewajiban mengajar pada bulan ini</p>
          <p className="mt-1 text-xs text-slate-400">Pilih bulan lain untuk melihat riwayat.</p>
        </div>
      ) : groupedItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center dark:border-slate-800 dark:bg-slate-800/40">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Tidak ada sesi dengan status ini</p>
          <button type="button" onClick={() => setFilter('SEMUA')} className="mt-2 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            Tampilkan semua riwayat
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedItems.map(([tanggal, items]) => (
            <section key={tanggal}>
              <div className="mb-1.5 flex items-center gap-2 px-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {formatDate(tanggal, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="text-[10px] text-slate-400">{items.length} sesi</span>
              </div>
              <div className="space-y-2">
                {items.map(item => {
                  const meta = STATUS_META[item.status]
                  const jamLabel = item.jamKeMulai === item.jamKeSelesai
                    ? `Jam ke-${item.jamKeMulai}`
                    : `Jam ke-${item.jamKeMulai}-${item.jamKeSelesai}`
                  const clockLabel = item.slotMulai && item.slotSelesai ? `${item.slotMulai}-${item.slotSelesai}` : null
                  return (
                    <article key={item.key} className="relative overflow-hidden rounded-lg border bg-white px-3 py-3 shadow-sm dark:bg-slate-900">
                      <span className={`absolute inset-y-0 left-0 w-1 ${meta.dot}`} />
                      <div className="flex items-start justify-between gap-3 pl-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">{item.mapelNama}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.classes}`}>{meta.label}</span><TeacherLeaveBadge data={item} />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                            <span>{item.kelasLabel}</span>
                            <span>•</span>
                            <span>{jamLabel}{clockLabel ? ` · ${clockLabel}` : ''}</span>
                            {item.waktuInput && (
                              <>
                                <span>•</span>
                                <span>Input {formatTimeWIB(item.waktuInput, { legacyShiftedWIB: true })}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {item.materi && (
                        <div className="mt-2 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-800/60">
                          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Materi</p>
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 dark:text-slate-300">{item.materi}</p>
                        </div>
                      )}
                      {item.catatan && (
                        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          <span className="font-semibold">Keterangan:</span> {item.catatan}
                        </p>
                      )}
                      {item.status === 'ALFA' && !item.catatan && (
                        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">Jadwal telah selesai, tetapi agenda tidak diisi.</p>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
