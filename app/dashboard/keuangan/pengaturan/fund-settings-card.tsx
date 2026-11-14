'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FundSourceSelect } from '@/components/dashboard/komite-fund-fields'
import { komiteFundLabel } from '@/lib/komite-funds'
import { saveKomiteFundOpeningBalance, saveKomiteFundSetting } from './actions'

export function FundSettingsCard({years,overdrafts,canUpdate}:{years:number[];overdrafts:{source:string;allow_negative:number}[];canUpdate:boolean}) {
  const [settings,setSettings]=useState(()=>Object.fromEntries(overdrafts.map(row=>[row.source,Boolean(row.allow_negative)])))
  const [message,setMessage]=useState('')
  const [pending,start]=useTransition()
  return <Card>
    <CardHeader className="pb-4"><CardTitle className="text-base">Sumber Dana Komite</CardTitle>
      <CardDescription>Secara default, pencairan ditahan ketika saldo sumber dana kurang.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {['general',...years.map(String)].map(source=><div key={source} className="flex items-center gap-2">
        <Checkbox id={`allow-negative-${source}`} checked={settings[source]??false} disabled={!canUpdate||pending}
          onCheckedChange={value=>{const allowed=value===true;start(async()=>{
            const result=await saveKomiteFundSetting(source,allowed)
            if(result.success)setSettings(current=>({...current,[source]:allowed}))
            setMessage(result.error??result.success??'')
          })}}/><Label htmlFor={`allow-negative-${source}`} className="font-normal">Izinkan saldo minus · {komiteFundLabel(source)}</Label>
      </div>)}
    </div>
    {canUpdate&&<form className="grid items-end gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4" action={data=>start(async()=>{
      const result=await saveKomiteFundOpeningBalance(data)
      setMessage(result.error??result.success??'')
    })}>
      <div className="space-y-2"><Label htmlFor="opening-fund">Sumber saldo awal laporan</Label><FundSourceSelect id="opening-fund" name="fund" required years={years} includeUnmapped /></div>
      <div className="space-y-2"><Label htmlFor="opening-period">Bulan</Label><Input id="opening-period" name="period" required type="month"/></div>
      <div className="space-y-2"><Label htmlFor="opening-amount">Saldo awal (Rp)</Label><Input id="opening-amount" name="amount" required type="number" step={1}/></div>
      <Button disabled={pending}>Simpan saldo awal</Button>
    </form>}
    {message&&<p role="status" className="text-sm">{message}</p>}
    </CardContent>
  </Card>
}
