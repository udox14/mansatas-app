'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, CalendarCheck, Clock3 } from 'lucide-react'

type Row = { 
  jam_ke: number; 
  waktu: string; 
  mapel: string; 
  guru: string;
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
    const jsDay = new Date().getDay()
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
      <div className="flex overflow-x-auto no-scrollbar gap-1 bg-slate-100 p-1 rounded-xl">
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
      <div className="space-y-3">
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
                statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                iconColor = 'bg-emerald-100 text-emerald-700'
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

          return (
            <div key={`${active}-${idx}`} className={`bg-white rounded-xl border p-4 flex items-stretch gap-4 shadow-sm transition-colors ${
              j.isToday && j.absensi && ['SAKIT', 'IZIN', 'ALFA'].includes(j.absensi.status) ? 'border-amber-200 hover:border-amber-300' : 'border-slate-200 hover:border-slate-300'
            }`}>
              {/* Time Badge */}
              <div className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 min-w-[70px] shrink-0 border ${
                j.isToday ? 'bg-sky-50 border-sky-100' : 'bg-slate-50 border-slate-100'
              }`}>
                <span className={`font-semibold text-[10px] uppercase tracking-wider mb-0.5 ${j.isToday ? 'text-sky-500' : 'text-slate-400'}`}>Jam {j.jam_ke}</span>
                <span className={`font-semibold text-[12px] ${j.isToday ? 'text-sky-900' : 'text-slate-700'}`}>{j.waktu.split(' - ')[0]}</span>
              </div>
              
              <div className="flex flex-col justify-center flex-1 min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 leading-tight min-w-0">{j.mapel}</h3>
                  
                  {j.isToday && j.absensi && StatusIcon && (
                    <div className={`inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none shadow-sm ${statusColor}`} title="Status kehadiran siswa pada jam pelajaran ini">
                      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${iconColor}`}>
                        <StatusIcon className="h-2.5 w-2.5" />
                      </span>
                      <span className="truncate">{getStatusLabel(j.absensi.status)}</span>
                    </div>
                  )}
                </div>
                
                <p className="text-xs text-slate-500 mt-1">{j.guru}</p>
                {j.isToday && j.absensi?.catatan && (
                  <p className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-1 rounded mt-2 border border-slate-100">
                    Catatan: {j.absensi.catatan}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
