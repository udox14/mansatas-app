'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, CalendarCheck } from 'lucide-react'

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
          let StatusIcon = null
          
          if (j.isToday && j.absensi) {
            switch (j.absensi.status) {
              case 'HADIR':
                statusColor = 'bg-emerald-50 text-emerald-600 border-emerald-100'
                StatusIcon = CheckCircle2
                break
              case 'SAKIT':
              case 'IZIN':
                statusColor = 'bg-amber-50 text-amber-600 border-amber-100'
                StatusIcon = AlertTriangle
                break
              case 'ALFA':
                statusColor = 'bg-rose-50 text-rose-600 border-rose-100'
                StatusIcon = XCircle
                break
              case 'KBM_EXCEPTION':
                statusColor = 'bg-sky-50 text-sky-600 border-sky-100'
                StatusIcon = CalendarCheck
                break
            }
          }

          return (
            <div key={`${active}-${idx}`} className={`bg-white rounded-xl border p-4 flex items-stretch gap-4 shadow-sm transition-colors ${
              j.isToday && j.absensi && !['HADIR', 'KBM_EXCEPTION'].includes(j.absensi.status) ? 'border-amber-200 hover:border-amber-300' : 'border-slate-200 hover:border-slate-300'
            }`}>
              {/* Time Badge */}
              <div className={`flex flex-col items-center justify-center rounded-lg px-3 py-2 min-w-[70px] shrink-0 border ${
                j.isToday ? 'bg-sky-50 border-sky-100' : 'bg-slate-50 border-slate-100'
              }`}>
                <span className={`font-semibold text-[10px] uppercase tracking-wider mb-0.5 ${j.isToday ? 'text-sky-500' : 'text-slate-400'}`}>Jam {j.jam_ke}</span>
                <span className={`font-semibold text-[12px] ${j.isToday ? 'text-sky-900' : 'text-slate-700'}`}>{j.waktu.split(' - ')[0]}</span>
              </div>
              
              <div className="flex flex-col justify-center flex-1">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 leading-tight">{j.mapel}</h3>
                  
                  {j.isToday && j.absensi && StatusIcon && (
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold tracking-wide ${statusColor}`} title="Status kehadiran anak pada jam pelajaran ini">
                      <StatusIcon className="w-3 h-3" />
                      {j.absensi.status === 'KBM_EXCEPTION' ? 'Kegiatan resmi' : `Anak: ${j.absensi.status}`}
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
