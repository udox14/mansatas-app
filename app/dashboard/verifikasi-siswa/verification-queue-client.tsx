'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ChevronRight, RotateCcw, Search, Settings2, ShieldAlert, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { saveVerificationSettings, resetVerificationSettings } from './actions'
import { riskLabel, type RiskLevel, type VerificationThresholds } from './verification-core'
import type { VerificationQueueData, VerificationQueueStudent } from './verification-data'

type RiskFilter = 'masalah' | RiskLevel | 'all'

const RISK_STYLE: Record<RiskLevel, string> = {
  aman: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  perhatian: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  kritis: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
}

function RiskIcon({ level }: { level: RiskLevel }) {
  return level === 'aman' ? <CheckCircle2 className="h-4 w-4" /> : level === 'kritis' ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />
}

function StudentPhoto({ student }: { student: VerificationQueueStudent }) {
  const [failed, setFailed] = useState(false)
  return <div className="grid h-11 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
    {student.photoUrl && !failed ? <img src={student.photoUrl} alt={`Foto ${student.name}`} className="h-full w-full object-cover object-top" onError={() => setFailed(true)} /> : <UserRound className="h-5 w-5 text-slate-400" />}
  </div>
}

export function VerificationQueueClient({ data, isSuperAdmin }: { data: VerificationQueueData; isSuperAdmin: boolean }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  // The queue is an intervention list by default. Safe students remain
  // available through the explicit filter, but are never shown initially.
  const [risk, setRisk] = useState<RiskFilter>('masalah')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const hasSelectedClass = Boolean(data.selectedClassId)
  const counts = useMemo(() => data.students.reduce((result, student) => ({ ...result, [student.overall]: result[student.overall] + 1 }), { aman: 0, perhatian: 0, kritis: 0 }), [data.students])
  const students = useMemo(() => data.students.filter(student => {
    const needle = search.trim().toLowerCase()
    const matchesRisk = risk === 'all'
      ? true
      : risk === 'masalah'
        ? student.overall === 'perhatian' || student.overall === 'kritis'
        : student.overall === risk
    return matchesRisk && (!needle || student.name.toLowerCase().includes(needle) || student.nisn.toLowerCase().includes(needle) || (student.nis || '').toLowerCase().includes(needle))
  }), [data.students, search, risk])

  return <>
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-200">
      <strong>Indikator kondisi saat ini—bukan keputusan kenaikan kelas.</strong> Seluruh status dihitung ulang dari data terbaru untuk membantu verifikasi pimpinan.
    </div>
    <Card>
      <CardHeader className="gap-1 pb-4"><CardTitle className="text-base">Pilih konteks verifikasi</CardTitle><CardDescription>Pilih tahun ajaran dan satu kelas. Data siswa baru dimuat setelah kelas dipilih.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Select value={data.selectedYear.name} onValueChange={value => router.push(`/dashboard/verifikasi-siswa?tahun=${encodeURIComponent(value)}`)}>
          <SelectTrigger className="w-full lg:w-60"><SelectValue placeholder="Tahun ajaran" /></SelectTrigger>
          <SelectContent>{data.years.map(year => <SelectItem key={year.name} value={year.name}>{year.name}{year.active ? ' · Aktif' : ''}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={data.selectedClassId || undefined} onValueChange={value => router.push(`/dashboard/verifikasi-siswa?tahun=${encodeURIComponent(data.selectedYear.name)}&kelas=${encodeURIComponent(value)}`)}>
          <SelectTrigger className="w-full lg:w-72"><SelectValue placeholder="Pilih kelas untuk memuat siswa" /></SelectTrigger>
          <SelectContent>{data.classes.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
        </Select>
        {isSuperAdmin ? <Button variant="outline" onClick={() => setSettingsOpen(true)} className="gap-2 lg:ml-auto"><Settings2 className="h-4 w-4" />Ambang indikator</Button> : null}
      </CardContent>
    </Card>
    {!hasSelectedClass ? <Card><CardContent className="flex min-h-44 flex-col items-center justify-center gap-2 text-center"><ShieldAlert className="h-8 w-8 text-slate-300" /><p className="font-semibold text-slate-700 dark:text-slate-200">Belum ada kelas dipilih</p><p className="max-w-md text-sm text-muted-foreground">Pilih kelas di atas untuk mulai memuat daftar siswa dan indikatornya. Tidak ada data siswa yang dimuat sebelum pilihan ini dibuat.</p></CardContent></Card> : null}
    {hasSelectedClass ? <>
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
      <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-background to-rose-50/60 dark:border-amber-900/70 dark:from-amber-950/25 dark:via-background dark:to-rose-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4 text-amber-600" />Prioritas verifikasi</CardTitle>
          <CardDescription>Daftar awal hanya memuat siswa yang memerlukan perhatian atau berstatus kritis. Siswa Aman disembunyikan dari antrean.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`gap-1.5 rounded-full px-3 py-1.5 ${RISK_STYLE.perhatian}`}><AlertTriangle className="h-3.5 w-3.5" />Perlu perhatian <strong>{counts.perhatian}</strong></Badge>
          <Badge variant="outline" className={`gap-1.5 rounded-full px-3 py-1.5 ${RISK_STYLE.kritis}`}><ShieldAlert className="h-3.5 w-3.5" />Kritis <strong>{counts.kritis}</strong></Badge>
          <Badge variant="outline" className="gap-1.5 rounded-full border-slate-200 bg-slate-100 px-3 py-1.5 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><CheckCircle2 className="h-3.5 w-3.5" />Aman disembunyikan <strong>{counts.aman}</strong></Badge>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Filter status siswa</CardTitle><CardDescription>Pilih status lain bila perlu meninjau kelas secara menyeluruh.</CardDescription></CardHeader>
        <CardContent>
          <Select value={risk} onValueChange={value => setRisk(value as RiskFilter)}>
            <SelectTrigger aria-label="Filter status siswa"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="masalah">Perlu perhatian + Kritis (default)</SelectItem>
              <SelectItem value="perhatian">Perlu perhatian saja</SelectItem>
              <SelectItem value="kritis">Kritis saja</SelectItem>
              <SelectItem value="aman">Aman saja</SelectItem>
              <SelectItem value="all">Semua siswa</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama, NISN, atau NIS..." className="pl-9" /></div>
      </div>
      <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">Menampilkan {students.length} dari {data.students.length} siswa · {risk === 'masalah' ? 'Aman disembunyikan · ' : ''}Tahun ajaran gabungan Semester 1–2</div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {students.map(student => <Link key={student.id} href={`/dashboard/verifikasi-siswa/${student.id}?tahun=${encodeURIComponent(data.selectedYear.name)}`} className="group grid gap-3 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-900/60 md:grid-cols-[minmax(230px,1fr)_minmax(310px,1.4fr)_auto] md:items-center">
          <div className="flex min-w-0 items-center gap-3"><StudentPhoto student={student} /><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{student.name}</p><p className="truncate text-xs text-slate-500">{student.nisn} · {student.className} · {student.status}</p></div></div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">{student.indicators.map(item => <Badge key={item.domain} title={`${item.reason} ${item.actual}`} variant="outline" className={`h-auto justify-start rounded-lg px-2 py-1.5 text-[10px] ${RISK_STYLE[item.level]}`}><span className="mr-1 capitalize opacity-70">{item.domain}:</span>{item.label}</Badge>)}</div>
          <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${RISK_STYLE[student.overall]}`}><RiskIcon level={student.overall} />{riskLabel(student.overall)}<ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></div>
        </Link>)}
        {!students.length ? <div className="p-10 text-center text-sm text-slate-500">{risk === 'masalah' ? 'Tidak ada siswa berstatus Perlu Perhatian atau Kritis di kelas ini.' : 'Tidak ada siswa yang sesuai dengan filter.'}</div> : null}
      </div>
    </Card>
    </> : null}
    {isSuperAdmin ? <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} initial={data.settings} updatedAt={data.settingsUpdatedAt} /> : null}
  </>
}

function SettingsDialog({ open, onOpenChange, initial, updatedAt }: { open: boolean; onOpenChange: (open: boolean) => void; initial: VerificationThresholds; updatedAt: string | null }) {
  const router = useRouter()
  const [draft, setDraft] = useState(initial)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const change = (key: keyof VerificationThresholds, value: string) => setDraft(current => ({ ...current, [key]: Number(value) }))
  const submit = (reset = false) => startTransition(async () => {
    const result = reset ? await resetVerificationSettings() : await saveVerificationSettings(draft)
    if (result.error) setMessage(result.error)
    else { setMessage(reset ? 'Ambang dikembalikan ke default.' : 'Ambang berhasil disimpan.'); if (result.settings) setDraft(result.settings); router.refresh() }
  })
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Ambang indikator verifikasi</DialogTitle><DialogDescription>Pengaturan ini memengaruhi label kondisi, bukan menetapkan keputusan kenaikan.</DialogDescription></DialogHeader>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-600">Kehadiran perlu perhatian (%)<Input type="number" min="1" max="100" value={draft.attendanceWarning} onChange={e=>change('attendanceWarning',e.target.value)} className="mt-1" /></label>
      <label className="text-xs font-semibold text-slate-600">Kehadiran kritis (%)<Input type="number" min="0" max="99" value={draft.attendanceCritical} onChange={e=>change('attendanceCritical',e.target.value)} className="mt-1" /></label>
    </div>
    <p className="text-xs text-slate-500">Terakhir diperbarui: {updatedAt ? new Date(updatedAt).toLocaleString('id-ID') : 'Belum pernah; memakai default 90/80 dan 30%.'}</p>{message ? <p className="text-xs font-semibold text-blue-700">{message}</p> : null}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={()=>submit(true)} className="gap-1.5"><RotateCcw className="h-4 w-4" />Reset</Button><Button disabled={pending} onClick={()=>submit(false)}>{pending?'Menyimpan...':'Simpan'}</Button></div>
  </DialogContent></Dialog>
}
