// Lokasi: app/dashboard/settings/components/settings-client.tsx
'use client'

import { useState, useEffect } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CalendarDays, Loader2, PlusCircle, CheckCircle2, AlertCircle,
  Trash2, Power, X, Tags, Edit3, Clock, Copy, Plus, GripVertical
} from 'lucide-react'
import { tambahTahunAjaran, setAktifTahunAjaran, hapusTahunAjaran, simpanDaftarJurusan, simpanJamPelajaran } from '../actions'
import type { JamPelajaran } from '../actions'

type TAProps = {
  id: string; nama: string; semester: number; is_active: boolean
  daftar_jurusan?: string[]; jam_pelajaran?: JamPelajaran[]
}
const initialState = { error: null as string | null, success: null as string | null }
const defaultJurusan = ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

// Jam pelajaran default (dari data ASC bos)
const defaultJamPelajaran: JamPelajaran[] = [
  { id: 1,  nama: 'Jam 1',  mulai: '08:00', selesai: '08:40' },
  { id: 2,  nama: 'Jam 2',  mulai: '08:40', selesai: '09:20' },
  { id: 3,  nama: 'Jam 3',  mulai: '09:20', selesai: '10:00' },
  { id: 4,  nama: 'Jam 4',  mulai: '10:15', selesai: '10:50' },
  { id: 5,  nama: 'Jam 5',  mulai: '10:50', selesai: '11:25' },
  { id: 6,  nama: 'Jam 6',  mulai: '11:25', selesai: '12:00' },
  { id: 7,  nama: 'Jam 7',  mulai: '12:30', selesai: '13:05' },
  { id: 8,  nama: 'Jam 8',  mulai: '13:05', selesai: '13:40' },
  { id: 9,  nama: 'Jam 9',  mulai: '13:40', selesai: '14:25' },
  { id: 10, nama: 'Jam 10', mulai: '14:25', selesai: '15:10' },
]

function SubmitBtn() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full h-9 text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium">
      {pending ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Menyimpan...</> : 'Simpan Tahun Ajaran'}
    </Button>
  )
}

function JurusanTag({ label, onRemove }: { label: string; onRemove?: () => void }) {
  const isUmum = label === 'UMUM'
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold ${
      isUmum ? 'bg-surface-3 text-slate-500 dark:text-slate-400 border-surface' : 'bg-surface text-blue-700 border-blue-200'
    }`}>
      {label}
      {!isUmum && onRemove && (
        <button type="button" onClick={onRemove} className="text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
}

// ── Komponen Editor Jam Pelajaran ──────────────────────────────────────
function JamPelajaranEditor({
  jamList,
  onChange,
}: {
  jamList: JamPelajaran[]
  onChange: (list: JamPelajaran[]) => void
}) {
  const addJam = () => {
    const nextId = jamList.length > 0 ? Math.max(...jamList.map(j => j.id)) + 1 : 1
    onChange([...jamList, { id: nextId, nama: `Jam ${nextId}`, mulai: '', selesai: '' }])
  }

  const removeJam = (id: number) => {
    onChange(jamList.filter(j => j.id !== id))
  }

  const updateJam = (id: number, field: keyof JamPelajaran, value: string | number) => {
    onChange(jamList.map(j => j.id === id ? { ...j, [field]: value } : j))
  }

  return (
    <div className="space-y-2">
      {jamList.length === 0 ? (
        <div className="text-center py-4 text-xs text-slate-400 dark:text-slate-500 italic">
          Belum ada jam pelajaran. Klik Tambah atau Salin dari template.
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Header */}
          <div className="grid grid-cols-[32px_1fr_88px_88px_28px] gap-1.5 px-1">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase text-center">#</span>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Label</span>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase text-center">Mulai</span>
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase text-center">Selesai</span>
            <span />
          </div>
          {jamList.map((j) => (
            <div key={j.id} className="grid grid-cols-[32px_1fr_88px_88px_28px] gap-1.5 items-center">
              <div className="h-7 flex items-center justify-center rounded bg-surface-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 border border-surface">
                {j.id}
              </div>
              <Input
                value={j.nama}
                onChange={e => updateJam(j.id, 'nama', e.target.value)}
                className="h-7 text-xs rounded bg-surface-2 border-surface px-2"
                placeholder="Jam 1"
              />
              <Input
                type="time"
                value={j.mulai}
                onChange={e => updateJam(j.id, 'mulai', e.target.value)}
                className="h-7 text-xs rounded bg-surface-2 border-surface px-2 text-center"
              />
              <Input
                type="time"
                value={j.selesai}
                onChange={e => updateJam(j.id, 'selesai', e.target.value)}
                className="h-7 text-xs rounded bg-surface-2 border-surface px-2 text-center"
              />
              <button
                type="button"
                onClick={() => removeJam(j.id)}
                className="h-7 w-7 flex items-center justify-center rounded text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addJam}
          className="h-7 text-xs gap-1.5 rounded-md border-dashed"
        >
          <Plus className="h-3 w-3" /> Tambah Jam
        </Button>
        {jamList.length === 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(defaultJamPelajaran)}
            className="h-7 text-xs gap-1.5 rounded-md border-dashed text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Copy className="h-3 w-3" /> Salin dari Default
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────
export function SettingsClient({ taData }: { taData: TAProps[] }) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [state, formAction] = useActionState(tambahTahunAjaran, initialState)

  // State untuk form tambah TA
  const [tambahJurusanList, setTambahJurusanList] = useState<string[]>(defaultJurusan)
  const [tambahJurusanInput, setTambahJurusanInput] = useState('')
  const [tambahJamList, setTambahJamList] = useState<JamPelajaran[]>([])

  // State untuk edit Jurusan
  const [editingJurusanTA, setEditingJurusanTA] = useState<TAProps | null>(null)
  const [editJurusanList, setEditJurusanList] = useState<string[]>([])
  const [editJurusanInput, setEditJurusanInput] = useState('')
  const [isSavingJurusan, setIsSavingJurusan] = useState(false)

  // State untuk edit Jam Pelajaran
  const [editingJamTA, setEditingJamTA] = useState<TAProps | null>(null)
  const [editJamList, setEditJamList] = useState<JamPelajaran[]>([])
  const [isSavingJam, setIsSavingJam] = useState(false)

  const addJurusan = (isEdit: boolean) => {
    const input = isEdit ? editJurusanInput : tambahJurusanInput
    if (!input.trim()) return
    const clean = input.trim().toUpperCase()
    if (isEdit) {
      if (!editJurusanList.includes(clean)) setEditJurusanList(p => [...p, clean])
      setEditJurusanInput('')
    } else {
      if (!tambahJurusanList.includes(clean)) setTambahJurusanList(p => [...p, clean])
      setTambahJurusanInput('')
    }
  }

  const removeJurusan = (isEdit: boolean, j: string) => {
    if (j === 'UMUM') { alert('Jurusan UMUM tidak bisa dihapus.'); return }
    if (isEdit) setEditJurusanList(p => p.filter(x => x !== j))
    else setTambahJurusanList(p => p.filter(x => x !== j))
  }

  const submitEditJurusan = async () => {
    if (!editingJurusanTA) return
    setIsSavingJurusan(true)
    const res = await simpanDaftarJurusan(editingJurusanTA.id, editJurusanList)
    if (res.error) alert(res.error)
    else { alert(res.success); setEditingJurusanTA(null) }
    setIsSavingJurusan(false)
  }

  const submitEditJam = async () => {
    if (!editingJamTA) return
    setIsSavingJam(true)
    const res = await simpanJamPelajaran(editingJamTA.id, editJamList)
    if (res.error) alert(res.error)
    else { alert(res.success); setEditingJamTA(null) }
    setIsSavingJam(false)
  }

  // Salin jam dari TA lain
  const copyJamFromOther = (sourceTA: TAProps) => {
    if (!sourceTA.jam_pelajaran || sourceTA.jam_pelajaran.length === 0) {
      alert('TA tersebut belum punya jam pelajaran.')
      return
    }
    setEditJamList([...sourceTA.jam_pelajaran])
  }

  useEffect(() => {
    if (state?.success) {
      const t = setTimeout(() => {
        setIsAddOpen(false)
        setTambahJurusanList(defaultJurusan)
        setTambahJamList([])
      }, 1500)
      return () => clearTimeout(t)
    }
  }, [state?.success])

  const handleSetAktif = async (id: string) => {
    setIsPending(true)
    const res = await setAktifTahunAjaran(id)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

  const handleHapus = async (id: string, isActive: boolean) => {
    if (!confirm('Yakin ingin menghapus Tahun Ajaran ini? Semua data penugasan dan jadwal terkait akan ikut terhapus.')) return
    setIsPending(true)
    const res = await hapusTahunAjaran(id, isActive)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

  // TA lain yang punya jam (untuk opsi salin)
  const taWithJam = taData.filter(ta => ta.jam_pelajaran && ta.jam_pelajaran.length > 0)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-2">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-surface-3 border border-surface">
              <CalendarDays className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Manajemen Tahun Ajaran</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Kelola periode, jurusan, dan jam pelajaran</p>
            </div>
          </div>

          {/* Dialog Tambah TA */}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg">
                <PlusCircle className="h-3.5 w-3.5" /> Tambah Periode
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg rounded-xl border-surface">
              <DialogHeader className="border-b border-surface-2 pb-3">
                <DialogTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100">Setup Tahun Ajaran Baru</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[75vh] pr-1 py-1">
                <form action={formAction} className="space-y-4 px-1">
                  {state?.error && (
                    <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-100 flex gap-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.error}
                    </div>
                  )}
                  {state?.success && (
                    <div className="p-2.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100 flex gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.success}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Nama periode</Label>
                      <Input name="nama" required placeholder="Contoh: 2025/2026" className="h-9 rounded-lg bg-surface-2 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Semester</Label>
                      <Select name="semester" defaultValue="1">
                        <SelectTrigger className="h-9 rounded-lg bg-surface-2 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1" className="text-sm">Ganjil (1)</SelectItem>
                          <SelectItem value="2" className="text-sm">Genap (2)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Jurusan */}
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Tags className="h-3.5 w-3.5 text-blue-600" />
                      <p className="text-xs font-semibold text-blue-800">Daftar Jurusan / Kelompok</p>
                    </div>
                    <div className="flex gap-2">
                      <Input value={tambahJurusanInput} onChange={e => setTambahJurusanInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addJurusan(false) } }}
                        placeholder="Ketik lalu Enter..." className="h-8 rounded-md text-xs bg-surface border-blue-200 flex-1" />
                      <Button type="button" onClick={() => addJurusan(false)}
                        className="h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium">
                        Tambah
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tambahJurusanList.map(j => (
                        <JurusanTag key={j} label={j} onRemove={() => removeJurusan(false, j)} />
                      ))}
                    </div>
                    <input type="hidden" name="daftar_jurusan" value={JSON.stringify(tambahJurusanList)} />
                  </div>

                  {/* Jam Pelajaran */}
                  <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        <p className="text-xs font-semibold text-amber-800">Jam Pelajaran</p>
                      </div>
                      {tambahJamList.length === 0 && taWithJam.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTambahJamList([...taWithJam[0].jam_pelajaran!])}
                          className="text-[11px] text-amber-700 hover:text-amber-900 flex items-center gap-1 font-medium"
                        >
                          <Copy className="h-3 w-3" /> Salin dari TA sebelumnya
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-amber-700 -mt-1">Bisa diisi sekarang atau dikonfigurasi nanti di pengaturan.</p>
                    <JamPelajaranEditor jamList={tambahJamList} onChange={setTambahJamList} />
                    <input type="hidden" name="jam_pelajaran" value={JSON.stringify(tambahJamList)} />
                  </div>

                  <SubmitBtn />
                </form>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>

        {/* LIST TA */}
        {taData.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">Belum ada data Tahun Ajaran.</div>
        ) : taData.map(ta => (
          <div key={ta.id} className={`flex flex-col xl:flex-row xl:items-center justify-between p-4 border-b border-surface-2 last:border-0 gap-4 transition-colors ${ta.is_active ? 'bg-emerald-50/40' : 'hover:bg-surface-2/50'}`}>

            {/* Info */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                ta.is_active ? 'bg-emerald-500 text-white border-emerald-300' : 'bg-surface-3 text-slate-400 dark:text-slate-500 border-surface'
              }`}>
                {ta.semester}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${ta.is_active ? 'text-emerald-900' : 'text-slate-800 dark:text-slate-100'}`}>{ta.nama}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Semester {ta.semester === 1 ? 'Ganjil' : 'Genap'}</p>

                {/* Jurusan tags */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {ta.daftar_jurusan?.map(j => (
                    <span key={j} className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                      ta.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-surface-3 text-slate-500 dark:text-slate-400 border-surface'
                    }`}>{j}</span>
                  ))}
                </div>

                {/* Jam pelajaran summary */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Clock className="h-3 w-3 text-slate-300 dark:text-slate-600 shrink-0" />
                  {ta.jam_pelajaran && ta.jam_pelajaran.length > 0 ? (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {ta.jam_pelajaran.length} jam pelajaran
                      <span className="mx-1 text-slate-200 dark:text-slate-700">·</span>
                      {ta.jam_pelajaran[0].mulai} – {ta.jam_pelajaran[ta.jam_pelajaran.length - 1].selesai}
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-500 italic">Jam pelajaran belum dikonfigurasi</span>
                  )}
                </div>
              </div>
            </div>

            {/* Aksi */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button variant="outline" size="sm"
                onClick={() => { setEditingJamTA(ta); setEditJamList(ta.jam_pelajaran ? [...ta.jam_pelajaran] : []) }}
                className="h-8 text-xs gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg">
                <Clock className="h-3.5 w-3.5" /> Jam Pelajaran
              </Button>

              <Button variant="outline" size="sm"
                onClick={() => { setEditingJurusanTA(ta); setEditJurusanList(ta.daftar_jurusan || defaultJurusan) }}
                className="h-8 text-xs gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg">
                <Edit3 className="h-3.5 w-3.5" /> Jurusan
              </Button>

              {ta.is_active ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Aktif
                </span>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleSetAktif(ta.id)} disabled={isPending}
                    className="h-8 text-xs gap-1.5 border-surface text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 rounded-lg">
                    <Power className="h-3.5 w-3.5" /> Aktifkan
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleHapus(ta.id, ta.is_active)} disabled={isPending}
                    className="h-8 w-8 p-0 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── MODAL EDIT JURUSAN ── */}
      <Dialog open={!!editingJurusanTA} onOpenChange={open => !open && setEditingJurusanTA(null)}>
        <DialogContent className="sm:max-w-sm rounded-xl border-surface">
          <DialogHeader className="border-b border-surface-2 pb-3">
            <DialogTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Edit Jurusan — TA {editingJurusanTA?.nama}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-3">
              <p className="text-[10px] text-blue-600 leading-relaxed">
                Menghapus jurusan tidak merusak data lama, hanya menghilangkan dari dropdown ke depannya.
              </p>
              <div className="flex gap-2">
                <Input value={editJurusanInput} onChange={e => setEditJurusanInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addJurusan(true) } }}
                  placeholder="Ketik lalu Enter..." className="h-8 rounded-md text-xs bg-surface border-blue-200 flex-1" />
                <Button type="button" onClick={() => addJurusan(true)}
                  className="h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium">
                  Tambah
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {editJurusanList.map(j => (
                  <JurusanTag key={j} label={j} onRemove={() => removeJurusan(true, j)} />
                ))}
              </div>
            </div>
            <Button onClick={submitEditJurusan} disabled={isSavingJurusan}
              className="w-full h-9 text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium">
              {isSavingJurusan ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Menyimpan...</> : 'Simpan Perubahan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL EDIT JAM PELAJARAN ── */}
      <Dialog open={!!editingJamTA} onOpenChange={open => !open && setEditingJamTA(null)}>
        <DialogContent className="sm:max-w-lg rounded-xl border-surface">
          <DialogHeader className="border-b border-surface-2 pb-3">
            <DialogTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Jam Pelajaran — TA {editingJamTA?.nama}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-1">
            <div className="space-y-4 py-2 px-1">
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                Jam pelajaran ini digunakan sebagai acuan tampilan jadwal mengajar. Perubahan tidak merusak data jadwal yang sudah ada.
              </p>

              {/* Opsi salin dari TA lain */}
              {taWithJam.filter(t => t.id !== editingJamTA?.id).length > 0 && (
                <div className="rounded-lg border border-surface-2 bg-surface-2 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Salin dari Tahun Ajaran lain</p>
                  <div className="flex flex-wrap gap-2">
                    {taWithJam.filter(t => t.id !== editingJamTA?.id).map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => copyJamFromOther(t)}
                        className="text-xs px-2.5 py-1.5 rounded-md border border-surface bg-surface hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1.5"
                      >
                        <Copy className="h-3 w-3" /> {t.nama} Smt {t.semester}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <JamPelajaranEditor jamList={editJamList} onChange={setEditJamList} />
            </div>
          </ScrollArea>
          <div className="border-t border-surface-2 pt-3">
            <Button onClick={submitEditJam} disabled={isSavingJam}
              className="w-full h-9 text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium">
              {isSavingJam ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Menyimpan...</> : 'Simpan Jam Pelajaran'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
