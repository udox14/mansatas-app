'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { komiteFundLabel, type BudgetPosition } from '@/lib/komite-funds'

export const fundSelectClass = 'h-9 w-full rounded-md border bg-background px-2 text-sm'

export function FundSourceOptions({ years, report = false }: { years: number[]; report?: boolean }) {
  return <>
    <option value={report ? 'all' : ''}>{report ? 'Semua Angkatan' : 'Pilih sumber dana'}</option>
    {years.map(year=><option key={year} value={year}>{komiteFundLabel(String(year))}</option>)}
    <option value="general">Kas Umum</option>
    {report && <option value="unmapped">Belum Dipetakan</option>}
  </>
}

export function FundAllocationFields({ years, positions, amount }: {years:number[]; positions: BudgetPosition[]; amount: number}) {
  const [rows,setRows] = useState([{ source:'', groupId:'', amount:'' }])
  const effective = rows.map(row=>({...row,amount:rows.length===1 ? amount : Number(row.amount)}))
  function update(index:number, values:Partial<(typeof rows)[number]>) {
    setRows(current=>current.map((row,i)=>i===index ? {...row,...values} : row))
  }
  return <fieldset className="space-y-2 rounded-md border p-3">
    <legend className="px-1 text-sm font-medium">Alokasi sumber dana</legend>
    <input type="hidden" name="fund_allocations" value={JSON.stringify(effective)}/>
    {rows.map((row,index)=><div key={index} className="grid gap-2 sm:grid-cols-3">
      <select required aria-label="Sumber dana" className={fundSelectClass} value={row.source} onChange={e=>update(index,{source:e.target.value,groupId:''})}><FundSourceOptions years={years}/></select>
      {Number(row.source)>=2026 && <select required aria-label="Pos RAPBM" className={fundSelectClass} value={row.groupId} onChange={e=>update(index,{groupId:e.target.value})}>
        <option value="">Pilih pos RAPBM</option>{positions.filter(p=>p.cohort===Number(row.source)).map(p=><option key={p.group_id} value={p.group_id}>{p.account} · {p.label} · Rp {p.available.toLocaleString('id-ID')}</option>)}
      </select>}
      {rows.length>1 && <div className="flex gap-2"><Input required type="number" min="1" aria-label="Nominal alokasi" value={row.amount} onChange={e=>update(index,{amount:e.target.value})}/><Button type="button" variant="ghost" onClick={()=>setRows(current=>current.filter((_,i)=>i!==index))}>Hapus</Button></div>}
    </div>)}
    {rows.length<20 && <Button type="button" variant="outline" size="sm" onClick={()=>setRows(current=>[...current,{source:'',groupId:'',amount:''}])}>Tambah alokasi</Button>}
  </fieldset>
}
