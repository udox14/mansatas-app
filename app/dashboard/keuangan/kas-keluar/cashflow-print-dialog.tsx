'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { CashflowFilters, CashflowPageData } from '@/lib/cashflow'
import { komiteFundLabel } from '@/lib/komite-funds'
import { formatRupiah } from '@/lib/utils'
import { getCashflowPrintRows } from './actions'

export function CashflowPrintDialog({filters,data}:{filters:CashflowFilters;data:CashflowPageData}) {
  const ref=useRef<HTMLDivElement>(null)
  const [result,setResult]=useState<Awaited<ReturnType<typeof getCashflowPrintRows>> | null>(null)
  const [title,setTitle]=useState('Arus Kas Komite')
  const [detailed,setDetailed]=useState(true)
  const [landscape,setLandscape]=useState(false)
  const [signature,setSignature]=useState(false)
  const [pending,setPending]=useState(false)
  const [message,setMessage]=useState('')
  const pendingPrint=useRef<(() => void) | null>(null)
  useLayoutEffect(()=>{
    if (!result || !pendingPrint.current) return
    const resolve=pendingPrint.current
    pendingPrint.current=null
    resolve()
  },[result])
  const print=useReactToPrint({
    contentRef:ref, documentTitle:title,
    pageStyle:`@page { size:A4 ${landscape?'landscape':'portrait'}; margin:12mm } thead { display:table-header-group } tr { break-inside:avoid }`,
    onBeforePrint:async()=>{
      const loaded=await getCashflowPrintRows(filters,detailed)
      await new Promise<void>(resolve=>{
        pendingPrint.current=resolve
        setResult(loaded)
      })
    },
    onPrintError:()=>{setMessage('Gagal menyiapkan cetakan Arus Kas.');setPending(false)},
    onAfterPrint:()=>setPending(false),
  })
  const breakdown=[
    komiteFundLabel(filters.angkatan),
    filters.studentScope==='active_students' ? 'Siswa aktif' : 'Semua status siswa',
    filters.dateFrom || filters.dateTo ? `${filters.dateFrom||'Awal'} s.d. ${filters.dateTo||'Sekarang'}` : 'Semua tanggal',
    filters.direction==='income'?'Dana masuk':filters.direction==='expense'?'Dana keluar':'Semua arah',
    filters.source && filters.source!=='all' ? filters.source.toUpperCase():null,
    data.categories.find(row=>row.id===filters.categoryId)?.name,
    filters.method && filters.method!=='all' ? filters.method.toUpperCase():null,
    data.recorders.find(row=>row.id===filters.recorderId)?.name,
    data.classes.find(row=>row.id===filters.kelasId)?.label,
    filters.status==='all'?'Semua status':filters.status==='void'?'Batal':'Aktif',
    filters.search ? `Pencarian "${filters.search}"` : null,
  ].filter(Boolean).join(' · ')
  return <>
    <Dialog>
      <DialogTrigger asChild><Button type="button" variant="outline" className="mb-3">Cetak / Simpan PDF</Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>Cetak Arus Kas</DialogTitle></DialogHeader>
        <div className="space-y-2"><Label htmlFor="cash-print-title">Judul</Label><Input id="cash-print-title" maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="cash-print-content">Isi laporan</Label>
            <Select value={detailed?'detail':'summary'} onValueChange={value=>setDetailed(value==='detail')}><SelectTrigger id="cash-print-content"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="detail">Rincian</SelectItem><SelectItem value="summary">Ringkasan</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-2"><Label htmlFor="cash-print-orientation">Orientasi A4</Label>
            <Select value={landscape?'landscape':'portrait'} onValueChange={value=>setLandscape(value==='landscape')}><SelectTrigger id="cash-print-orientation"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="portrait">Potret</SelectItem><SelectItem value="landscape">Lanskap</SelectItem></SelectContent></Select>
          </div>
        </div>
        <div className="flex items-center gap-2"><Checkbox id="cash-print-signature" checked={signature} onCheckedChange={value=>setSignature(value===true)}/><Label htmlFor="cash-print-signature" className="font-normal">Sertakan tanda tangan Bendahara</Label></div>
        <p className="text-sm text-muted-foreground">{breakdown}</p>
        {message&&<p role="alert">{message}</p>}
        <Button disabled={pending} onClick={()=>{setPending(true);setMessage('');print()}}>Buka dialog cetak</Button>
      </DialogContent>
    </Dialog>
    <div className="hidden"><div ref={ref} className="font-sans text-xs text-black">
      <h1 className="text-xl font-bold">{title.trim() || 'Arus Kas Komite'}</h1>
      <p className="mb-3">{breakdown}</p>
      {result&&<>
        <p>Dana masuk {formatRupiah(result.income)} · Dana keluar {formatRupiah(result.expense)} · Selisih {formatRupiah(result.income-result.expense)}</p>
        {detailed&&<table className="mt-3 w-full border-collapse text-left"><thead><tr>{['Tanggal','Sumber dana','Uraian / Bukti','Status','Masuk','Keluar'].map(label=><th key={label} className="border p-1">{label}</th>)}</tr></thead><tbody>
          {!result.entries.length&&<tr><td colSpan={6} className="border p-2">Tidak ada transaksi sesuai filter.</td></tr>}
          {result.entries.map(row=><tr key={row.id}>{[row.transactionDate,row.fundSource?.split('|').map(komiteFundLabel).join(', '),[row.description,row.proofNumber].filter(Boolean).join(' / '),row.status==='void'?'Batal':'Aktif',row.direction==='income'?formatRupiah(row.amount):'—',row.direction==='expense'?formatRupiah(row.amount):'—'].map((value,i)=><td key={i} className="border p-1">{value}</td>)}</tr>)}
        </tbody></table>}
      </>}
      {signature&&<p className="ml-auto mt-8 w-52 text-center">Bendahara Komite<br/><br/><br/>___________________</p>}
    </div></div>
  </>
}
