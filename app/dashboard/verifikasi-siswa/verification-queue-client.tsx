'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, ChevronRight, RotateCcw, Search, Settings2, ShieldAlert, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { saveVerificationSettings, resetVerificationSettings } from './actions'
import { riskLabel, type RiskLevel, type VerificationThresholds } from './verification-core'
import type { VerificationQueueData, VerificationQueueStudent } from './verification-data'

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
  const [classId, setClassId] = useState('all')
  const [risk, setRisk] = useState<'all' | RiskLevel>('all')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const counts = useMemo(() => data.students.reduce((result, student) => ({ ...result, [student.overall]: result[student.overall] + 1 }), { aman: 0, perhatian: 0, kritis: 0 }), [data.students])
  const students = useMemo(() => data.students.filter(student => {
    const needle = search.trim().toLowerCase()
    return (classId === 'all' || student.classId === classId) && (risk === 'all' || student.overall === risk) && (!needle || student.name.toLowerCase().includes(needle) || student.nisn.toLowerCase().includes(needle) || (student.nis || '').toLowerCase().includes(needle))
  }), [data.students, search, classId, risk])

  return <>
    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-200">
      <strong>Indikator kondisi saat ini—bukan keputusan kenaikan kelas.</strong> Seluruh status dihitung ulang dari data terbaru untuk membantu verifikasi pimpinan.
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {(['aman','perhatian','kritis'] as RiskLevel[]).map(level => <button key={level} onClick={() => setRisk(risk === level ? 'all' : level)} className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${RISK_STYLE[level]} ${risk === level ? 'ring-2 ring-offset-2' : ''}`}>
        <span className="flex items-center gap-2 text-sm font-bold"><RiskIcon level={level} />{riskLabel(level)}</span><strong className="text-2xl">{counts[level]}</strong>
      </button>)}
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center">
        <select value={data.selectedYear.name} onChange={event => router.push(`/dashboard/verifikasi-siswa?tahun=${encodeURIComponent(event.target.value)}`)} className="h-10 rounded-lg border border-slate-200 bg-background px-3 text-sm dark:border-slate-700">
          {data.years.map(year => <option key={year.name} value={year.name}>{year.name}{year.active ? ' · Aktif' : ''}</option>)}
        </select>
        <select value={classId} onChange={event => setClassId(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-background px-3 text-sm dark:border-slate-700"><option value="all">Semua kelas</option>{data.classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nama, NISN, atau NIS..." className="pl-9" /></div>
        {isSuperAdmin ? <Button variant="outline" onClick={() => setSettingsOpen(true)} className="gap-2"><Settings2 className="h-4 w-4" />Ambang indikator</Button> : null}
      </div>
      <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">Menampilkan {students.length} dari {data.students.length} siswa · Tahun ajaran gabungan Semester 1–2</div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {students.map(student => <Link key={student.id} href={`/dashboard/verifikasi-siswa/${student.id}?tahun=${encodeURIComponent(data.selectedYear.name)}`} className="group grid gap-3 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-900/60 md:grid-cols-[minmax(230px,1fr)_minmax(310px,1.4fr)_auto] md:items-center">
          <div className="flex min-w-0 items-center gap-3"><StudentPhoto student={student} /><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{student.name}</p><p className="truncate text-xs text-slate-500">{student.nisn} · {student.className} · {student.status}</p></div></div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">{student.indicators.map(item => <span key={item.domain} title={`${item.reason} ${item.actual}`} className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold ${RISK_STYLE[item.level]}`}><span className="block capitalize opacity-70">{item.domain}</span>{item.label}</span>)}</div>
          <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${RISK_STYLE[student.overall]}`}><RiskIcon level={student.overall} />{riskLabel(student.overall)}<ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></div>
        </Link>)}
        {!students.length ? <div className="p-10 text-center text-sm text-slate-500">Tidak ada siswa yang sesuai dengan filter.</div> : null}
      </div>
    </div>
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
      <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Rasio mapel bermasalah untuk kritis (%)<Input type="number" min="1" max="100" value={draft.academicCriticalRatio} onChange={e=>change('academicCriticalRatio',e.target.value)} className="mt-1" /></label>
    </div>
    <p className="text-xs text-slate-500">Terakhir diperbarui: {updatedAt ? new Date(updatedAt).toLocaleString('id-ID') : 'Belum pernah; memakai default 90/80 dan 30%.'}</p>{message ? <p className="text-xs font-semibold text-blue-700">{message}</p> : null}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={()=>submit(true)} className="gap-1.5"><RotateCcw className="h-4 w-4" />Reset</Button><Button disabled={pending} onClick={()=>submit(false)}>{pending?'Menyimpan...':'Simpan'}</Button></div>
  </DialogContent></Dialog>
}
