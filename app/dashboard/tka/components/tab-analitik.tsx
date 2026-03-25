// Lokasi: app/dashboard/tka/components/tab-analitik.tsx
'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, BarChart2, TrendingUp, Users, Award } from 'lucide-react'
import { getAnalitikTka } from '../actions'
import { cn } from '@/lib/utils'

interface Props {
  tahunAjaranId: string
  hasHasil: boolean
}

type Analitik = Awaited<ReturnType<typeof getAnalitikTka>>

const KATEGORI_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  'Istimewa': { bar: 'bg-emerald-400', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  'Baik': { bar: 'bg-blue-400', text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40' },
  'Memadai': { bar: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  'Kurang': { bar: 'bg-red-400', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40' },
}

function DistribBar({ items, total }: { items: { kategori: string; jumlah: number }[]; total: number }) {
  if (total === 0) return <div className="text-xs text-slate-400">Tidak ada data</div>
  return (
    <div className="space-y-2">
      {['Istimewa', 'Baik', 'Memadai', 'Kurang'].map(kat => {
        const item = items.find(i => i.kategori === kat)
        const jumlah = item?.jumlah ?? 0
        const pct = total > 0 ? (jumlah / total) * 100 : 0
        const c = KATEGORI_COLORS[kat]
        return (
          <div key={kat} className="flex items-center gap-2">
            <div className={cn('text-[10px] font-semibold w-16 shrink-0', c.text)}>{kat}</div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2">
              <div className={cn('h-2 rounded-full transition-all', c.bar)} style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 w-16 text-right">
              {jumlah} <span className="text-slate-400">({pct.toFixed(0)}%)</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MapelBarChart({ items, maxVal }: { items: { mapel: string; jumlah: number; avg_nilai: number }[]; maxVal: number }) {
  if (items.length === 0) return <div className="text-xs text-slate-400 py-4 text-center">Tidak ada data</div>
  return (
    <div className="space-y-2.5">
      {items.map(item => (
        <div key={item.mapel}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs text-slate-700 dark:text-slate-300 truncate pr-2">{item.mapel}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-slate-400">avg {item.avg_nilai.toFixed(1)}</span>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.jumlah} siswa</span>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-sky-400 dark:bg-sky-500"
              style={{ width: `${(item.jumlah / maxVal) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-lg', color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-0.5">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

// Miniature radar/bar chart untuk perbandingan mapel wajib
function MapelWajibRadar({ avgBind, avgMat, avgBing }: { avgBind: number; avgMat: number; avgBing: number }) {
  const max = 100
  const bars = [
    { label: 'Bhs. Indonesia', val: avgBind, color: 'bg-emerald-400' },
    { label: 'Matematika', val: avgMat, color: 'bg-blue-400' },
    { label: 'Bhs. Inggris', val: avgBing, color: 'bg-sky-400' },
  ]
  return (
    <div className="space-y-3">
      {bars.map(b => (
        <div key={b.label}>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-slate-600 dark:text-slate-400">{b.label}</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{b.val?.toFixed(2) ?? '-'}</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3">
            <div
              className={cn('h-3 rounded-full transition-all', b.color)}
              style={{ width: `${((b.val ?? 0) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TabAnalitik({ tahunAjaranId, hasHasil }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Analitik | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAnalitikTka(tahunAjaranId)
      setData(res)
    } finally {
      setLoading(false)
    }
  }, [tahunAjaranId])

  if (!data && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl border-dashed border-slate-200 dark:border-slate-700">
        <BarChart2 className="h-10 w-10 text-slate-300 mb-3" />
        <p className="text-slate-500 font-medium text-sm">Analitik Hasil TKA</p>
        <p className="text-slate-400 text-xs mt-1 mb-4">
          {hasHasil ? 'Klik untuk memuat analitik dari data yang ada' : 'Upload hasil PDF terlebih dahulu'}
        </p>
        <Button onClick={load} disabled={!hasHasil} size="sm" variant="outline">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <BarChart2 className="h-3.5 w-3.5 mr-1.5" />}
          Muat Analitik
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!data) return null

  const s = data.stats
  const total = s?.total ?? 0
  const maxMapel1 = data.topMapel1[0]?.jumlah ?? 1
  const maxMapel2 = data.topMapel2[0]?.jumlah ?? 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Analitik Hasil TKA — {total} Peserta
        </h3>
        <Button onClick={load} disabled={loading} size="sm" variant="outline">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Total Peserta"
          value={total}
          color="bg-sky-50 dark:bg-sky-950/40 text-sky-500"
        />
        <StatCard
          icon={TrendingUp}
          label="Rata-rata B. Indonesia"
          value={s?.avg_bind?.toFixed(2) ?? '-'}
          sub={`Tertinggi: ${s?.max_bind?.toFixed(2) ?? '-'}`}
          color="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500"
        />
        <StatCard
          icon={TrendingUp}
          label="Rata-rata Matematika"
          value={s?.avg_mat?.toFixed(2) ?? '-'}
          sub={`Tertinggi: ${s?.max_mat?.toFixed(2) ?? '-'}`}
          color="bg-blue-50 dark:bg-blue-950/40 text-blue-500"
        />
        <StatCard
          icon={Award}
          label="Istimewa B. Indonesia"
          value={`${s?.istimewa_bind ?? 0} siswa`}
          sub={`Mat: ${s?.istimewa_mat ?? 0} · Ing: ${s?.istimewa_bing ?? 0}`}
          color="bg-amber-50 dark:bg-amber-950/40 text-amber-500"
        />
      </div>

      {/* Rata-rata mapel wajib */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Rata-rata Nilai Mapel Wajib</h4>
        <MapelWajibRadar
          avgBind={s?.avg_bind ?? 0}
          avgMat={s?.avg_mat ?? 0}
          avgBing={s?.avg_bing ?? 0}
        />
      </div>

      {/* Distribusi Kategori */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: 'Distribusi Bahasa Indonesia', items: data.distribBind },
          { label: 'Distribusi Matematika', items: data.distribMat },
          { label: 'Distribusi Bahasa Inggris', items: data.distribBing },
        ].map(({ label, items }) => (
          <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">{label}</h4>
            <DistribBar items={items} total={total} />
          </div>
        ))}
      </div>

      {/* Top Mapel Pilihan */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Top Mapel Pilihan 1 (Diambil)</h4>
          <MapelBarChart items={data.topMapel1} maxVal={maxMapel1} />
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Top Mapel Pilihan 2 (Diambil)</h4>
          <MapelBarChart items={data.topMapel2} maxVal={maxMapel2} />
        </div>
      </div>

      {/* Per Kelas */}
      {data.perKelas.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Perbandingan Antar Kelas</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Kelas</th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-2.5">Peserta</th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-2.5">Avg B.Ind</th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-2.5">Avg Mat</th>
                  <th className="text-center text-xs font-semibold text-slate-500 px-4 py-2.5">Avg B.Ing</th>
                </tr>
              </thead>
              <tbody>
                {data.perKelas.map((k: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                      {k.tingkat ? `${k.tingkat}-${k.nomor_kelas} ${k.kelompok}` : 'Kelas tidak diketahui'}
                    </td>
                    <td className="px-4 py-2.5 text-center text-sm">{k.jumlah_siswa}</td>
                    <td className="px-4 py-2.5 text-center">
                      <AvgCell val={k.avg_bind} allAvg={s?.avg_bind} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <AvgCell val={k.avg_mat} allAvg={s?.avg_mat} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <AvgCell val={k.avg_bing} allAvg={s?.avg_bing} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function AvgCell({ val, allAvg }: { val: number | null; allAvg: number | null }) {
  if (val == null) return <span className="text-slate-400 text-xs">-</span>
  const isAbove = allAvg != null && val > allAvg
  const isBelow = allAvg != null && val < allAvg
  return (
    <span className={cn(
      'text-sm font-semibold',
      isAbove ? 'text-emerald-600 dark:text-emerald-400' :
      isBelow ? 'text-red-500 dark:text-red-400' :
      'text-slate-700 dark:text-slate-300'
    )}>
      {val.toFixed(2)}
    </span>
  )
}
