// components/dashboard/charts/chartPrimitives.tsx
// Helper kecil dipakai bersama komponen grafik (client-only).
'use client'
import { useEffect, useState } from 'react'

// Recharts ResponsiveContainer butuh ukuran DOM -> render hanya setelah mount
// supaya tidak ada hydration mismatch / warning width(0) saat SSR.
export function useChartMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

// Palet aman untuk light & dark
export const AXIS_TICK = { fontSize: 10, fill: '#94a3b8' }
export const TOOLTIP_STYLE = {
  background: 'rgba(15,23,42,0.92)',
  border: 'none',
  borderRadius: 8,
  fontSize: 12,
  padding: '6px 10px',
}
export const TOOLTIP_ITEM = { color: '#e2e8f0' }
export const TOOLTIP_LABEL = { color: '#fff', fontWeight: 600, marginBottom: 2 }

// 'YYYY-MM-DD' -> 'DD/MM'
export function shortDate(tgl: string) {
  const [, m, d] = tgl.split('-')
  return d && m ? `${d}/${m}` : tgl
}

export function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[120px] text-center px-2">
      <p className="text-[11px] text-slate-400 dark:text-slate-500">{message}</p>
    </div>
  )
}

export function ChartSkeleton({ height = 160 }: { height?: number }) {
  return <div className="w-full animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" style={{ height }} />
}
