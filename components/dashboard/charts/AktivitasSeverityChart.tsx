// components/dashboard/charts/AktivitasSeverityChart.tsx
'use client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import {
  useChartMounted, AXIS_TICK, TOOLTIP_STYLE, TOOLTIP_ITEM, TOOLTIP_LABEL,
  shortDate, ChartEmpty, ChartSkeleton,
} from './chartPrimitives'

type Row = { tgl: string; info: number; warning: number; danger: number }

export function AktivitasSeverityChart({ data }: { data: Row[] }) {
  const mounted = useChartMounted()
  const total = data.reduce((s, r) => s + r.info + r.warning + r.danger, 0)

  if (total === 0) return <ChartEmpty message="Belum ada aktivitas tercatat 7 hari terakhir" />
  if (!mounted) return <ChartSkeleton height={160} />

  const rows = data.map(r => ({ ...r, label: shortDate(r.tgl) }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={rows} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.3} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
        <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} cursor={{ fill: '#94a3b8', fillOpacity: 0.1 }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
        <Bar dataKey="info" name="Info" stackId="a" fill="#94a3b8" radius={[0, 0, 0, 0]} />
        <Bar dataKey="warning" name="Peringatan" stackId="a" fill="#f59e0b" />
        <Bar dataKey="danger" name="Bahaya" stackId="a" fill="#f43f5e" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
