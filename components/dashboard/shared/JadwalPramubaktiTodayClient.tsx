/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  AlertCircle,
  UserCheck,
  Sparkles,
  ClipboardPen,
  ClipboardCheck,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { currentTimeWIB } from '@/lib/time'
import { minutes, type PbItem, type PbReport } from '@/lib/pramubakti'

function formatReportTime(waktu: string | null | undefined) {
  if (!waktu) return ''
  const timePart = waktu.includes('T') ? waktu.split('T')[1] : waktu.split(' ')[1]
  return timePart ? `${timePart.slice(0, 5)} WIB` : waktu
}

export function JadwalPramubaktiTodayClient({
  today,
  holiday,
  items,
  rules,
}: {
  today: string
  holiday: { reason: string } | null
  items: PbItem[]
  rules: { restricted: boolean; late: boolean; threshold: number }
}) {
  const [clock, setClock] = useState(() => currentTimeWIB().hhmm)
  const [previewPhoto, setPreviewPhoto] = useState<PbReport | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(currentTimeWIB().hhmm)
    }, 15000)
    return () => window.clearInterval(timer)
  }, [])

  if (holiday) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/20 shadow-sm overflow-hidden mb-3">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="p-1.5 rounded-md bg-white dark:bg-rose-900/40 border border-rose-100 dark:border-rose-800 shrink-0">
            <CalendarDays className="h-4 w-4 text-rose-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">Hari ini libur / tidak ada kewajiban pekerjaan</p>
            <p className="text-[11px] text-rose-600 dark:text-rose-400 truncate">{holiday.reason || 'Tidak ada jadwal pekerjaan hari ini.'}</p>
          </div>
        </div>
      </div>
    )
  }

  const regularItems = items.filter(i => i.slot && i.status !== 'TAMBAHAN')
  const totalPekerjaan = regularItems.length
  const sudahLapor = items.filter(i => i.report || i.leave).length
  const belumLapor = items.filter(i => i.status === 'BELUM').length
  const tambahanCount = items.filter(i => !i.slot || i.status === 'TAMBAHAN').length

  const nowMins = minutes(clock)
  const activeItem = regularItems.find(i => (
    i.status === 'BELUM' &&
    nowMins >= minutes(i.slot!.start) - 5 &&
    nowMins <= minutes(i.slot!.end)
  ))
  const nextUpcoming = regularItems.find(i => (
    i.status === 'BELUM' &&
    nowMins < minutes(i.slot!.start) - 5
  ))

  let subtitleText = 'Tidak ada jadwal pekerjaan hari ini'
  if (totalPekerjaan > 0) {
    if (activeItem) {
      subtitleText = `${totalPekerjaan} pekerjaan · ${sudahLapor} selesai · 1 sedang berlangsung`
    } else if (nextUpcoming) {
      subtitleText = `${totalPekerjaan} pekerjaan · ${sudahLapor} selesai · Pekerjaan berikutnya ${nextUpcoming.slot!.start} WIB`
    } else {
      subtitleText = `${totalPekerjaan} pekerjaan · ${sudahLapor} selesai${belumLapor > 0 ? ` · ${belumLapor} belum` : ''}${tambahanCount > 0 ? ` · ${tambahanCount} tambahan` : ''}`
    }
  }

  let indexCounter = 0

  return (
    <>
      <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden mb-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 border-b border-surface-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="p-1.5 rounded-md bg-emerald-50 border border-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 shrink-0">
              <ClipboardPen className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Jadwal Tugas Hari Ini</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap truncate">
                {subtitleText}
              </p>
            </div>
          </div>
          <div className="w-full sm:w-auto shrink-0 grid grid-cols-1 sm:flex items-stretch sm:items-center gap-2">
            <Link
              href="/dashboard/pelaporan-pramubakti"
              className="inline-flex justify-center items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1.5 rounded-md transition-colors"
            >
              <ClipboardPen className="h-3 w-3" />
              Lapor Pekerjaan
            </Link>
          </div>
        </div>

        {/* Empty state */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-7 text-slate-400">
            <ClipboardCheck className="h-6 w-6 text-slate-300 dark:text-slate-600" />
            <p className="text-xs">Tidak ada jadwal pekerjaan hari ini</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {items.map(item => {
              const isRegular = Boolean(item.slot && item.status !== 'TAMBAHAN')
              const idx = isRegular ? ++indexCounter : null
              const isBelum = item.status === 'BELUM'
              const isAlfa = item.status === 'ALFA'
              const isLeave = Boolean(item.leave)

              // Active window: 5 mins before start until end
              const isWindowActive = Boolean(
                item.slot &&
                nowMins >= minutes(item.slot.start) - 5 &&
                nowMins <= minutes(item.slot.end)
              )

              return (
                <div
                  key={item.key}
                  className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${
                    isWindowActive && isBelum
                      ? 'bg-emerald-50/20 dark:bg-emerald-950/10'
                      : isAlfa
                      ? 'bg-rose-50/20 dark:bg-rose-900/5'
                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/20'
                  }`}
                >
                  {/* Status Icon */}
                  <div
                    className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${
                      item.status === 'TEPAT_WAKTU' || item.status === 'TELAT'
                        ? 'bg-emerald-50 dark:bg-emerald-900/30'
                        : isLeave
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : isAlfa
                        ? 'bg-rose-50 dark:bg-rose-900/30'
                        : item.status === 'TAMBAHAN'
                        ? 'bg-indigo-50 dark:bg-indigo-900/30'
                        : isWindowActive
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-400 dark:ring-emerald-600'
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    {(item.status === 'TEPAT_WAKTU' || item.status === 'TELAT') && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {isLeave && <UserCheck className="h-4 w-4 text-blue-500" />}
                    {isAlfa && <AlertCircle className="h-4 w-4 text-rose-500" />}
                    {item.status === 'TAMBAHAN' && <Sparkles className="h-4 w-4 text-indigo-500" />}
                    {isBelum && (
                      <Clock
                        className={`h-4 w-4 ${isWindowActive ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`}
                      />
                    )}
                  </div>

                  {/* Middle Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap truncate">
                        {isRegular ? `Pekerjaan ${idx}` : 'Pekerjaan Tambahan'}
                      </span>

                      {/* Content details */}
                      {item.report ? (
                        <>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                            {item.report.jobs.join(', ')}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>📍 {item.report.tempat}</span>
                            <span>•</span>
                            <span>{formatReportTime(item.report.waktu_input)}</span>
                            {item.report.foto_url && (
                              <button
                                type="button"
                                onClick={() => setPreviewPhoto(item.report)}
                                className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-medium cursor-pointer"
                              >
                                <Camera className="h-3 w-3" /> Foto Bukti
                              </button>
                            )}
                          </div>
                        </>
                      ) : item.leave ? (
                        <>
                          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                            {item.leave.reason_name || (item.status === 'SAKIT' ? 'Sakit' : 'Izin')}
                          </p>
                          {item.leave.note && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {item.leave.note}
                            </p>
                          )}
                        </>
                      ) : isAlfa ? (
                        <p className="text-xs text-rose-500 font-medium">
                          Lewat batas waktu
                        </p>
                      ) : isWindowActive ? (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Sedang berlangsung
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Right: Time & Status / Action */}
                  <div className="text-right shrink-0 min-w-0">
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      {item.slot ? `${item.slot.start} – ${item.slot.end}` : 'Tambahan'}
                    </p>
                    <div className="mt-0.5">
                      {(item.status === 'TEPAT_WAKTU' || item.status === 'TELAT') && (
                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          Selesai
                        </span>
                      )}
                      {item.status === 'SAKIT' && (
                        <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          Sakit
                        </span>
                      )}
                      {item.status === 'IZIN' && (
                        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                          Izin
                        </span>
                      )}
                      {item.status === 'ALFA' && (
                        <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400">
                          Lewat Waktu
                        </span>
                      )}
                      {item.status === 'TAMBAHAN' && (
                        <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                          Tambahan
                        </span>
                      )}
                      {isBelum && (
                        isWindowActive ? (
                          <Link
                            href="/dashboard/pelaporan-pramubakti"
                            className="inline-flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 text-[10px] font-medium shadow-xs transition-colors"
                          >
                            Lapor
                          </Link>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400">
                            Menunggu
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Warning bar if pending tasks exist */}
        {belumLapor > 0 && (
          <div className="px-4 py-2 border-t border-amber-100 dark:border-amber-900/30 bg-amber-50/60 dark:bg-amber-900/10 flex items-center justify-between">
            <p className="text-[10px] text-amber-700 dark:text-amber-400 whitespace-nowrap truncate">
              ⚠ {belumLapor} pekerjaan belum dilaporkan hari ini — segera laporkan sebelum batas waktu berakhir!
            </p>
            <Link
              href="/dashboard/pelaporan-pramubakti"
              className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 hover:underline shrink-0 ml-2"
            >
              Lapor Sekarang &rarr;
            </Link>
          </div>
        )}
      </div>

      {/* Dialog Preview Foto Bukti */}
      <Dialog open={!!previewPhoto} onOpenChange={open => !open && setPreviewPhoto(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md gap-3 rounded-xl p-0 overflow-hidden">
          <DialogHeader className="border-b px-4 pb-3 pt-4 text-left">
            <DialogTitle className="flex items-center justify-between text-base">
              <span>Foto Bukti Pekerjaan</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {previewPhoto && (
                <>
                  📍 {previewPhoto.tempat} • {formatReportTime(previewPhoto.waktu_input)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {previewPhoto && (
            <div className="p-4 space-y-3">
              <div className="relative rounded-lg overflow-hidden border bg-black flex items-center justify-center max-h-[60vh]">
                <img
                  src={previewPhoto.foto_url}
                  alt="Foto bukti pekerjaan"
                  className="w-full h-auto object-contain max-h-[55vh]"
                />
              </div>
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Pekerjaan:</p>
                <div className="flex flex-wrap gap-1">
                  {previewPhoto.jobs.map(j => (
                    <span
                      key={j}
                      className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium text-[11px]"
                    >
                      {j}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
