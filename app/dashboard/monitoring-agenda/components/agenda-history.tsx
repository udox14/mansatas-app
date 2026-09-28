'use client'

import { useEffect, useMemo, useState } from 'react'
import { TeacherLeaveMapping } from '@/components/teacher-leave-controls'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getAgendaHistoryTeachers, getMonthlyTeacherLeaves, getTeacherAgendaSubmissions } from '../actions'
import { todayWIB } from '@/lib/time'

type LeaveRow = Awaited<ReturnType<typeof getMonthlyTeacherLeaves>>[number]
type AgendaRow = Awaited<ReturnType<typeof getTeacherAgendaSubmissions>>[number]
type Teacher = { id: string; nama: string }

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeLabel(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export function AgendaHistory() {
  const today = todayWIB()
  const [view, setView] = useState<'izin' | 'agenda'>('izin')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [teacherId, setTeacherId] = useState('')
  const [start, setStart] = useState(`${today.slice(0, 7)}-01`)
  const [end, setEnd] = useState(today)
  const [leaves, setLeaves] = useState<LeaveRow[]>([])
  const [agendas, setAgendas] = useState<AgendaRow[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAgendaHistoryTeachers().then(setTeachers).catch(() => setError('Daftar guru gagal dimuat.'))
  }, [])

  async function loadLeaves() {
    setLoading(true); setError('')
    try {
      setLeaves(await getMonthlyTeacherLeaves(month))
      setSelected([]); setLoaded(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Riwayat izin gagal dimuat.')
    } finally { setLoading(false) }
  }

  async function loadAgendas() {
    if (!teacherId) { setError('Pilih guru terlebih dahulu.'); return }
    setLoading(true); setError('')
    try {
      setAgendas(await getTeacherAgendaSubmissions(teacherId, start, end))
      setLoaded(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Riwayat agenda gagal dimuat.')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (view !== 'izin' || !loaded) return
    const refresh = () => { void loadLeaves() }
    window.addEventListener('teacher-leave-changed', refresh)
    return () => window.removeEventListener('teacher-leave-changed', refresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, loaded, month])

  const selectedRows = useMemo(() => leaves.filter(row => selected.includes(row.id)), [leaves, selected])
  const count = useMemo(() => ({
    school: leaves.filter(row => row.kepentingan_sekolah).length,
    regular: leaves.filter(row => row.alasan_izin_guru_id && !row.kepentingan_sekolah).length,
    unmapped: leaves.filter(row => !row.alasan_izin_guru_id).length,
  }), [leaves])

  function changeView(next: 'izin' | 'agenda') {
    setView(next); setLoaded(false); setError('')
  }

  return <div className="space-y-4">
    <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
      <button type="button" onClick={() => changeView('izin')} className={`border-b-2 px-3 py-2 text-sm ${view === 'izin' ? 'border-indigo-600 font-medium text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-500'}`}>Izin bulanan</button>
      <button type="button" onClick={() => changeView('agenda')} className={`border-b-2 px-3 py-2 text-sm ${view === 'agenda' ? 'border-indigo-600 font-medium text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-500'}`}>Agenda per guru</button>
    </div>

    {view === 'izin' ? <>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 dark:bg-slate-900">
        <div><Label htmlFor="leave-month" className="text-xs text-slate-500">Bulan</Label><Input id="leave-month" type="month" value={month} onChange={event => { setMonth(event.target.value); setLoaded(false) }} className="h-9 w-[170px]" /></div>
        <Button size="sm" onClick={loadLeaves} disabled={loading || !month}>Tampilkan izin</Button>
      </div>
      {loaded && <>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span>{leaves.length} catatan izin</span><span>{count.school} izin sekolah</span><span>{count.regular} izin biasa</span><span>{count.unmapped} belum dipetakan</span>
        </div>
        {leaves.length > 0 && <>
          <div className="flex flex-wrap items-center gap-3">
            <TeacherLeaveMapping targets={selectedRows.map(row => row.target)} onChanged={loadLeaves} schoolOnly />
            <TeacherLeaveMapping targets={selectedRows.map(row => row.target)} onChanged={loadLeaves} />
            <span className="text-xs text-slate-500">Pilih hingga 100 catatan untuk mengatur alasan izin. Perubahan tercatat dalam audit.</span>
          </div>
          <div className="overflow-x-auto rounded-lg border bg-white dark:bg-slate-900">
            <Table><TableHeader><TableRow>
              <TableHead className="w-10">Pilih</TableHead><TableHead>Tanggal dan guru</TableHead><TableHead>Kelas / mapel</TableHead><TableHead>Deskripsi izin</TableHead><TableHead>Alasan dan kategori</TableHead><TableHead>Sumber</TableHead>
            </TableRow></TableHeader><TableBody>{leaves.map(row => <TableRow key={row.id}>
              <TableCell><input type="checkbox" aria-label={`Pilih izin ${row.guru_nama} ${row.tanggal}`} checked={selected.includes(row.id)} onChange={event => setSelected(current => event.target.checked ? [...current, row.id] : current.filter(id => id !== row.id))} /></TableCell>
              <TableCell className="min-w-40 align-top text-sm"><span className="font-medium">{row.guru_nama}</span><br /><span className="text-slate-500">{dateLabel(row.tanggal)}</span></TableCell>
              <TableCell className="min-w-40 align-top text-sm">{row.kelas || '—'}{row.mapel ? <><br /><span className="text-slate-500">{row.mapel} · {row.jam}</span></> : null}</TableCell>
              <TableCell className="min-w-56 max-w-sm whitespace-pre-wrap align-top text-sm">{row.deskripsi || '—'}</TableCell>
              <TableCell className="min-w-40 align-top text-sm"><span>{row.alasan_nama || 'Belum dipetakan'}</span><br /><span className={row.kepentingan_sekolah ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}>{row.kepentingan_sekolah ? 'Izin sekolah' : 'Izin biasa'}</span></TableCell>
              <TableCell className="min-w-32 align-top text-xs text-slate-500">{row.source === 'agenda' ? (row.waktu_input ? 'Agenda' : 'Koreksi admin') : 'Penugasan'}<br />{timeLabel(row.waktu_input)}</TableCell>
            </TableRow>)}</TableBody></Table>
          </div>
        </>}
        {leaves.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">Tidak ada catatan izin pada bulan ini.</p>}
        <p className="text-xs text-slate-500">Satu pengajuan penugasan yang mencakup beberapa kelas ditampilkan sekali. Agenda dan penugasan pada hari yang sama ditampilkan sebagai catatan terpisah; rekap mengikuti status agenda yang berlaku.</p>
      </>}
    </> : <>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4 dark:bg-slate-900">
        <div className="w-full max-w-xs"><Label className="text-xs text-slate-500">Guru</Label><Combobox options={teachers.map(row => ({ value: row.id, label: row.nama }))} value={teacherId} onValueChange={value => { setTeacherId(value); setLoaded(false) }} placeholder="Pilih guru" /></div>
        <div><Label htmlFor="agenda-start" className="text-xs text-slate-500">Dari tanggal</Label><Input id="agenda-start" type="date" value={start} onChange={event => { setStart(event.target.value); setLoaded(false) }} className="h-9 w-[155px]" /></div>
        <div><Label htmlFor="agenda-end" className="text-xs text-slate-500">Sampai tanggal</Label><Input id="agenda-end" type="date" value={end} onChange={event => { setEnd(event.target.value); setLoaded(false) }} className="h-9 w-[155px]" /></div>
        <Button size="sm" onClick={loadAgendas} disabled={loading}>Tampilkan agenda</Button>
      </div>
      {loaded && <><p className="text-sm text-slate-600 dark:text-slate-300">{agendas.length} agenda yang pernah dikirim</p>
        {agendas.length > 0 ? <div className="overflow-x-auto rounded-lg border bg-white dark:bg-slate-900"><Table><TableHeader><TableRow>
          <TableHead>Tanggal / jam</TableHead><TableHead>Kelas / mapel</TableHead><TableHead>Materi</TableHead><TableHead>Submit / pengisi</TableHead><TableHead>Status saat ini</TableHead>
        </TableRow></TableHeader><TableBody>{agendas.map(row => <TableRow key={row.id}>
          <TableCell className="min-w-32 align-top text-sm">{dateLabel(row.tanggal)}<br /><span className="text-slate-500">{row.jam}</span></TableCell>
          <TableCell className="min-w-36 align-top text-sm">{row.kelas}<br /><span className="text-slate-500">{row.mapel}</span></TableCell>
          <TableCell className="min-w-64 max-w-lg whitespace-pre-wrap align-top text-sm">{row.materi || '—'}{row.foto_url && <><br /><a href={row.foto_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Lihat foto</a></>}</TableCell>
          <TableCell className="min-w-40 align-top text-sm">{timeLabel(row.waktu_input)}{row.ppl_nama && <><br /><span className="text-slate-500">Diisi oleh {row.ppl_nama} (PPL)</span></>}</TableCell>
          <TableCell className="min-w-36 align-top text-sm">{row.status.replaceAll('_', ' ')}{row.catatan_admin && <><br /><span className="text-slate-500">{row.catatan_admin}</span></>}</TableCell>
        </TableRow>)}</TableBody></Table></div> : <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">Tidak ada agenda yang dikirim pada periode ini.</p>}
        <p className="text-xs text-slate-500">Menampilkan agenda tersimpan dengan waktu submit. Jika status atau materi pernah diperbarui, yang terlihat adalah nilai saat ini.</p>
      </>}
    </>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>
}
