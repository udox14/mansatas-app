'use client'

import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { komiteFundLabel } from '@/lib/komite-funds'
import { cn } from '@/lib/utils'

export type CohortMetric = { label: string; value: string; details?: { label: string; value: string }[] }

export function CohortCards({ activeYears, years, value, onChange, metrics, cashScopes, disabled }: {
  activeYears: number[]
  years: number[]
  value: string
  onChange: (value: string) => void
  metrics: Record<string, CohortMetric | undefined>
  cashScopes?: boolean
  disabled?: boolean
}) {
  const cards = ['all', ...activeYears.map(String)]
  const other = [...new Set([
    ...years.map(String).filter(year => !cards.includes(year)),
    ...(cashScopes ? ['general', 'unmapped'] : []),
    ...(!cards.includes(value) ? [value] : []),
  ])]
  return <section aria-label="Ringkasan dan filter angkatan" className="space-y-2">
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {cards.map(scope => {
        const selected = value === scope
        const metric = metrics[scope]
        return <button key={scope} type="button" disabled={disabled} aria-pressed={selected} onClick={() => onChange(scope)}
          className="min-w-0 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
          <Card className={cn('h-full transition-colors hover:bg-muted/50', selected && 'border-primary bg-primary/5 ring-1 ring-primary')}>
            <CardContent className="space-y-1.5 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-1 text-sm font-semibold">
                {komiteFundLabel(scope)} {selected && <Check aria-hidden className="h-4 w-4 shrink-0 text-primary"/>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{metric?.label}</p>
                <p className="break-words text-base font-bold tabular-nums sm:text-lg">{metric?.value ?? '—'}</p>
              </div>
              {metric?.details?.map(item => <p key={item.label} className="text-xs text-muted-foreground">{item.label} <span className="font-medium text-foreground">{item.value}</span></p>)}
            </CardContent>
          </Card>
        </button>
      })}
    </div>
    {other.length > 0 && <div className="flex justify-end">
      <Select disabled={disabled} value={cards.includes(value) ? '' : value} onValueChange={onChange}>
        <SelectTrigger aria-label="Cakupan lain" className="w-auto min-w-40"><SelectValue placeholder="Cakupan lain"/></SelectTrigger>
        <SelectContent>{other.map(scope => <SelectItem key={scope} value={scope}>{komiteFundLabel(scope)}</SelectItem>)}</SelectContent>
      </Select>
    </div>}
  </section>
}

export function DashboardCohortCards({ period, ...props }: Omit<React.ComponentProps<typeof CohortCards>, 'onChange'> & { period: string }) {
  const router = useRouter()
  return <CohortCards {...props} onChange={scope=>{
    const params = new URLSearchParams({period})
    if (scope !== 'all') params.set('fund',scope)
    router.push(`/dashboard?${params}`,{scroll:false})
  }}/>
}
