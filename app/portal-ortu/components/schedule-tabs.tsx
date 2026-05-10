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
      {/* Day Selector - Chunky Pills */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2">
        {[1, 2, 3, 4, 5, 6].map((d) => {
          const isActive = active === String(d)
          return (
            <button
              key={d}
              type="button"
              onClick={() => setActive(String(d))}
              className={`shrink-0 px-5 py-3 text-[14px] font-black whitespace-nowrap rounded-[20px] transition-all border-2 border-b-[4px] ${
                isActive 
                  ? 'bg-sky-400 border-sky-500 text-white shadow-sm translate-y-0.5 border-b-2' 
                  : 'bg-white border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-600'
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
          <div className="bg-slate-100 rounded-[28px] border-2 border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center">
            <span className="text-4xl mb-2">🌴</span>
            <p className="text-lg font-black text-slate-500">Tidak ada jadwal</p>
            <p className="text-sm font-bold text-slate-400 mt-1">Hari ini libur, yeay!</p>
          </div>
        ) : rows.map((j, idx) => (
          <div key={`${active}-${idx}`} className="rounded-[28px] border-2 border-b-[4px] border-sky-200 bg-sky-50 p-5 flex items-stretch gap-4 relative overflow-hidden group hover:border-sky-300 transition-colors">
            {/* Time Badge */}
            <div className="flex flex-col items-center justify-center bg-white border-2 border-sky-100 rounded-[18px] px-3 py-2 min-w-[70px] shrink-0 text-center">
              <span className="text-sky-400 font-black text-[10px] uppercase tracking-widest border-b-2 border-sky-100 pb-1 mb-1 w-full">Jam {j.jam_ke}</span>
              <span className="text-sky-900 font-black text-[12px]">{j.waktu.split(' - ')[0]}</span>
            </div>
            
            <div className="flex flex-col justify-center flex-1 py-1">
              <h3 className="text-lg font-black text-slate-800 leading-tight">{j.mapel}</h3>
              <p className="text-[13px] font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-sky-400 rounded-full inline-block" />
                {j.guru}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
