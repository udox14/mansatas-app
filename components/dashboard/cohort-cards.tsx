'use client'

import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { komiteFundLabel } from '@/lib/komite-funds'
import { cn } from '@/lib/utils'

export type CohortMetric = { label: string; value: string; details?: { label: string; value: string }[] }

export function CohortCards({ activeYears, years, value, onChange, metrics, cashScopes, disabled, compact = false }: {
  activeYears: number[]
  years: number[]
  value: string
  onChange: (value: string) => void
  metrics: Record<string, CohortMetric | undefined>
  cashScopes?: boolean
  disabled?: boolean
  compact?: boolean
}) {
  const cards = ['all', ...activeYears.map(String)]
  const other = [...new Set([
    ...years.map(String).filter(year => !cards.includes(year)),
    ...(cashScopes ? ['general', 'unmapped'] : []),
    ...(!cards.includes(value) ? [value] : []),
  ])]

  if (compact) {
    return (
      <section aria-label="Filter sumber dana angkatan" className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-stretch gap-1.5">
          {cards.map(scope => {
            const selected = value === scope
            const metric = metrics[scope]
            return (
              <button
                key={scope}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onChange(scope)}
                className={cn(
                  'flex min-w-[140px] flex-1 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                  selected
                    ? 'border-emerald-600 bg-emerald-50/80 text-slate-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-white'
                    : 'border-transparent bg-slate-50/80 text-slate-700 hover:bg-slate-100 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <span className="truncate">{komiteFundLabel(scope)}</span>
                    {selected && <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                  </div>
                  <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    {metric?.value ?? '—'}
                  </p>
                  {metric?.label && (
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{metric.label}</p>
                  )}
                </div>
              </button>
            )
          })}
          {other.length > 0 && (
            <div className="flex items-center">
              <Select disabled={disabled} value={cards.includes(value) ? '' : value} onValueChange={onChange}>
                <SelectTrigger
                  aria-label="Cakupan sumber dana lainnya"
                  className={cn(
                    'h-full min-h-12 w-auto min-w-36 rounded-lg text-xs font-medium',
                    !cards.includes(value) && 'border-emerald-600 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-100',
                  )}
                >
                  <SelectValue placeholder="Cakupan lain" />
                </SelectTrigger>
                <SelectContent>
                  {other.map(scope => (
                    <SelectItem key={scope} value={scope}>{komiteFundLabel(scope)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </section>
    )
  }

  return <section aria-label="Ringkasan dan filter angkatan" className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Filter Sumber Dana Angkatan</p>
      {other.length > 0 && (
        <Select disabled={disabled} value={cards.includes(value) ? '' : value} onValueChange={onChange}>
          <SelectTrigger aria-label="Cakupan lain" className="h-8 w-auto min-w-40 text-xs">
            <SelectValue placeholder="Cakupan lain" />
          </SelectTrigger>
          <SelectContent>{other.map(scope => <SelectItem key={scope} value={scope}>{komiteFundLabel(scope)}</SelectItem>)}</SelectContent>
        </Select>
      )}
    </div>
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {cards.map(scope => {
        const selected = value === scope
        const metric = metrics[scope]
        return <button key={scope} type="button" disabled={disabled} aria-pressed={selected} onClick={() => onChange(scope)}
          className="min-w-0 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
          <Card className={cn('h-full shadow-none transition-colors hover:bg-muted/50', selected && 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600 dark:border-emerald-500 dark:bg-emerald-950/30 dark:ring-emerald-500')}>
            <CardContent className="space-y-1.5 p-3 sm:p-3.5">
              <div className="flex items-start justify-between gap-1 text-sm font-semibold">
                {komiteFundLabel(scope)} {selected && <Check aria-hidden className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{metric?.label}</p>
                <p className="break-words text-base font-bold tabular-nums sm:text-lg">{metric?.value ?? '—'}</p>
              </div>
              {metric?.details?.map(item => <p key={item.label} className="text-xs text-muted-foreground">{item.label} <span className="font-medium tabular-nums text-foreground">{item.value}</span></p>)}
            </CardContent>
          </Card>
        </button>
      })}
    </div>
  </section>
}

export function DashboardCohortCards({ period, ...props }: Omit<React.ComponentProps<typeof CohortCards>, 'onChange'> & { period: string }) {
  const router = useRouter()
  return <CohortCards {...props} onChange={scope => {
    const params = new URLSearchParams({ period })
    if (scope !== 'all') params.set('fund', scope)
    router.push(`/dashboard?${params}`, { scroll: false })
  }} />
}
