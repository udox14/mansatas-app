'use client'

import { FundSourceOptions, fundSelectClass } from '@/components/dashboard/komite-fund-fields'
import { useState } from 'react'
import { Download, FileSpreadsheet, Loader2, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { KomiteReportRequest } from '@/lib/komite-financial-report'
import type { KomiteReportSettings, OpeningBalanceMode } from '@/lib/komite-report-settings'
import { openPdfFromUrl } from '@/lib/pdf/download'
import { todayWIB } from '@/lib/time'

export function OfficialReportDialog({ settings, years, initialFund }: { settings: KomiteReportSettings; years:number[]; initialFund?:string }) {
  const [fund,setFund]=useState(initialFund ?? 'all')
  const [open, setOpen] = useState(false)
  const [period, setPeriod] = useState(todayWIB().slice(0, 7))
  const [scope, setScope] = useState<'all' | 'active_students'>('all')
  const [openingMode, setOpeningMode] = useState<OpeningBalanceMode>(settings.openingBalanceMode)
  const [openingAmount, setOpeningAmount] = useState('0')
  const [signaturesEnabled, setSignaturesEnabled] = useState(settings.signaturesEnabled)
  const [treasurerName, setTreasurerName] = useState(settings.treasurerName)
  const [chairmanName, setChairmanName] = useState(settings.chairmanName)
  const [principalName, setPrincipalName] = useState(settings.principalName)
  const [excelLayout, setExcelLayout] = useState<'four_sheets' | 'single_sheet' | 'summary_bku'>('four_sheets')
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null)
  const [message, setMessage] = useState('')

  function payload(): KomiteReportRequest {
    return {
      period, scope, fund,
      openingBalance: { mode: openingMode, amount: openingMode === 'manual' ? Number(openingAmount) : undefined },
      signatures: { enabled: signaturesEnabled, treasurerName, chairmanName, principalName },
      excelLayout,
    }
  }

  async function download(kind: 'pdf' | 'xlsx') {
    setBusy(kind); setMessage('')
    try {
      await openPdfFromUrl(`/api/keuangan/laporan/bulanan/${kind}`, `Laporan_Keuangan_Komite_${period}.${kind}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()),
      })
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Laporan gagal dibuat.')
    } finally { setBusy(null) }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" className="h-9 gap-2 text-xs"><ReceiptText className="h-4 w-4"/> Laporan Bulanan / BKU</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Laporan Keuangan Bulanan / BKU</DialogTitle></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bulan laporan"><Input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></Field>
        <Field label="Sumber dana"><select className={fundSelectClass} value={fund} onChange={e=>setFund(e.target.value)}><FundSourceOptions years={years} report /></select></Field>
        <Field label="Cakupan transaksi"><Select value={scope} onValueChange={v=>setScope(v as typeof scope)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Semua transaksi sah</SelectItem><SelectItem value="active_students">Siswa aktif saja</SelectItem></SelectContent></Select></Field>
        <Field label="Sumber saldo awal"><Select value={openingMode} onValueChange={v=>setOpeningMode(v as OpeningBalanceMode)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="cumulative">Kumulatif sebelum bulan</SelectItem><SelectItem value="manual">Input manual</SelectItem><SelectItem value="stored">Saldo bulanan tersimpan</SelectItem></SelectContent></Select></Field>
        {openingMode==='manual' ? <Field label="Saldo awal manual (Rp)"><Input type="number" step="1" value={openingAmount} onChange={e=>setOpeningAmount(e.target.value)}/></Field> : <div/>}
        <Field label="Layout Excel"><Select value={excelLayout} onValueChange={v=>setExcelLayout(v as typeof excelLayout)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="four_sheets">4 sheet lengkap</SelectItem><SelectItem value="single_sheet">1 sheet panjang</SelectItem><SelectItem value="summary_bku">Ringkasan + BKU</SelectItem></SelectContent></Select></Field>
        <label className="flex items-center gap-2 self-end rounded-md border px-3 py-2 text-sm"><input type="checkbox" checked={signaturesEnabled} onChange={e=>setSignaturesEnabled(e.target.checked)}/> Sertakan tiga pejabat penanda tangan</label>
      </div>
      {signaturesEnabled && <div className="grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900 sm:grid-cols-3"><Field label="Bendahara Komite"><Input value={treasurerName} onChange={e=>setTreasurerName(e.target.value)} placeholder="Nama bendahara"/></Field><Field label="Ketua Komite"><Input value={chairmanName} onChange={e=>setChairmanName(e.target.value)} placeholder="Nama ketua"/></Field><Field label="Kepala Madrasah"><Input value={principalName} onChange={e=>setPrincipalName(e.target.value)} placeholder="Nama kepala"/></Field></div>}
      <p className="text-xs text-slate-500">PDF dan Excel memakai data serta perhitungan saldo yang sama. Transaksi batal tidak disertakan.</p>
      {message && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={()=>setOpen(false)}>Batal</Button><Button variant="outline" onClick={()=>download('xlsx')} disabled={!!busy}>{busy==='xlsx'?<Loader2 className="h-4 w-4 animate-spin"/>:<FileSpreadsheet className="h-4 w-4"/>} Unduh Excel</Button><Button onClick={()=>download('pdf')} disabled={!!busy}>{busy==='pdf'?<Loader2 className="h-4 w-4 animate-spin"/>:<Download className="h-4 w-4"/>} Unduh PDF</Button></div>
    </DialogContent>
  </Dialog>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</label>{children}</div>
}

