'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getTeacherLeaveOptions, mapTeacherLeaveReasons, saveTeacherLeaveReason, type TeacherLeaveMappingTarget } from '@/app/dashboard/monitoring-penugasan/leave-actions'
import type { TeacherLeaveMetadata, TeacherLeaveReason } from '@/lib/teacher-leave'

export function TeacherLeaveBadge({ data }: { data: TeacherLeaveMetadata }) {
  return <span className="inline-flex flex-wrap items-center gap-1 text-xs">
    {data.kepentingan_sekolah && <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-emerald-800">Kepentingan Sekolah</span>}
    {data.alasan_izin_guru_nama && <span>{data.alasan_izin_guru_nama}</span>}
  </span>
}

export function TeacherLeaveSelect({ value, onChange, schoolOnly = false }: { value: string; onChange: (id: string) => void; schoolOnly?: boolean }) {
  const [reasons, setReasons] = useState<TeacherLeaveReason[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const load = () => { getTeacherLeaveOptions().then(data => {
      if (active) { setReasons(data.reasons); setError('') }
    }).catch(() => { if (active) setError('Daftar alasan gagal dimuat. Muat ulang halaman.') }) }
    load()
    window.addEventListener('teacher-leave-changed', load)
    return () => { active = false; window.removeEventListener('teacher-leave-changed', load) }
  }, [])
  const selected = reasons.find(row => row.id === value)
  return <div className="space-y-1">
    <label className="block text-xs font-medium">Alasan izin guru
      <select className="mt-1 h-9 w-full rounded-md border bg-surface px-2 text-sm" value={value} onChange={e => onChange(e.target.value)} required>
        <option value="">Pilih alasan izin</option>
        {reasons.filter(row => (!schoolOnly || row.kepentingan_sekolah) && (row.aktif || row.id === value)).map(row => <option disabled={!row.aktif} key={row.id} value={row.id}>{row.nama}{row.kepentingan_sekolah ? ' — Kepentingan Sekolah' : ''}{!row.aktif ? ' (nonaktif — pilih alasan aktif)' : ''}</option>)}
      </select>
    </label>
    {selected?.kepentingan_sekolah && <p className="text-xs text-emerald-700">Kepentingan Sekolah — tidak mengurangi performa.</p>}
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </div>
}

export function TeacherLeaveManager({ onChanged }: { onChanged?: () => void }) {
  const [allowed, setAllowed] = useState(false)
  const [open, setOpen] = useState(false)
  const [reasons, setReasons] = useState<TeacherLeaveReason[]>([])
  const blank: TeacherLeaveReason = { id: '', nama: '', kepentingan_sekolah: false, aktif: true }
  const [form, setForm] = useState(blank)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const load = () => getTeacherLeaveOptions().then(data => { setReasons(data.reasons); setAllowed(data.canManage) })
  useEffect(() => { load().catch(() => setAllowed(false)) }, [])
  if (!allowed) return null
  const save = async () => {
    setPending(true)
    try {
      const result = await saveTeacherLeaveReason(form)
      setMessage(result.error || result.success || '')
      if (!result.error) { await load(); setForm(blank); router.refresh(); window.dispatchEvent(new Event('teacher-leave-changed')); onChanged?.() }
    } catch { setMessage('Gagal menyimpan alasan.') } finally { setPending(false) }
  }
  return <>
    <Button variant="outline" size="sm" onClick={() => { setOpen(true); load().catch(() => setMessage('Gagal memuat alasan.')) }}>Kelola Alasan Izin Guru</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Kelola Alasan Izin Guru</DialogTitle></DialogHeader>
      <p className="text-sm text-amber-700">Perubahan kategori berlaku untuk seluruh izin yang memakai alasan ini, termasuk performa dan cetakan periode lama. Nonaktifkan alasan untuk menghentikan pilihan baru.</p>
      <div className="max-h-52 space-y-1 overflow-y-auto">{reasons.map(reason => <button key={reason.id} onClick={() => { setForm(reason); setMessage('') }} className="flex w-full items-center justify-between rounded border p-2 text-left text-sm">
        <span>{reason.nama}{!reason.aktif ? ' (Nonaktif)' : ''}</span><span className="text-xs">{reason.kepentingan_sekolah ? 'Kepentingan Sekolah' : 'Nonkepentingan Sekolah'}</span>
      </button>)}</div>
      <Input aria-label="Nama alasan" placeholder="Nama alasan, misalnya Rapat" maxLength={120} value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.kepentingan_sekolah} onChange={e => setForm({ ...form, kepentingan_sekolah: e.target.checked })} />Kepentingan Sekolah — kredit penuh untuk performa</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.aktif} onChange={e => setForm({ ...form, aktif: e.target.checked })} />Aktif untuk pilihan baru</label>
      {message && <p role="status" className="text-sm">{message}</p>}
      <div className="flex gap-2"><Button disabled={pending || !form.nama.trim()} onClick={save}>{pending ? 'Menyimpan…' : form.id ? 'Simpan perubahan' : 'Tambah alasan'}</Button><Button variant="outline" onClick={() => setForm(blank)}>Alasan baru</Button></div>
    </DialogContent></Dialog>
  </>
}

export function TeacherLeaveMapping({ targets, onChanged, schoolOnly = false }: { targets: TeacherLeaveMappingTarget[]; onChanged: () => void | Promise<void>; schoolOnly?: boolean }) {
  const [allowed, setAllowed] = useState(false)
  const [hasSchoolReason, setHasSchoolReason] = useState(false)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const router = useRouter()
  useEffect(() => { getTeacherLeaveOptions().then(data => { setAllowed(data.canManage); setHasSchoolReason(data.reasons.some(reason => reason.aktif && reason.kepentingan_sekolah)) }).catch(() => setAllowed(false)) }, [])
  if (!allowed) return null
  const save = async () => {
    setPending(true)
    try {
      const result = await mapTeacherLeaveReasons(targets, reason, schoolOnly)
      setMessage(result.error || result.success || '')
      if (!result.error) { await onChanged(); router.refresh(); window.dispatchEvent(new Event('teacher-leave-changed')); setOpen(false) }
    } catch { setMessage('Gagal memperbarui alasan izin.') } finally { setPending(false) }
  }
  return <>
    <Button size="sm" variant="outline" disabled={!targets.length || targets.length > 100 || (schoolOnly && !hasSchoolReason)} title={schoolOnly && !hasSchoolReason ? 'Tambahkan alasan izin sekolah aktif terlebih dahulu.' : undefined} onClick={() => { setOpen(true); setMessage(''); setReason('') }}>{schoolOnly ? 'Tandai izin sekolah' : 'Atur alasan izin'} ({targets.length})</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{schoolOnly ? 'Tandai izin sekolah' : 'Atur alasan izin'}</DialogTitle></DialogHeader>
      <p className="text-sm">Perbarui {targets.length} izin terpilih. Deskripsi tetap tersimpan. Performa dan cetakan mengikuti kategori alasan.</p>
      <TeacherLeaveSelect value={reason} onChange={setReason} schoolOnly={schoolOnly} />
      {message && <p role="alert" className="text-sm">{message}</p>}
      <Button onClick={save} disabled={pending || !reason}>{pending ? 'Menyimpan…' : 'Simpan alasan'}</Button>
    </DialogContent></Dialog>
  </>
}
