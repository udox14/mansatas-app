'use client'

import { useState, type ComponentProps } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatRupiah } from '@/lib/utils'
import { Input } from '@/components/ui/input'
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
  const [rows,setRows] = useState([{ source:'', groupId:'', amount:'' }])
  const effective = rows.map(row=>({...row,amount:rows.length===1 ? amount : Number(row.amount)}))
  function update(index:number, values:Partial<(typeof rows)[number]>) {
    setRows(current=>current.map((row,i)=>i===index ? {...row,...values} : row))
  }
  return <fieldset className="space-y-2 rounded-md border p-3">
    <legend className="px-1 text-sm font-medium">Alokasi sumber dana</legend>
    <input type="hidden" name="fund_allocations" value={JSON.stringify(effective)}/>
    {rows.map((row,index)=>{
      const needsPosition=Number(row.source)>=2026
      const cohortPositions=positions.filter(position => position.cohort===Number(row.source))
      return <div key={index} className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
          <FundSourceSelect required years={years} value={row.source} onValueChange={source => update(index, { source, groupId: '' })} />
          {needsPosition && cohortPositions.length>0 && <BudgetPositionSelect positions={cohortPositions}
            value={row.groupId} onValueChange={groupId => update(index, { groupId })} />}
          {rows.length>1 && <div className="flex gap-2"><Input required type="number" min="1" aria-label="Nominal alokasi" value={row.amount} onChange={e=>update(index,{amount:e.target.value})}/><Button type="button" variant="ghost" onClick={()=>setRows(current=>current.filter((_,i)=>i!==index))}>Hapus</Button></div>}
        </div>
        {needsPosition && cohortPositions.length===0 && <div role="status" className="rounded-md border bg-muted/50 p-3 text-sm">
          <p>{historical
            ? `Pos RAPBM Angkatan ${row.source} belum tersedia untuk pemetaan. Buka RAPBM dan pilih Konfirmasi pagu untuk pemetaan.`
            : `Pilih angkatan dengan pagu RAPBM aktif. Pos untuk Angkatan ${row.source} belum tersedia.`}</p>
          <Button asChild variant="link" size="sm" className="h-auto px-0 pt-2"><Link href="/dashboard/keuangan/rapbm">Buka RAPBM</Link></Button>
        </div>}
      </div>
    })}
    {rows.length<20 && <Button type="button" variant="outline" size="sm" onClick={()=>setRows(current=>[...current,{source:'',groupId:'',amount:''}])}>Tambah alokasi</Button>}
  </fieldset>
}
