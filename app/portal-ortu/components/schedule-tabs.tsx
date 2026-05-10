'use client'

import { useMemo, useState } from 'react'

type Row = { jam_ke: number; waktu: string; mapel: string; guru: string }

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
          return (
            <button
              key={d}
              type="button"
              onClick={() => setActive(String(d))}
              className={`flex-1 shrink-0 px-4 py-2 text-[13px] font-medium whitespace-nowrap rounded-lg transition-all ${
                isActive 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {DAY_LABEL[d]}
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
        ) : rows.map((j, idx) => (
          <div key={`${active}-${idx}`} className="bg-white rounded-xl border border-slate-200 p-4 flex items-stretch gap-4 shadow-sm hover:border-slate-300 transition-colors">
            {/* Time Badge */}
            <div className="flex flex-col items-center justify-center bg-slate-50 rounded-lg px-3 py-2 min-w-[70px] shrink-0 border border-slate-100">
              <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider mb-0.5">Jam {j.jam_ke}</span>
              <span className="text-slate-700 font-semibold text-[12px]">{j.waktu.split(' - ')[0]}</span>
            </div>
            
            <div className="flex flex-col justify-center flex-1">
              <h3 className="text-sm font-semibold text-slate-800">{j.mapel}</h3>
              <p className="text-xs text-slate-500 mt-1">{j.guru}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
