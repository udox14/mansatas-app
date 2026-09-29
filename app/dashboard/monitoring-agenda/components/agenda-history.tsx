'use client'

import { useEffect, useMemo, useState } from 'react'
import { TeacherLeaveMapping, TeacherLeaveSelect } from '@/components/teacher-leave-controls'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Camera, Edit3, Eye, Loader2 } from 'lucide-react'
import { editAgendaStatus, getAgendaHistoryTeachers, getMonthlyTeacherLeaves, getTeacherAgendaSubmissions } from '../actions'
import { todayWIB } from '@/lib/time'
import { StudentAttendanceLabel } from './student-attendance-label'

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
  const [message, setMessage] = useState('')
  const [detail, setDetail] = useState<AgendaRow | null>(null)
  const [photo, setPhoto] = useState<AgendaRow | null>(null)
  const [editing, setEditing] = useState<AgendaRow | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editReason, setEditReason] = useState('')
  const [editCatatan, setEditCatatan] = useState('')
  const [saving, setSaving] = useState(false)

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

  function openEdit(row: AgendaRow) {
    setEditing(row)
    setEditStatus(['TEPAT_WAKTU', 'TELAT', 'ALFA', 'SAKIT', 'IZIN'].includes(row.status) ? row.status : 'ALFA')
    setEditReason(row.alasan_izin_guru_id || '')
    setEditCatatan(row.catatan_admin || '')
    setMessage('')
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true); setError(''); setMessage('')
    try {
      const result = await editAgendaStatus(
        editing.id, editing.penugasan_id, editing.tanggal, editing.guru_id,
        editing.jam_ke_mulai, editing.jam_ke_selesai, editStatus, editCatatan, editReason,
      )
      if (result.error) { setError(result.error); return }
      setEditing(null)
      await loadAgendas()
      setMessage(result.success || 'Keterangan berhasil diperbarui.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Keterangan gagal diperbarui.')
    } finally { setSaving(false) }
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
      {loaded && <><p className="text-sm text-slate-600 dark:text-slate-300">{agendas.length} agenda yang pernah dikirim · {agendas.filter(row => row.sudah_absen_siswa).length} absensi siswa diisi</p>
        {agendas.length > 0 ? <>
          <div className="hidden overflow-x-auto rounded-lg border bg-white dark:bg-slate-900 md:block"><Table><TableHeader><TableRow>
            <TableHead className="w-8 text-xs">#</TableHead><TableHead className="text-xs">Tanggal</TableHead><TableHead className="text-xs">Mapel</TableHead><TableHead className="text-xs">Kelas</TableHead><TableHead className="text-xs">Jam</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Absensi siswa</TableHead><TableHead className="text-right text-xs">Aksi</TableHead>
          </TableRow></TableHeader><TableBody>{agendas.map((row, index) => <TableRow key={row.id}>
            <TableCell className="text-xs text-slate-400">{index + 1}</TableCell>
            <TableCell className="whitespace-nowrap text-xs">{dateLabel(row.tanggal)}<br /><span className="text-slate-500">{timeLabel(row.waktu_input)}</span></TableCell>
            <TableCell className="text-xs text-slate-600 dark:text-slate-300">{row.mapel}</TableCell>
            <TableCell className="text-xs text-slate-600 dark:text-slate-300">{row.kelas}</TableCell>
            <TableCell className="whitespace-nowrap text-xs text-slate-500">{row.jam}</TableCell>
            <TableCell className="text-xs">{row.status.replaceAll('_', ' ')}{row.ppl_nama && <p className="text-[10px] text-violet-500">Diisi oleh {row.ppl_nama} (PPL)</p>}</TableCell>
            <TableCell><StudentAttendanceLabel filled={row.sudah_absen_siswa} /></TableCell>
            <TableCell className="whitespace-nowrap text-right"><AgendaActions row={row} onDetail={setDetail} onPhoto={setPhoto} onEdit={openEdit} /></TableCell>
          </TableRow>)}</TableBody></Table></div>
          <div className="space-y-2 md:hidden">{agendas.map((row, index) => <div key={row.id} className="rounded-lg border bg-white p-3 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-semibold">#{index + 1} · {dateLabel(row.tanggal)}</p><p className="truncate text-xs text-slate-500">{row.mapel} · {row.kelas} · {row.jam}</p></div><span className="shrink-0 text-xs">{row.status.replaceAll('_', ' ')}</span></div>
            <div className="mt-2 flex items-center justify-between"><p className="text-xs">Absensi siswa: <StudentAttendanceLabel filled={row.sudah_absen_siswa} /></p><AgendaActions row={row} onDetail={setDetail} onPhoto={setPhoto} onEdit={openEdit} /></div>
          </div>)}</div>
        </> : <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">Tidak ada agenda yang dikirim pada periode ini.</p>}
        <p className="text-xs text-slate-500">Menampilkan agenda tersimpan dengan waktu submit. Jika status atau materi pernah diperbarui, yang terlihat adalah nilai saat ini.</p>
      </>}
    </>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
    <Dialog open={!!detail} onOpenChange={() => setDetail(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Detail Agenda</DialogTitle></DialogHeader>{detail && <div className="space-y-2 text-sm"><p>{detail.mapel} · {detail.kelas} · {detail.jam}</p><p>{dateLabel(detail.tanggal)} · {timeLabel(detail.waktu_input)}</p><p>Status: {detail.status.replaceAll('_', ' ')}</p><p>Absensi siswa: <StudentAttendanceLabel filled={detail.sudah_absen_siswa} /></p><div><p className="text-xs text-slate-500">Materi</p><p className="whitespace-pre-wrap">{detail.materi || '—'}</p></div>{detail.catatan_admin && <div><p className="text-xs text-slate-500">Catatan admin</p><p className="whitespace-pre-wrap">{detail.catatan_admin}</p></div>}</div>}</DialogContent></Dialog>
    <Dialog open={!!photo} onOpenChange={() => setPhoto(null)}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Foto Agenda</DialogTitle></DialogHeader>{photo?.foto_url && <img src={photo.foto_url} alt={`Foto agenda ${photo.mapel} ${photo.kelas}`} className="max-h-[75vh] w-full rounded-lg object-contain" />}</DialogContent></Dialog>
    <Dialog open={!!editing} onOpenChange={() => setEditing(null)}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Ubah Status Agenda</DialogTitle></DialogHeader>{editing && <div className="space-y-4"><p className="text-sm">{editing.mapel} · {editing.kelas} · {dateLabel(editing.tanggal)}</p><div><Label className="text-xs">Status baru</Label><Select value={editStatus} onValueChange={setEditStatus}><SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent>{['TEPAT_WAKTU', 'TELAT', 'ALFA', 'SAKIT', 'IZIN'].map(status => <SelectItem key={status} value={status}>{status.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select></div>{editStatus === 'IZIN' && <TeacherLeaveSelect value={editReason} onChange={setEditReason} />}<div><Label className="text-xs">Catatan admin</Label><textarea value={editCatatan} onChange={event => setEditCatatan(event.target.value)} maxLength={1000} rows={3} className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-slate-900" /></div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<Button onClick={saveEdit} disabled={saving} className="w-full bg-indigo-600 text-white hover:bg-indigo-700">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan perubahan</Button></div>}</DialogContent></Dialog>
  </div>
}

function AgendaActions({ row, onDetail, onPhoto, onEdit }: { row: AgendaRow; onDetail: (row: AgendaRow) => void; onPhoto: (row: AgendaRow) => void; onEdit: (row: AgendaRow) => void }) {
  return <div className="inline-flex items-center gap-1">
    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onDetail(row)} title="Detail agenda" aria-label="Detail agenda"><Eye className="h-4 w-4 text-slate-500" /></Button>
    {row.foto_url && <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onPhoto(row)} title="Lihat foto agenda" aria-label="Lihat foto agenda"><Camera className="h-4 w-4 text-slate-500" /></Button>}
    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onEdit(row)} title="Ubah status agenda" aria-label="Ubah status agenda"><Edit3 className="h-4 w-4 text-indigo-500" /></Button>
  </div>
}
