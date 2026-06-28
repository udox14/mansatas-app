// components/dashboard/widgets/TrenPelanggaranSekolahWidget.tsx
// Widget katalog: tren pelanggaran siswa se-sekolah 7 hari terakhir.
import Link from 'next/link'
import { getDB } from '@/utils/db'
import { todayWIB } from '@/lib/time'
import { TrendDown as TrendingDown, TrendUp as TrendingUp, ArrowRight } from '@phosphor-icons/react/dist/ssr'
import type { WidgetProps } from '@/lib/dashboard-widgets-meta'

export async function TrenPelanggaranSekolahWidget(_props: WidgetProps) {
  const db = await getDB()
  const today = todayWIB()

  const data = await db.prepare(`
    SELECT DATE(tanggal) as tgl, COUNT(*) as cnt
    FROM siswa_pelanggaran
    WHERE tanggal >= date(?, '-6 days') AND DATE(tanggal) IS NOT NULL
    GROUP BY DATE(tanggal) ORDER BY tgl
  `).bind(today).all<{ tgl: string; cnt: number }>().then(r => r.results ?? [])

  const total = data.reduce((s, r) => s + r.cnt, 0)
  const maxCnt = Math.max(...data.map(r => r.cnt), 1)
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

  return (
    <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
        <div className="p-1.5 rounded-md bg-rose-50 border border-rose-100">
          <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Tren Pelanggaran</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">7 hari terakhir · Total: {total}</p>
        </div>
        <Link href="/dashboard/kedisiplinan" className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
          Detail <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="p-3">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-4 text-slate-400">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <p className="text-xs">Tidak ada pelanggaran 7 hari terakhir</p>
          </div>
        ) : (
          <div className="flex items-end gap-1.5 h-16">
            {data.map((row, i) => {
              const pct = Math.round((row.cnt / maxCnt) * 100)
              const dateObj = new Date(row.tgl + 'T00:00:00')
              const dayName = dayNames[dateObj.getDay()] ?? ''
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-rose-500 font-bold tabular-nums">{row.cnt}</span>
                  <div className="w-full flex items-end" style={{ height: 40 }}>
                    <div className="w-full rounded-t bg-rose-400 dark:bg-rose-600 min-h-[4px]" style={{ height: `${Math.max(10, pct)}%` }} />
                  </div>
                  <span className="text-[9px] text-slate-400">{dayName}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
