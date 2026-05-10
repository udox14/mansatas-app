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
    <div className="rounded-2xl border-2 border-slate-100 bg-white overflow-hidden">
      <div className="flex overflow-x-auto no-scrollbar p-2 gap-2 bg-slate-50 border-b-2 border-slate-100">
        {[1, 2, 3, 4, 5, 6].map((d) => {
          const isActive = active === String(d)
          return (
            <button
              key={d}
              type="button"
              onClick={() => setActive(String(d))}
              className={`px-4 py-2.5 text-[13px] font-bold whitespace-nowrap rounded-xl transition-all ${
                isActive 
                  ? 'text-emerald-700 bg-emerald-100/50 shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {DAY_LABEL[d]}
            </button>
          )
        })}
      </div>
      <div className="p-4 space-y-3 bg-white">
        {rows.length === 0 ? (
          <p className="text-sm font-medium text-slate-400 py-4 text-center border-2 border-dashed border-slate-100 rounded-2xl">Tidak ada jadwal.</p>
        ) : rows.map((j, idx) => (
          <div key={`${active}-${idx}`} className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 relative overflow-hidden group">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-400" />
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-black text-slate-800">{j.mapel}</p>
                <p className="text-[13px] font-bold text-slate-500 mt-1">{j.guru}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-lg mb-1">Jam {j.jam_ke}</span>
                <p className="text-[11px] font-bold text-slate-400">{j.waktu}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
