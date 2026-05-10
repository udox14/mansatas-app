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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar">
        {[1, 2, 3, 4, 5, 6].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setActive(String(d))}
            className={`px-4 py-2 text-xs font-semibold whitespace-nowrap ${active === String(d) ? 'text-emerald-700 border-b-2 border-emerald-700 bg-emerald-50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {DAY_LABEL[d]}
          </button>
        ))}
      </div>
      <div className="p-3 space-y-1.5">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400">Tidak ada jadwal.</p>
        ) : rows.map((j, idx) => (
          <div key={`${active}-${idx}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-slate-700">Jam {j.jam_ke} · {j.waktu}</p>
            <p className="text-xs text-slate-700">{j.mapel}</p>
            <p className="text-[11px] text-slate-500">{j.guru}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

