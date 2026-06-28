// components/dashboard/charts/DemografiCharts.tsx
'use client'
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import {
  useChartMounted, AXIS_TICK, TOOLTIP_STYLE, TOOLTIP_ITEM, TOOLTIP_LABEL,
  ChartEmpty, ChartSkeleton,
} from './chartPrimitives'

const GENDER_COLORS = { L: '#3b82f6', P: '#ec4899' }
const DOMISILI_COLOR = '#8b5cf6'
const ANGKATAN_COLOR = '#0ea5e9'
const MAX_DOMISILI = 6

export function GenderDonut({ gender }: { gender: { L: number; P: number } }) {
  const mounted = useChartMounted()
  const total = gender.L + gender.P
  if (total === 0) return <ChartEmpty message="Belum ada data siswa" />
  if (!mounted) return <ChartSkeleton height={160} />

  const data = [
    { name: 'Laki-laki', key: 'L', value: gender.L },
    { name: 'Perempuan', key: 'P', value: gender.P },
  ].filter(d => d.value > 0)

  return (
    <div className="flex items-center gap-3">
      <ResponsiveContainer width="55%" height={150}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={38} outerRadius={60} paddingAngle={2} stroke="none">
            {data.map(d => <Cell key={d.key} fill={GENDER_COLORS[d.key as 'L' | 'P']} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-2 text-xs">
        <Legend color={GENDER_COLORS.L} label="Laki-laki" value={gender.L} total={total} />
        <Legend color={GENDER_COLORS.P} label="Perempuan" value={gender.P} total={total} />
      </div>
    </div>
  )
}

function Legend({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
      <div>
        <p className="text-slate-700 dark:text-slate-200 font-medium leading-tight">{label}</p>
        <p className="text-[10px] text-slate-400 tabular-nums">{value} · {pct}%</p>
      </div>
    </div>
  )
}

export function AngkatanBar({ data }: { data: { angkatan: number; count: number }[] }) {
  const mounted = useChartMounted()
  if (!data || data.length === 0) return <ChartEmpty message="Belum ada data angkatan" />
  if (!mounted) return <ChartSkeleton height={160} />

  const rows = [...data].sort((a, b) => a.angkatan - b.angkatan).map(d => ({ label: String(d.angkatan), count: d.count }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={rows} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.3} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} cursor={{ fill: '#94a3b8', fillOpacity: 0.1 }} />
        <Bar dataKey="count" name="Siswa" fill={ANGKATAN_COLOR} radius={[3, 3, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DomisiliBar({ data }: { data: { label: string; count: number }[] }) {
  const mounted = useChartMounted()
  if (!data || data.length === 0) return <ChartEmpty message="Belum ada data domisili" />
  if (!mounted) return <ChartSkeleton height={180} />

  // Top-N + gabung sisanya jadi "Lainnya"
  const sorted = [...data].sort((a, b) => b.count - a.count)
  let rows = sorted
  if (sorted.length > MAX_DOMISILI) {
    const head = sorted.slice(0, MAX_DOMISILI - 1)
    const rest = sorted.slice(MAX_DOMISILI - 1).reduce((s, r) => s + r.count, 0)
    rows = [...head, { label: 'Lainnya', count: rest }]
  }
  const shortened = rows.map(r => ({ ...r, short: r.label.replace(/^Pesantren\s+/i, '') }))
  const height = Math.max(140, shortened.length * 30)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={shortened} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.3} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="short" tick={AXIS_TICK} axisLine={false} tickLine={false} width={92} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} cursor={{ fill: '#94a3b8', fillOpacity: 0.1 }} />
        <Bar dataKey="count" name="Siswa" fill={DOMISILI_COLOR} radius={[0, 3, 3, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}
