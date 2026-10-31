'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ChevronDown, Download, FileSpreadsheet, Loader2, Search, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatRupiah } from '@/lib/utils'
import { filterRapbmGroups, rapbmStatusLabel, type RapbmActionResult, type RapbmAmounts, type RapbmGroup, type RapbmItem, type RapbmNote, type RapbmPageData } from '@/lib/rapbm'
import { importInitialRapbmAction, publishRapbmAction } from './actions'

const money=(value:number|null)=>value===null?'—':formatRupiah(value)
const date=(value:string)=>new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeZone:'Asia/Jakarta'}).format(new Date(value.includes('T')?value:`${value.replace(' ','T')}Z`))

export function RapbmClient({data}:{data:RapbmPageData}) {
  const router=useRouter()
  const [pending,startTransition]=useTransition()
  const [importOpen,setImportOpen]=useState(false)
  const [message,setMessage]=useState<{text:string;error:boolean}|null>(null)
  const [query,setQuery]=useState('')
  const [funding,setFunding]=useState('all')
  const [tab,setTab]=useState('expense')
  const {selected,document,versions,canManage}=data
  const years=Array.from(new Set(versions.map(v=>v.year)))
  const groups=document?filterRapbmGroups(document.expenses,query,funding):[]
  const filtered=query.trim()!=='' || funding!=='all'
  const has2026=versions.some(v=>v.year===2026)

  function navigate(year:number,version?:string) {
    const params=new URLSearchParams({year:String(year)})
    if (version) params.set('version',version)
    router.push(`/dashboard/keuangan/rapbm?${params}`)
  }
  function run(task:()=>Promise<RapbmActionResult>,close?:()=>void) {
    setMessage(null)
    startTransition(async()=>{
      try {
        const result=await task()
        if (result.error!==undefined) throw new Error(result.error)
        setMessage({text:result.success,error:false})
        close?.()
        navigate(result.year,result.id)
        router.refresh()
      } catch(error) {setMessage({text:error instanceof Error?error.message:'RAPBM belum dapat diproses. Silakan coba lagi.',error:true})}
    })
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <div className="space-y-1.5"><Label htmlFor="rapbm-year">Tahun anggaran</Label>
          <Select value={selected?String(selected.year):''} disabled={pending||!years.length} onValueChange={year=>navigate(Number(year))}>
            <SelectTrigger id="rapbm-year" className="w-full sm:w-36"><SelectValue placeholder="Pilih tahun" /></SelectTrigger><SelectContent>{years.map(year=><SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="rapbm-version">Versi dokumen</Label>
          <Select value={selected?.id||''} disabled={pending||!selected} onValueChange={id=>selected&&navigate(selected.year,id)}>
            <SelectTrigger id="rapbm-version" className="w-full sm:w-60"><SelectValue placeholder="Pilih versi" /></SelectTrigger><SelectContent>{versions.filter(v=>v.year===selected?.year).map(v=><SelectItem key={v.id} value={v.id}>Versi {v.version} · {v.status==='draft'?'Draft':v.status==='published'?'Terbit':'Arsip'}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {selected&&<Button asChild variant="outline" size="sm"><a href={`/api/keuangan/rapbm/${selected.id}/source`}><Download className="mr-2 h-4 w-4" />Excel sumber</a></Button>}
        {canManage&&<Button size="sm" disabled={pending} onClick={()=>{setMessage(null);setImportOpen(true)}}><Upload className="mr-2 h-4 w-4" />Impor versi baru</Button>}
      </div>
    </div>

    {message&&<div role={message.error?'alert':'status'} className={`rounded-lg border px-4 py-3 text-sm ${message.error?'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200':'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'}`}>{message.text}</div>}

    {document&&selected?<>
      <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
        <div><p className="font-semibold">{document.institution}</p><p className="mt-1 text-xs text-muted-foreground">{rapbmStatusLabel(selected.status)} · Versi {selected.version} · {selected.published_at?`Diterbitkan ${date(selected.published_at)}`:`Diimpor ${date(selected.created_at)}`}</p></div>
        {selected.status==='superseded'&&<p className="text-xs text-muted-foreground">Anda sedang melihat arsip. Pilih versi terbit untuk dokumen terbaru.</p>}
      </div>
      <div className="grid divide-y rounded-xl border bg-card text-card-foreground md:grid-cols-2 md:divide-x md:divide-y-0">
        <BudgetSummary label="Rencana pendapatan" amounts={document.incomeTotal} />
        <BudgetSummary label="Rencana belanja" amounts={document.expenseTotal} />
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">Nominal sesuai dokumen sumber. Tanda — berarti sel sumber kosong, bukan nol.</p>
      {document.notes.length>0&&<Notes notes={document.notes} />}
      {canManage&&selected.status==='draft'&&<PublishPanel key={selected.id} noteCount={document.notes.length} pending={pending} onPublish={ack=>run(()=>publishRapbmAction(selected.id,data.publicationRevision,ack))} />}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="income">Pendapatan</TabsTrigger><TabsTrigger value="expense">Belanja</TabsTrigger></TabsList>
        <TabsContent value="income" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">Sumber pendapatan yang direncanakan untuk tahun {document.year}.</p>
          {document.income.map(group=><Group key={group.reference} group={group} income />)}
        </TabsContent>
        <TabsContent value="expense" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Cari uraian atau kode akun" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cari uraian atau kode akun…" className="pl-9" /></div>
            <Select value={funding} onValueChange={setFunding}><SelectTrigger className="w-full sm:w-48" aria-label="Filter sumber dana"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua sumber dana</SelectItem><SelectItem value="apbn">APBN</SelectItem><SelectItem value="komite">Komite</SelectItem></SelectContent></Select>
          </div>
          <p className="text-xs text-muted-foreground">{groups.length} kelompok · {groups.reduce((sum,g)=>sum+g.items.length,0)} rincian{filtered?' cocok dengan pencarian. Subtotal tetap mengikuti dokumen lengkap.':''}</p>
          <div className="space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200" key={`${funding}:${query}`}>
            {groups.map(group=><Group key={group.reference} group={group} filtered={filtered} />)}
            {!groups.length&&<div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">Tidak ada rincian yang sesuai. Coba kata kunci atau sumber dana lain.</div>}
          </div>
        </TabsContent>
      </Tabs>
      <p className="border-t pt-4 text-xs text-muted-foreground">Sumber: {selected.original_filename} · Lembar {document.sheet} · Diimpor oleh {selected.created_by_name}. Arsip tahun dan versi sebelumnya tetap tersimpan.</p>
    </>:<div className="rounded-xl border border-dashed px-5 py-14 text-center">
      <FileSpreadsheet className="mx-auto mb-3 h-9 w-9 text-slate-300" />
      <h2 className="text-base font-semibold">{versions.length?'Pilih tahun dan versi RAPBM':'Belum ada RAPBM yang tersedia'}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{canManage?'Impor Excel sebagai draft, periksa angka, lalu terbitkan agar dapat dibaca pengurus.':'RAPBM akan tampil setelah diterbitkan oleh Bendahara atau Super Admin.'}</p>
      {canManage&&!has2026&&<Button className="mt-5" variant="outline" disabled={pending} onClick={()=>run(importInitialRapbmAction)}>{pending?<Loader2 className="mr-2 h-4 w-4 animate-spin" />:<FileSpreadsheet className="mr-2 h-4 w-4" />}Siapkan RAPBM 2026</Button>}
    </div>}

    <Dialog open={importOpen} onOpenChange={open=>!pending&&setImportOpen(open)}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Impor versi RAPBM</DialogTitle><DialogDescription>Gunakan format Excel RAPBM yang sama dengan dokumen 2026. Tahun dibaca dari dokumen, bukan tahun ajaran aplikasi.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event=>{
        event.preventDefault()
        const form=new FormData(event.currentTarget)
        run(async()=>{
          const response=await fetch('/api/keuangan/rapbm/import',{method:'POST',body:form,credentials:'include'})
          const result=await response.json().catch(()=>({error:'Respons impor tidak dapat dibaca. Silakan coba kembali.'}))
          if (!response.ok) throw new Error(result.error||'Impor gagal.')
          return result
        },()=>setImportOpen(false))
      }}>
        <div className="space-y-2"><Label htmlFor="rapbm-file">File Excel (.xlsx)</Label><Input id="rapbm-file" name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required disabled={pending} /><p className="text-xs text-muted-foreground">Maksimal 6 MB. Setiap impor menjadi versi baru; dokumen lama tidak ditimpa.</p></div>
        {canManage&&!has2026&&<Button variant="outline" type="button" disabled={pending} onClick={()=>run(importInitialRapbmAction,()=>setImportOpen(false))}>Gunakan dokumen awal 2026</Button>}
        {message?.error&&<p role="alert" className="text-sm text-rose-700">{message.text}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={()=>setImportOpen(false)}>Batal</Button><Button type="submit" disabled={pending}>{pending&&<Loader2 className="mr-2 h-4 w-4 animate-spin" />}Impor sebagai draft</Button></div>
      </form>
    </DialogContent></Dialog>
  </div>
}

function BudgetSummary({label,amounts}:{label:string;amounts:RapbmAmounts}) {
  return <section className="space-y-2 p-3 sm:space-y-3 sm:p-4"><h2 className="text-sm font-medium text-muted-foreground">{label}</h2><p className="text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{money(amounts.total)}</p><dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs"><div><dt className="text-muted-foreground">APBN</dt><dd className="mt-1 font-medium tabular-nums">{money(amounts.apbn)}</dd></div><div><dt className="text-muted-foreground">Komite</dt><dd className="mt-1 font-medium tabular-nums">{money(amounts.komite)}</dd></div></dl></section>
}

function Group({group,income=false,filtered=false}:{group:RapbmGroup;income?:boolean;filtered?:boolean}) {
  return <details className="overflow-hidden rounded-xl border bg-card text-card-foreground" open={filtered||undefined}>
    <summary className="flex cursor-pointer list-none items-start gap-3 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900">
      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{group.label}</h3><p className="mt-1 text-xs text-muted-foreground">{group.account?`${group.account} · `:''}{group.items.length} rincian</p></div>
      <div className="shrink-0 text-right"><p className="text-sm font-semibold tabular-nums">{money(group.amounts.total)}</p><p className="mt-1 text-[11px] text-muted-foreground">Subtotal dokumen</p></div>
    </summary>
    <div className="border-t motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
      <div className="hidden md:block"><Table><TableHeader><TableRow className="bg-muted/50"><TableHead className="w-[48%]">Uraian</TableHead>{!income&&<><TableHead className="text-right">APBN</TableHead><TableHead className="text-right">Komite</TableHead></>}<TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
        <TableBody>{group.items.map(item=><TableRow key={item.reference}><TableCell><ItemDescription item={item} /></TableCell>{!income&&<><TableCell className="whitespace-nowrap text-right tabular-nums">{money(item.amounts.apbn)}</TableCell><TableCell className="whitespace-nowrap text-right tabular-nums">{money(item.amounts.komite)}</TableCell></>}<TableCell className="whitespace-nowrap text-right font-medium tabular-nums">{money(item.amounts.total)}</TableCell></TableRow>)}</TableBody></Table></div>
      <div className="divide-y md:hidden">{group.items.map(item=><div className="space-y-3 p-4" key={item.reference}><ItemDescription item={item} /><dl className={`grid gap-3 text-xs ${income?'grid-cols-1':'grid-cols-3'}`}>{(income?[['Jumlah',item.amounts.total]]:[['APBN',item.amounts.apbn],['Komite',item.amounts.komite],['Jumlah',item.amounts.total]]).map(([label,value])=><div key={String(label)}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium tabular-nums">{money(value as number|null)}</dd></div>)}</dl></div>)}</div>
      <p className="border-t bg-slate-50/50 px-4 py-2 text-xs text-muted-foreground dark:bg-slate-900/30">Subtotal dokumen: APBN {money(group.amounts.apbn)} · Komite {money(group.amounts.komite)} · Jumlah {money(group.amounts.total)}<span className="mt-1 block">Sumber: {group.subtotalReference}</span></p>
    </div>
  </details>
}

function ItemDescription({item}:{item:RapbmItem}) {
  return <details><summary className="cursor-pointer text-sm leading-6 marker:text-slate-400">{item.description}</summary><dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-900"><div><dt className="text-muted-foreground">Kode akun</dt><dd className="mt-1">{item.account||'—'}</dd></div><div><dt className="text-muted-foreground">Volume / satuan</dt><dd className="mt-1">{item.volume??'—'} {item.unit||''}</dd></div><div className="col-span-2"><dt className="text-muted-foreground">Baris sumber</dt><dd className="mt-1 break-all">{item.reference}</dd></div></dl></details>
}

function Notes({notes}:{notes:RapbmNote[]}) {
  return <details className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"><summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200"><AlertCircle className="h-4 w-4 shrink-0" /><span className="flex-1">Catatan Angka · {notes.length} perlu diperhatikan</span><ChevronDown className="h-4 w-4" /></summary><div className="space-y-3 border-t border-amber-200 px-4 py-3 dark:border-amber-900"><p className="text-xs text-muted-foreground">Perbandingan ini tidak mengubah angka dokumen. Penjumlahan hanya memakai sel numerik yang tersedia; sel kosong tetap ditandai kosong.</p>{notes.map((note,index)=><div key={`${note.reference}:${index}`} className="border-b border-amber-200/70 pb-3 last:border-b-0 last:pb-0 dark:border-amber-900"><p className="text-sm leading-6">{note.message}</p><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-foreground"><span>Dokumen: {money(note.source)}</span><span>Penjumlahan: {money(note.calculated)}</span><span className="basis-full break-all text-xs font-normal text-muted-foreground">{note.reference}</span></div></div>)}</div></details>
}

function PublishPanel({noteCount,pending,onPublish}:{noteCount:number;pending:boolean;onPublish:(acknowledged:boolean)=>void}) {
  const [acknowledged,setAcknowledged]=useState(false)
  return <section className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"><div><h2 className="text-sm font-semibold">Periksa draft sebelum diterbitkan</h2><p className="mt-1 text-sm text-muted-foreground">Versi terbit dapat dibaca pengurus dan tidak dapat diubah. Koreksi berikutnya dilakukan melalui impor versi baru.</p></div>{noteCount>0&&<div className="flex items-start gap-2"><Checkbox id="rapbm-ack" className="mt-0.5" checked={acknowledged} disabled={pending} onCheckedChange={value=>setAcknowledged(value===true)} /><Label htmlFor="rapbm-ack" className="text-sm font-normal leading-5">Saya telah membaca Catatan Angka dan akan menerbitkan nominal sesuai dokumen sumber.</Label></div>}<Button size="sm" disabled={pending||(noteCount>0&&!acknowledged)} onClick={()=>onPublish(acknowledged)}>{pending&&<Loader2 className="mr-2 h-4 w-4 animate-spin" />}Terbitkan versi ini</Button></section>
}
