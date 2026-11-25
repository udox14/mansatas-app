'use client'

import { useState, type ComponentProps } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatRupiah } from '@/lib/utils'
import { RupiahInput } from '@/components/ui/rupiah-input'
import { komiteFundLabel, type BudgetPosition } from '@/lib/komite-funds'

type FundSourceSelectProps = ComponentProps<typeof Select> & {
  years: number[]
  report?: boolean
  includeUnmapped?: boolean
  allValue?: string
  id?: string
  className?: string
}

export function FundSourceSelect({
  years, report, includeUnmapped, allValue = 'all', id, className, ...props
}: FundSourceSelectProps) {
  return <Select {...props}>
    <SelectTrigger id={id} className={className} aria-label="Sumber dana">
      <SelectValue placeholder="Pilih sumber dana" />
    </SelectTrigger>
    <SelectContent>
      {report && <SelectItem value={allValue}>Semua Angkatan</SelectItem>}
      {years.map(year => <SelectItem key={year} value={String(year)}>{komiteFundLabel(String(year))}</SelectItem>)}
      <SelectItem value="general">Kas Umum</SelectItem>
      {(report || includeUnmapped) && <SelectItem value="unmapped">Belum Dipetakan</SelectItem>}
    </SelectContent>
  </Select>
}

export function BudgetPositionSelect({ id, positions, value, onValueChange }: {
  id?: string; positions: BudgetPosition[]; value: string; onValueChange: (value: string) => void
}) {
  return <Select required value={value} onValueChange={onValueChange}>
    <SelectTrigger id={id} aria-label="Pos RAPBM"><SelectValue placeholder="Pilih pos RAPBM" /></SelectTrigger>
    <SelectContent>
      {positions.map(position => <SelectItem key={position.group_id} value={position.group_id}>
        {[position.account, position.label, `Sisa ${formatRupiah(position.available)}`].filter(Boolean).join(' · ')}
      </SelectItem>)}
    </SelectContent>
  </Select>
}

export function FundAllocationFields({ years, positions, amount, historical = false }: {
  years: number[]; positions: BudgetPosition[]; amount: number; historical?: boolean
}) {
  const [rows, setRows] = useState([{ source: '', groupId: '', amount: '' }])
  const effective = rows.map(row => ({ ...row, amount: rows.length === 1 ? amount : Number(row.amount || 0) }))
  const allocatedSum = effective.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0)
  const diff = amount - allocatedSum

  function update(index: number, values: Partial<(typeof rows)[number]>) {
    setRows(current => current.map((row, i) => (i === index ? { ...row, ...values } : row)))
  }

  return <fieldset className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Alokasi Sumber Dana</legend>
    <input type="hidden" name="fund_allocations" value={JSON.stringify(effective)} />
    {rows.map((row, index) => {
      const needsPosition = Number(row.source) >= 2026
      const cohortPositions = positions.filter(position => position.cohort === Number(row.source))
      return <div key={index} className="space-y-2">
        <div className={`grid gap-2 ${rows.length > 1 ? 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]' : 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]'}`}>
          <FundSourceSelect required years={years} value={row.source} onValueChange={source => update(index, { source, groupId: '' })} />
          {needsPosition && cohortPositions.length > 0 && <BudgetPositionSelect positions={cohortPositions}
            value={row.groupId} onValueChange={groupId => update(index, { groupId })} />}
          {rows.length > 1 && (
            <div className="flex gap-1.5">
              <div className="min-w-0 flex-1">
                <RupiahInput
                  required
                  min={1}
                  aria-label="Nominal alokasi"
                  placeholder="Nominal"
                  value={row.amount}
                  onValueChange={digits => update(index, { amount: digits })}
                />
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-xs text-rose-600 hover:text-rose-700" onClick={() => setRows(current => current.filter((_, i) => i !== index))}>Hapus</Button>
            </div>
          )}
        </div>
        {needsPosition && cohortPositions.length === 0 && <div role="status" className="rounded-md border bg-muted/50 p-3 text-sm">
          <p>{historical
            ? `Pos RAPBM Angkatan ${row.source} belum tersedia untuk pemetaan. Buka RAPBM dan pilih Konfirmasi pagu untuk pemetaan.`
            : `Pilih angkatan dengan pagu RAPBM aktif. Pos untuk Angkatan ${row.source} belum tersedia.`}</p>
          <Button asChild variant="link" size="sm" className="h-auto px-0 pt-2"><Link href="/dashboard/keuangan/rapbm">Buka RAPBM</Link></Button>
        </div>}
      </div>
    })}
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
      {rows.length < 20 && (
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setRows(current => [...current, { source: '', groupId: '', amount: '' }])}>
          Bagi ke sumber dana lain
        </Button>
      )}
      {rows.length > 1 && (
        <p className={`text-xs font-medium tabular-nums ${diff === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
          {diff === 0 ? `Total alokasi pas (${formatRupiah(amount)})` : diff > 0 ? `Kurang alokasi ${formatRupiah(diff)}` : `Kelebihan alokasi ${formatRupiah(-diff)}`}
        </p>
      )}
    </div>
  </fieldset>
}
