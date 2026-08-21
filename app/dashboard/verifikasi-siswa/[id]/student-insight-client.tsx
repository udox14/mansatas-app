'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, FileText, Printer, ShieldAlert, UserRound } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { riskLabel, type RiskLevel } from '../verification-core'
import type { InsightSection, StudentInsightData } from '../verification-data'

const COLORS = ['#059669','#2563eb','#d97706','#dc2626','#7c3aed','#0891b2']
const RISK_STYLE: Record<RiskLevel,string> = {
  aman:'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-300',
  perhatian:'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-300',
  kritis:'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-300',
}

function RiskIcon({ level }: { level: RiskLevel }) { return level==='aman'?<CheckCircle2 className="h-4 w-4"/>:level==='kritis'?<ShieldAlert className="h-4 w-4"/>:<AlertTriangle className="h-4 w-4"/> }

function StudentPhoto({ data }: { data: StudentInsightData }) {
  const [failed,setFailed]=useState(false)
  const name=String(data.student.name||data.student.nama_lengkap||'Siswa')
  return <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-xl border-2 border-white/70 bg-white/15 shadow-xl">
    {data.student.photoUrl&&!failed?<img src={data.student.photoUrl} alt={`Foto ${name}`} className="h-full w-full object-cover object-top" onError={()=>setFailed(true)}/>:<div className="flex h-full flex-col items-center justify-center gap-1 text-white/80"><UserRound className="h-10 w-10"/><strong>{name.split(/\s+/).slice(0,2).map(p=>p[0]).join('')}</strong><span className="text-[9px]">Foto belum tersedia</span></div>}
  </div>
}

export function StudentInsightClient({ data }: { data: StudentInsightData }) {
  const router=useRouter()
  const [selected,setSelected]=useState<InsightSection|null>(null)
  const overall=data.student.overall as RiskLevel
  const core=data.sections.filter(section=>section.indicator)
  const reportHref=`/dashboard/siswa/${data.student.id}/full-report?tahun=${encodeURIComponent(data.year.name)}`
  return <div className="space-y-5 pb-14">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href={`/dashboard/verifikasi-siswa?tahun=${encodeURIComponent(data.year.name)}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300"><ArrowLeft className="h-4 w-4"/>Kembali ke antrean</Link><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link href={`/dashboard/siswa/${data.student.id}`}><FileText className="mr-2 h-4 w-4"/>Detail Siswa</Link></Button><Button asChild className="bg-emerald-700 hover:bg-emerald-800"><Link href={reportHref}><Printer className="mr-2 h-4 w-4"/>Cetak Full Report</Link></Button></div></div>
    <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
      <CardContent className="flex flex-col gap-5 bg-slate-900 p-5 text-white md:flex-row md:items-center md:p-7">
        <StudentPhoto data={data}/><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">Insight & Verifikasi Siswa</p><h1 className="mt-2 text-2xl font-black md:text-3xl">{String(data.student.name)}</h1><p className="mt-2 text-sm text-slate-300">NISN {String(data.student.nisn)}{data.student.nis?` · NIS ${String(data.student.nis)}`:''} · {String(data.student.className)} · {String(data.student.status).toUpperCase()}</p><div className="mt-4 flex flex-wrap items-center gap-2"><Badge variant="outline" className={`gap-2 ${RISK_STYLE[overall]}`}><RiskIcon level={overall}/>{riskLabel(overall)}</Badge><Badge variant="outline" className="border-slate-600 bg-slate-800 text-slate-200">Tahun Ajaran {data.year.name}</Badge></div></div>
        <Select value={data.year.name} onValueChange={value=>router.push(`/dashboard/verifikasi-siswa/${data.student.id}?tahun=${encodeURIComponent(value)}`)}><SelectTrigger className="w-full border-slate-600 bg-slate-800 text-white md:w-56"><SelectValue placeholder="Tahun ajaran"/></SelectTrigger><SelectContent>{data.years.map(year=><SelectItem key={year.name} value={year.name}>{year.name}{year.active?' · Aktif':''}</SelectItem>)}</SelectContent></Select>
      </CardContent>
    </Card>
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/35"><CardContent className="p-4 text-sm text-blue-800 dark:text-blue-200"><strong>Indikator kondisi saat ini—bukan keputusan kenaikan kelas.</strong> Klik setiap indikator, angka, atau grafik untuk melihat rincian sumber yang aman.</CardContent></Card>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{core.map(section=><Card key={section.id} role="button" tabIndex={0} onClick={()=>setSelected(section)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(section)}}} className={`cursor-pointer border p-0 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${RISK_STYLE[section.indicator!.level]}`}><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wider">{section.title}</span><RiskIcon level={section.indicator!.level}/></div><p className="mt-2 text-lg font-black">{section.indicator!.label}</p><p className="mt-1 line-clamp-2 text-xs opacity-80">{section.indicator!.reason}</p><div className="mt-3 border-t border-current/15 pt-2 text-[10px] font-semibold">Aktual: {section.indicator!.actual}<br/>{section.indicator!.threshold}</div></CardContent></Card>)}</section>
    <Card><CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle className="text-base">Keterisian Domain</CardTitle><CardDescription>Bagian kosong tetap ditampilkan agar kelengkapan data mudah diverifikasi.</CardDescription></div><BarChart3 className="h-5 w-5 text-muted-foreground"/></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{data.completeness.map(item=><div key={item.domain} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${item.filled?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900'}`}>{item.filled?<CheckCircle2 className="h-4 w-4"/>:<AlertTriangle className="h-4 w-4"/>}{item.domain}<span className="ml-auto">{item.filled?'Terisi':'Kosong'}</span></div>)}</CardContent></Card>
    <div className="grid gap-5 xl:grid-cols-2">{data.sections.map(section=><SectionCard key={section.id} section={section} onOpen={()=>setSelected(section)}/>)}</div>
    <DetailModal section={selected} onOpenChange={open=>{if(!open)setSelected(null)}}/>
  </div>
}

function SectionCard({ section,onOpen }: { section:InsightSection;onOpen:()=>void }) {
  return <Card className="overflow-hidden"><CardHeader className="flex-row items-start justify-between space-y-0 border-b"><button onClick={onOpen} className="min-w-0 text-left"><CardTitle className="text-base">{section.title}</CardTitle><CardDescription className="mt-1">{section.description}</CardDescription></button>{section.indicator?<Badge variant="outline" className={`shrink-0 ${RISK_STYLE[section.indicator.level]}`}>{section.indicator.label}</Badge>:null}</CardHeader>
    <CardContent className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">{section.metrics.map(item=><button key={item.label} onClick={onOpen} className="rounded-lg border border-slate-200 bg-muted/30 p-3 text-left transition hover:border-emerald-300 hover:bg-muted dark:border-slate-800"><span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{item.label}</span><strong className="mt-1 block text-sm text-foreground">{item.value}</strong>{item.hint?<small>{item.hint}</small>:null}</button>)}</CardContent>
    {section.chart?.data.length ? <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen()}}} className="h-64 cursor-pointer border-t border-slate-100 p-3 outline-none hover:bg-slate-50 focus:ring-2 focus:ring-emerald-500 dark:border-slate-800 dark:hover:bg-slate-900"><InsightChart section={section}/></div> : null}
    <CardFooter className="border-t p-0"><button onClick={onOpen} className="w-full px-4 py-3 text-left text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30">Lihat rincian ringkasan →</button></CardFooter>
  </Card>
}

function InsightChart({ section }: { section:InsightSection }) {
  const chart=section.chart!
  if(chart.kind==='donut') return <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chart.data} dataKey={chart.keys[0]} nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>{chart.data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer>
  if(chart.kind==='line') return <ResponsiveContainer width="100%" height="100%"><LineChart data={chart.data} margin={{top:10,right:12,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" fontSize={10}/><YAxis fontSize={10}/><Tooltip/><Legend/>{chart.keys.map((key,i)=><Line key={key} dataKey={key} stroke={COLORS[i%COLORS.length]} strokeWidth={2} dot={{r:3}}/>)}</LineChart></ResponsiveContainer>
  return <ResponsiveContainer width="100%" height="100%"><BarChart data={chart.data} margin={{top:10,right:12,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" fontSize={9} interval={0} tickFormatter={v=>String(v).slice(0,12)}/><YAxis fontSize={10}/><Tooltip/><Legend/>{chart.keys.map((key,i)=><Bar key={key} dataKey={key} fill={COLORS[i%COLORS.length]} radius={[3,3,0,0]}/>)}</BarChart></ResponsiveContainer>
}

function DetailModal({ section,onOpenChange }: { section:InsightSection|null;onOpenChange:(open:boolean)=>void }) {
  return <Dialog open={Boolean(section)} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0"><DialogHeader className="border-b border-slate-200 p-5 dark:border-slate-800"><DialogTitle>{section?.title}</DialogTitle><DialogDescription>{section?.description} Narasi mentah dan lampiran sensitif tidak ditampilkan.</DialogDescription></DialogHeader><div className="max-h-[70vh] overflow-auto p-5">{section?.indicator?<div className={`mb-4 rounded-xl border p-3 text-xs ${RISK_STYLE[section.indicator.level]}`}><strong>{section.indicator.label}: </strong>{section.indicator.reason}<div className="mt-1">Aktual {section.indicator.actual} · {section.indicator.threshold}</div></div>:null}{section&&section.details.rows.length?<table className="w-full border-collapse text-xs"><thead className="sticky top-0 bg-slate-100 dark:bg-slate-900"><tr>{section.details.headers.map(header=><th key={header} className="border border-slate-200 p-2 text-left dark:border-slate-700">{header}</th>)}</tr></thead><tbody>{section.details.rows.map((row,i)=><tr key={i} className="odd:bg-slate-50 dark:odd:bg-slate-900/50">{row.map((cell,j)=><td key={j} className="border border-slate-200 p-2 align-top dark:border-slate-700">{cell}</td>)}</tr>)}</tbody></table>:<div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Tidak ada data</div>}</div></DialogContent></Dialog>
}
