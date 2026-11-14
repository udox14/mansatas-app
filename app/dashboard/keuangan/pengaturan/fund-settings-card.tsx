'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FundSourceOptions, fundSelectClass } from '@/components/dashboard/komite-fund-fields'
import { komiteFundLabel } from '@/lib/komite-funds'
import { saveKomiteFundOpeningBalance, saveKomiteFundSetting } from './actions'

export function FundSettingsCard({years,overdrafts,canUpdate}:{years:number[];overdrafts:{source:string;allow_negative:number}[];canUpdate:boolean}) {
  const [settings,setSettings]=useState(()=>Object.fromEntries(overdrafts.map(row=>[row.source,Boolean(row.allow_negative)])))
  const [message,setMessage]=useState('')
  const [pending,start]=useTransition()
  return <section className="space-y-4 rounded-xl border p-4">
    <h2 className="font-semibold">Sumber Dana Komite</h2>
    <p className="text-sm text-muted-foreground">Secara default, pencairan ditahan ketika saldo sumber dana kurang.</p>
    <div className="grid gap-2 sm:grid-cols-3">
      {['general',...years.map(String)].map(source=><label key={source} className="flex gap-2 rounded border p-2 text-sm">
        <input type="checkbox" checked={settings[source]??false} disabled={!canUpdate||pending}
          onChange={e=>{const allowed=e.target.checked;start(async()=>{
            const result=await saveKomiteFundSetting(source,allowed)
            if(result.success)setSettings(current=>({...current,[source]:allowed}))
            setMessage(result.error??result.success??'')
          })}}/> Izinkan saldo minus · {komiteFundLabel(source)}
      </label>)}
    </div>
    {canUpdate&&<form className="grid items-end gap-2 sm:grid-cols-4" action={data=>start(async()=>{
      const result=await saveKomiteFundOpeningBalance(data)
      setMessage(result.error??result.success??'')
    })}>
      <label className="text-sm">Sumber saldo awal laporan<select name="fund" required className={fundSelectClass}><FundSourceOptions years={years}/><option value="unmapped">Belum Dipetakan</option></select></label>
      <label className="text-sm">Bulan<Input name="period" required type="month"/></label>
      <label className="text-sm">Saldo awal (Rp)<Input name="amount" required type="number" step={1}/></label>
      <Button disabled={pending}>Simpan saldo awal</Button>
    </form>}
    {message&&<p role="status" className="text-sm">{message}</p>}
  </section>
}
