// components/dashboard/charts/KedisiplinanCharts.tsx
'use client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import {
  useChartMounted, AXIS_TICK, TOOLTIP_STYLE, TOOLTIP_ITEM, TOOLTIP_LABEL,
  shortDate, ChartEmpty, ChartSkeleton,
} from './chartPrimitives'

export function PelanggaranTrend({ data }: { data: { tgl: string; cnt: number }[] }) {
  const mounted = useChartMounted()
  const total = data.reduce((s, r) => s + r.cnt, 0)
  if (total === 0) return <ChartEmpty message="Tidak ada pelanggaran 14 hari terakhir 👍" />
  if (!mounted) return <ChartSkeleton height={160} />

  const rows = data.map(r => ({ label: shortDate(r.tgl), cnt: r.cnt }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={rows} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.3} vertical={false} />
        <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} cursor={{ fill: '#94a3b8', fillOpacity: 0.1 }} />
        <Bar dataKey="cnt" name="Pelanggaran" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TopPelanggaranBar({ data }: { data: { nama: string; count: number }[] }) {
  const mounted = useChartMounted()
  if (!data || data.length === 0) return <ChartEmpty message="Belum ada data pelanggaran" />
  if (!mounted) return <ChartSkeleton height={160} />

  const rows = data.map(r => ({ ...r, short: r.nama.length > 22 ? r.nama.slice(0, 21) + '…' : r.nama }))
  const height = Math.max(140, rows.length * 32)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.3} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="short" tick={{ ...AXIS_TICK, fontSize: 9 }} axisLine={false} tickLine={false} width={108} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} cursor={{ fill: '#94a3b8', fillOpacity: 0.1 }} />
        <Bar dataKey="count" name="Kasus" fill="#fb923c" radius={[0, 3, 3, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  )
}

const PRESENSI_COLORS: Record<string, string> = {
  hadir: '#10b981',
  dinas_luar: '#0ea5e9',
  izin: '#f59e0b',
  sakit: '#a855f7',
  alfa: '#f43f5e',
}
const PRESENSI_LABEL: Record<string, string> = {
  hadir: 'Hadir',
  dinas_luar: 'Dinas Luar',
  izin: 'Izin',
  sakit: 'Sakit',
  alfa: 'Alfa',
}

export function PresensiDonut({ data }: { data: { status: string; count: number }[] }) {
  const mounted = useChartMounted()
  const total = data.reduce((s, r) => s + r.count, 0)
  if (total === 0) return <ChartEmpty message="Belum ada presensi pegawai hari ini" />
  if (!mounted) return <ChartSkeleton height={160} />

  const rows = data
    .filter(r => r.count > 0)
    .map(r => ({ key: r.status, name: PRESENSI_LABEL[r.status] ?? r.status, value: r.count }))

  return (
    <div className="flex items-center gap-3">
      <ResponsiveContainer width="52%" height={150}>
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius={36} outerRadius={58} paddingAngle={2} stroke="none">
            {rows.map(r => <Cell key={r.key} fill={PRESENSI_COLORS[r.key] ?? '#94a3b8'} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 flex flex-col gap-1.5 text-xs">
        {rows.map(r => {
          const pct = Math.round((r.value / total) * 100)
          return (
            <div key={r.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PRESENSI_COLORS[r.key] ?? '#94a3b8' }} />
              <span className="text-slate-700 dark:text-slate-200 flex-1 truncate">{r.name}</span>
              <span className="text-[10px] text-slate-400 tabular-nums">{r.value} · {pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
