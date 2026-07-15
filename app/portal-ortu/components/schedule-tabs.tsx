'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, CalendarCheck, Clock3, Camera, ChevronRight, BookOpen } from 'lucide-react'
import { todayWIB } from '@/lib/time'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

type Row = { 
  jam_ke_mulai: number;
  jam_ke_selesai: number;
  waktu: string; 
  mapel: string; 
  guru: string;
  agendaDate: string;
  agenda?: {
    materi?: string | null;
    foto_url?: string | null;
    status?: string | null;
  } | null;
  isToday?: boolean;
  absensi?: {
    status: string;
    catatan?: string | null;
  } | null;
}

const DAY_LABEL: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
}

export function ScheduleTabs({ jadwalByDay }: { jadwalByDay: Record<number, Row[]> }) {
  const defaultDay = useMemo(() => {
    const jsDay = new Date(`${todayWIB()}T00:00:00`).getDay()
    const map = jsDay === 0 ? 1 : Math.min(jsDay, 6)
    return String(map)
  }, [])
  const [active, setActive] = useState(defaultDay)
  const rows = jadwalByDay[Number(active)] || []
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'HADIR':
        return 'Siswa hadir'
      case 'SAKIT':
        return 'Siswa sakit'
      case 'IZIN':
        return 'Siswa izin'
      case 'ALFA':
        return 'Siswa alfa'
      case 'KBM_EXCEPTION':
        return 'Kegiatan'
      case 'BELUM_ADA_DATA':
        return 'Belum diinput'
      case 'LIBUR':
        return 'Libur'
      default:
        return status
    }
  }

  return (
    <div className="space-y-4">
      {/* Segmented Controls Style */}
      <div data-tour-id="jadwal-day-tabs" className="flex overflow-x-auto no-scrollbar gap-1 bg-slate-100 p-1 rounded-xl">
        {[1, 2, 3, 4, 5, 6].map((d) => {
          const isActive = active === String(d)
          const isToday = String(d) === defaultDay
          return (
            <button
              key={d}
              type="button"
              onClick={() => setActive(String(d))}
              className={`relative flex-1 shrink-0 px-4 py-2 text-[13px] font-medium whitespace-nowrap rounded-lg transition-all ${
                isActive 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {DAY_LABEL[d]}
              {isToday && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-sky-500 rounded-full" />}
            </button>
          )
        })}
      </div>

      {/* Schedule List */}
      <div data-tour-id="jadwal-list" className="space-y-3">
        {rows.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 border-dashed p-8 text-center">
            <p className="text-sm font-medium text-slate-500">Tidak ada jadwal</p>
          </div>
        ) : rows.map((j, idx) => {
          let statusColor = ''
          let iconColor = ''
          let StatusIcon = null
          
          if (j.isToday && j.absensi) {
            switch (j.absensi.status) {
              case 'HADIR':
                statusColor = 'bg-teal-50 text-teal-800 border-teal-200'
                iconColor = 'bg-teal-100 text-teal-800'
                StatusIcon = CheckCircle2
                break
              case 'SAKIT':
              case 'IZIN':
                statusColor = 'bg-amber-50 text-amber-700 border-amber-200'
                iconColor = 'bg-amber-100 text-amber-700'
                StatusIcon = AlertTriangle
                break
              case 'ALFA':
                statusColor = 'bg-rose-50 text-rose-700 border-rose-200'
                iconColor = 'bg-rose-100 text-rose-700'
                StatusIcon = XCircle
                break
              case 'KBM_EXCEPTION':
                statusColor = 'bg-sky-50 text-sky-700 border-sky-200'
                iconColor = 'bg-sky-100 text-sky-700'
                StatusIcon = CalendarCheck
                break
              case 'LIBUR':
                statusColor = 'bg-slate-50 text-slate-700 border-slate-200'
                iconColor = 'bg-slate-200 text-slate-700'
                StatusIcon = CalendarCheck
                break
              case 'BELUM_ADA_DATA':
                statusColor = 'bg-slate-50 text-slate-600 border-slate-200'
                iconColor = 'bg-slate-200 text-slate-600'
                StatusIcon = Clock3
                break
            }
          }

          const jamLabel = j.jam_ke_mulai === j.jam_ke_selesai
            ? `Jam ke-${j.jam_ke_mulai}`
            : `Jam ke-${j.jam_ke_mulai}–${j.jam_ke_selesai}`

          return (
            <Dialog key={`${active}-${idx}`}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className={`group w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    j.isToday && j.absensi && ['SAKIT', 'IZIN', 'ALFA'].includes(j.absensi.status)
                      ? 'border-amber-200'
                      : 'border-slate-200 hover:border-teal-200'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`w-[82px] shrink-0 rounded-xl border px-3 py-2.5 ${j.isToday ? 'border-teal-100 bg-teal-50' : 'border-slate-100 bg-slate-50'}`}>
                      <p className={`text-[10px] font-extrabold uppercase tracking-wide ${j.isToday ? 'text-teal-700' : 'text-slate-500'}`}>{jamLabel}</p>
                      <p className="mt-1 text-[11px] font-semibold leading-tight text-slate-700">{j.waktu}</p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold leading-snug text-slate-900">{j.mapel}</h3>
                          <p className="mt-1 text-xs text-slate-500">{j.guru}</p>
                        </div>
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-600" />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {j.isToday && j.absensi && StatusIcon && (
                          <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusColor}`}>
                            <StatusIcon className="h-3 w-3 shrink-0" />
                            {getStatusLabel(j.absensi.status)}
                          </span>
                        )}
                        {j.agenda?.foto_url && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">
                            <Camera className="h-3 w-3" /> Foto kegiatan
                          </span>
                        )}
                      </div>
                      {j.isToday && j.absensi?.catatan && <p className="mt-2 text-[11px] leading-5 text-slate-500">{j.absensi.catatan}</p>}
                    </div>
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl border-0 bg-white p-0 sm:max-w-xl">
                <DialogHeader className="border-b border-slate-100 px-5 py-4 text-left">
                  <DialogTitle className="text-base font-bold text-slate-900">{j.mapel}</DialogTitle>
                  <p className="text-xs text-slate-500">{jamLabel} · {j.waktu} · {j.guru}</p>
                </DialogHeader>
                <div className="space-y-4 p-5">
                  {j.agenda?.foto_url ? (
                    <img src={j.agenda.foto_url} alt={`Kegiatan ${j.mapel}`} className="max-h-[62vh] w-full rounded-2xl bg-slate-100 object-contain" />
                  ) : (
                    <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                      <div>
                        <Camera className="mx-auto h-7 w-7 text-slate-300" />
                        <p className="mt-2 text-sm font-semibold text-slate-600">Foto kegiatan belum tersedia</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">Foto akan muncul setelah guru mengisi agenda pada {j.agendaDate}.</p>
                      </div>
                    </div>
                  )}
                  {j.agenda?.materi && (
                    <div className="flex items-start gap-3 rounded-2xl bg-teal-50 p-4">
                      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700">Materi pembelajaran</p>
                        <p className="mt-1 text-sm leading-6 text-teal-950">{j.agenda.materi}</p>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )
        })}
      </div>
    </div>
  )
}
