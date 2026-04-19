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
  Trash2, Power, X, Tags, Edit3, Clock, Copy, Plus, ChevronDown, ChevronUp
} from 'lucide-react'
import {
  tambahTahunAjaran, setAktifTahunAjaran, hapusTahunAjaran,
  simpanDaftarJurusan, simpanJamPelajaran
} from '../actions'
import { DEFAULT_POLA_JAM } from '../types'
import type { PolaJam, SlotJam } from '../types'
import { cn } from '@/lib/utils'

type TAProps = {
  id: string; nama: string; semester: number; is_active: boolean
  daftar_jurusan?: string[]; jam_pelajaran?: PolaJam[]
}

// Guard: pastikan jam_pelajaran selalu PolaJam[] yang valid
// Handle format lama [{id,nama,mulai,selesai}] maupun null/undefined/non-array
function ensurePolaArray(raw: any): PolaJam[] {
  if (!raw) return []
  const arr = Array.isArray(raw) ? raw : []
  if (arr.length === 0) return []
  // Format lama: tidak punya field slots/hari
  if (typeof arr[0].slots === 'undefined' && typeof arr[0].hari === 'undefined') {
    return [{ id: 'pola_legacy', nama: 'Semua Hari', hari: [1,2,3,4,5,6], slots: arr }]
  }
  // Pastikan setiap pola punya hari & slots sebagai array
  return arr.map((p: any) => ({
    ...p,
    hari: Array.isArray(p.hari) ? p.hari : [],
    slots: Array.isArray(p.slots) ? p.slots : [],
  }))
}

const initialState = { error: null as string | null, success: null as string | null }
const defaultJurusan = ['MIPA-F', 'MIPA-M', 'SOSHUM', 'KEAGAMAAN', 'UMUM']
const HARI_LABELS = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const HARI_COLORS = [
  '', 'bg-blue-100 text-blue-700 border-blue-200',
  'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-amber-100 text-amber-700 border-amber-200',
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
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold ${isUmum ? 'bg-surface-3 text-slate-500 dark:text-slate-400 border-surface' : 'bg-surface text-blue-700 border-blue-200'}`}>
      {label}
      {!isUmum && onRemove && (
        <button type="button" onClick={onRemove} className="text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
}

// ── HariPill: tombol toggle assign hari ke pola ─────────────────────────
function HariPill({ hari, active, onClick, disabled }: { hari: number; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all',
        active ? HARI_COLORS[hari] : 'bg-surface-2 text-slate-400 dark:text-slate-500 border-surface hover:bg-surface-3',
        disabled && !active && 'opacity-40 cursor-not-allowed'
      )}
    >
      {HARI_LABELS[hari]}
    </button>
  )
}

// ── Editor satu pola ────────────────────────────────────────────────────
function PolaEditor({
  pola,
  allPola,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: {
  pola: PolaJam
  allPola: PolaJam[]
  index: number
  onUpdate: (updated: PolaJam) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const [expanded, setExpanded] = useState(index === 0)

  // Hari yang sudah dipakai pola LAIN
  const hariTerpakai = new Set(
    allPola.filter(p => p.id !== pola.id).flatMap(p => Array.isArray(p.hari) ? p.hari : [])
  )

  const toggleHari = (h: number) => {
    const newHari = pola.hari.includes(h)
      ? pola.hari.filter(x => x !== h)
      : [...pola.hari, h].sort()
    onUpdate({ ...pola, hari: newHari })
  }

  const addSlot = () => {
    const nextId = pola.slots.length > 0 ? Math.max(...pola.slots.map(s => s.id)) + 1 : 1
    onUpdate({ ...pola, slots: [...pola.slots, { id: nextId, nama: `Jam ${nextId}`, mulai: '', selesai: '' }] })
  }

  const removeSlot = (id: number) => {
    onUpdate({ ...pola, slots: pola.slots.filter(s => s.id !== id) })
  }

  const updateSlot = (id: number, field: keyof SlotJam, value: string | number) => {
    onUpdate({ ...pola, slots: pola.slots.map(s => s.id === id ? { ...s, [field]: value } : s) })
  }

  const colorClass = pola.hari.length > 0 ? HARI_COLORS[pola.hari[0]] : 'bg-surface-3 text-slate-500 dark:text-slate-400 border-surface'

  return (
    <div className="rounded-xl border border-surface overflow-hidden">
      {/* Header pola */}
      <div
        className={cn('flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none', expanded ? 'border-b border-surface-2 bg-surface-2' : 'hover:bg-surface-2/60')}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Nomor */}
        <div className={cn('h-6 w-6 rounded-md flex items-center justify-center text-[11px] font-bold border shrink-0', colorClass)}>
          {index + 1}
        </div>

        {/* Nama pola */}
        <Input
          value={pola.nama}
          onChange={e => { e.stopPropagation(); onUpdate({ ...pola, nama: e.target.value }) }}
          onClick={e => e.stopPropagation()}
          className="h-7 text-xs font-semibold bg-transparent border-transparent hover:border-surface focus:bg-surface focus:border-slate-200 dark:focus:border-slate-800 rounded-md flex-1 min-w-0 px-2"
          placeholder="Nama pola..."
        />

        {/* Hari pills ringkas */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {pola.hari.length === 0
            ? <span className="text-[10px] text-amber-500 italic">belum assign hari</span>
            : pola.hari.map(h => (
              <span key={h} className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold border', HARI_COLORS[h])}>
                {HARI_LABELS[h]}
              </span>
            ))
          }
        </div>

        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{pola.slots.length} jam</span>

        {canRemove && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="p-1 rounded text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />}
      </div>

      {/* Body pola */}
      {expanded && (
        <div className="p-3 space-y-3 bg-surface">
          {/* Assign hari */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Berlaku untuk hari:</p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6].map(h => (
                <HariPill
                  key={h}
                  hari={h}
                  active={pola.hari.includes(h)}
                  onClick={() => toggleHari(h)}
                  disabled={hariTerpakai.has(h)}
                />
              ))}
            </div>
            {hariTerpakai.size > 0 && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                Hari yang abu-abu sudah dipakai pola lain
              </p>
            )}
          </div>

          {/* Slot jam */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Jam Pelajaran:</p>

            {pola.slots.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic py-1">Belum ada jam. Klik Tambah Jam.</p>
            ) : (
              <div className="space-y-1">
                {/* Header kolom */}
                <div className="grid grid-cols-[28px_1fr_84px_84px_28px] gap-1.5 px-0.5">
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 text-center">#</span>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Label</span>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 text-center">Mulai</span>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 text-center">Selesai</span>
                  <span />
                </div>
                {pola.slots.map(s => (
                  <div key={s.id} className="grid grid-cols-[28px_1fr_84px_84px_28px] gap-1.5 items-center">
                    <div className="h-7 flex items-center justify-center rounded bg-surface-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 border border-surface">
                      {s.id}
                    </div>
                    <Input
                      value={s.nama}
                      onChange={e => updateSlot(s.id, 'nama', e.target.value)}
                      className="h-7 text-xs rounded bg-surface-2 border-surface px-2"
                      placeholder="Jam 1"
                    />
                    <Input
                      type="time"
                      value={s.mulai}
                      onChange={e => updateSlot(s.id, 'mulai', e.target.value)}
                      className="h-7 text-xs rounded bg-surface-2 border-surface px-1.5 text-center"
                    />
                    <Input
                      type="time"
                      value={s.selesai}
                      onChange={e => updateSlot(s.id, 'selesai', e.target.value)}
                      className="h-7 text-xs rounded bg-surface-2 border-surface px-1.5 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => removeSlot(s.id)}
                      className="h-7 w-7 flex items-center justify-center rounded text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button type="button" variant="outline" size="sm" onClick={addSlot}
              className="h-7 text-xs gap-1.5 rounded-md border-dashed mt-1">
              <Plus className="h-3 w-3" /> Tambah Jam
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Editor keseluruhan pola jam ─────────────────────────────────────────
function PolaJamEditor({ value, onChange }: { value: PolaJam[]; onChange: (v: PolaJam[]) => void }) {
  const addPola = () => {
    const nextIdx = value.length + 1
    onChange([...value, {
      id: `pola${Date.now()}`,
      nama: `Pola ${nextIdx}`,
      hari: [],
      slots: [],
    }])
  }

  const updatePola = (idx: number, updated: PolaJam) => {
    onChange(value.map((p, i) => i === idx ? updated : p))
  }

  const removePola = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx))
  }

  // Summary: hari yang belum tercakup
  const allHari = [1, 2, 3, 4, 5, 6]
  const coveredHari = new Set(value.flatMap(p => Array.isArray(p.hari) ? p.hari : []))
  const uncoveredHari = allHari.filter(h => !coveredHari.has(h))

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <div className="text-center py-4 text-xs text-slate-400 dark:text-slate-500 italic">
          Belum ada pola jam. Klik Tambah Pola atau Pakai Template.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((pola, idx) => (
            <PolaEditor
              key={pola.id}
              pola={pola}
              allPola={value}
              index={idx}
              onUpdate={updated => updatePola(idx, updated)}
              onRemove={() => removePola(idx)}
              canRemove={value.length > 1}
            />
          ))}
        </div>
      )}

      {/* Warning hari belum tercakup */}
      {value.length > 0 && uncoveredHari.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg">
          <span className="font-semibold">⚠</span>
          Hari belum tercakup: {uncoveredHari.map(h => HARI_LABELS[h]).join(', ')}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={addPola}
          className="h-7 text-xs gap-1.5 rounded-md border-dashed">
          <Plus className="h-3 w-3" /> Tambah Pola
        </Button>
        {value.length === 0 && (
          <Button type="button" variant="outline" size="sm"
            onClick={() => onChange(DEFAULT_POLA_JAM)}
            className="h-7 text-xs gap-1.5 rounded-md border-dashed text-blue-600 border-blue-200 hover:bg-blue-50">
            <Copy className="h-3 w-3" /> Pakai Template MAN 1 Tasik
          </Button>
        )}
      </div>
    </div>
  )
}

// ── MAIN ────────────────────────────────────────────────────────────────
export function SettingsClient({ taData }: { taData: TAProps[] }) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [state, formAction] = useActionState(tambahTahunAjaran, initialState)

  // Form tambah TA
  const [tambahJurusanList, setTambahJurusanList] = useState<string[]>(defaultJurusan)
  const [tambahJurusanInput, setTambahJurusanInput] = useState('')
  const [tambahPolaJam, setTambahPolaJam] = useState<PolaJam[]>([])

  // Edit Jurusan
  const [editingJurusanTA, setEditingJurusanTA] = useState<TAProps | null>(null)
  const [editJurusanList, setEditJurusanList] = useState<string[]>([])
  const [editJurusanInput, setEditJurusanInput] = useState('')
  const [isSavingJurusan, setIsSavingJurusan] = useState(false)

  // Edit Jam Pelajaran
  const [editingJamTA, setEditingJamTA] = useState<TAProps | null>(null)
  const [editPolaJam, setEditPolaJam] = useState<PolaJam[]>([])
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
    try {
      const res = await simpanJamPelajaran(editingJamTA.id, editPolaJam)
      if (res?.error) alert(res.error)
      else { alert(res?.success ?? 'Berhasil disimpan!'); setEditingJamTA(null) }
    } catch (e: any) {
      alert('Gagal menyimpan: ' + (e?.message ?? 'Terjadi kesalahan'))
    } finally {
      setIsSavingJam(false)
    }
  }

  useEffect(() => {
    if (state?.success) {
      const t = setTimeout(() => {
        setIsAddOpen(false)
        setTambahJurusanList(defaultJurusan)
        setTambahPolaJam([])
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

  // Summary jam untuk card TA
  const getJamSummary = (pola: PolaJam[]) => {
    if (!pola || pola.length === 0) return null
    const totalSlot = pola.reduce((a, p) => a + p.slots.length, 0)
    const maxJam = Math.max(...pola.map(p => p.slots.length))
    return { pola: pola.length, maxJam, totalSlot }
  }

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
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">Manajemen Tahun Ajaran</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Kelola periode, jurusan, dan jam pelajaran per hari</p>
            </div>
          </div>

          {/* Dialog Tambah TA */}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg">
                <PlusCircle className="h-3.5 w-3.5" /> Tambah Periode
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl rounded-xl border-surface">
              <DialogHeader className="border-b border-surface-2 pb-3">
                <DialogTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">Setup Tahun Ajaran Baru</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[78vh] pr-1 py-1">
                <form action={formAction} className="space-y-4 px-1">
                  {state?.error && (
                    <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-100 flex gap-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.error}
                    </div>
                  )}
                  {state?.success && (
                    <div className="p-2.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-100 flex gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {state.success}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300">Nama periode</Label>
                      <Input name="nama" required placeholder="Contoh: 2025/2026" className="h-9 rounded-lg bg-surface-2 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300">Semester</Label>
                      <Select name="semester" defaultValue="1">
                        <SelectTrigger className="h-9 rounded-lg bg-surface-2 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Ganjil (1)</SelectItem>
                          <SelectItem value="2">Genap (2)</SelectItem>
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
                        className="h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs">
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
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                      <p className="text-xs font-semibold text-amber-800">Jam Pelajaran per Hari</p>
                    </div>
                    <p className="text-[10px] text-amber-700 -mt-1">Bisa dikonfigurasi nanti. Tiap pola bisa berlaku untuk beberapa hari sekaligus.</p>
                    <PolaJamEditor value={tambahPolaJam} onChange={setTambahPolaJam} />
                    <input type="hidden" name="jam_pelajaran" value={JSON.stringify(tambahPolaJam)} />
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
        ) : taData.map(ta => {
          const jamSummary = getJamSummary(ensurePolaArray(ta.jam_pelajaran))
          return (
            <div key={ta.id} className={cn(
              'flex flex-col xl:flex-row xl:items-center justify-between p-4 border-b border-surface-2 last:border-0 gap-4 transition-colors',
              ta.is_active ? 'bg-emerald-50 dark:bg-emerald-950/50/40' : 'hover:bg-surface-2/50'
            )}>
              {/* Info */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={cn(
                  'h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold border-2',
                  ta.is_active ? 'bg-emerald-500 text-white border-emerald-300' : 'bg-surface-3 text-slate-400 dark:text-slate-500 border-surface'
                )}>
                  {ta.semester}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-semibold', ta.is_active ? 'text-emerald-900' : 'text-slate-800 dark:text-slate-200 dark:text-slate-100')}>{ta.nama}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Semester {ta.semester === 1 ? 'Ganjil' : 'Genap'}</p>

                  {/* Jurusan */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {ta.daftar_jurusan?.map(j => (
                      <span key={j} className={cn(
                        'text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border',
                        ta.is_active ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-surface-3 text-slate-500 dark:text-slate-400 border-surface'
                      )}>{j}</span>
                    ))}
                  </div>

                  {/* Jam pelajaran summary */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Clock className="h-3 w-3 text-slate-300 dark:text-slate-600 shrink-0" />
                    {jamSummary ? (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {jamSummary.pola} pola · maks {jamSummary.maxJam} jam/hari
                        </span>
                        {/* Mini hari pills */}
                        {ensurePolaArray(ta.jam_pelajaran).map(pola => (
                          pola.hari.map(h => (
                            <span key={`${pola.id}-${h}`} className={cn('text-[9px] font-bold px-1 py-0.5 rounded border', HARI_COLORS[h])}>
                              {HARI_LABELS[h]}
                            </span>
                          ))
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] text-amber-500 italic">Jam pelajaran belum dikonfigurasi</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Aksi */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button variant="outline" size="sm"
                  onClick={() => { setEditingJamTA(ta); setEditPolaJam(ensurePolaArray(ta.jam_pelajaran)) }}
                  className="h-8 text-xs gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50 rounded-lg">
                  <Clock className="h-3.5 w-3.5" /> Jam Pelajaran
                </Button>

                <Button variant="outline" size="sm"
                  onClick={() => { setEditingJurusanTA(ta); setEditJurusanList(ta.daftar_jurusan || defaultJurusan) }}
                  className="h-8 text-xs gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg">
                  <Edit3 className="h-3.5 w-3.5" /> Jurusan
                </Button>

                {ta.is_active ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Aktif
                  </span>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleSetAktif(ta.id)} disabled={isPending}
                      className="h-8 text-xs gap-1.5 border-surface text-slate-600 dark:text-slate-400 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 hover:border-emerald-200 dark:hover:border-emerald-800 rounded-lg">
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
          )
        })}
      </div>

      {/* ── MODAL EDIT JURUSAN ── */}
      <Dialog open={!!editingJurusanTA} onOpenChange={open => !open && setEditingJurusanTA(null)}>
        <DialogContent className="sm:max-w-sm rounded-xl border-surface">
          <DialogHeader className="border-b border-surface-2 pb-3">
            <DialogTitle className="text-sm font-semibold">Edit Jurusan — TA {editingJurusanTA?.nama}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-3">
              <p className="text-[10px] text-blue-600">Menghapus jurusan tidak merusak data lama.</p>
              <div className="flex gap-2">
                <Input value={editJurusanInput} onChange={e => setEditJurusanInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addJurusan(true) } }}
                  placeholder="Ketik lalu Enter..." className="h-8 rounded-md text-xs bg-surface border-blue-200 flex-1" />
                <Button type="button" onClick={() => addJurusan(true)}
                  className="h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs">Tambah</Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {editJurusanList.map(j => (
                  <JurusanTag key={j} label={j} onRemove={() => removeJurusan(true, j)} />
                ))}
              </div>
            </div>
            <Button onClick={submitEditJurusan} disabled={isSavingJurusan}
              className="w-full h-9 text-sm bg-slate-900 hover:bg-slate-800 text-white rounded-lg">
              {isSavingJurusan ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Menyimpan...</> : 'Simpan Perubahan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL EDIT JAM PELAJARAN ── */}
      <Dialog open={!!editingJamTA} onOpenChange={open => !open && setEditingJamTA(null)}>
        <DialogContent className="sm:max-w-2xl rounded-xl border-surface">
          <DialogHeader className="border-b border-surface-2 pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Jam Pelajaran per Hari — TA {editingJamTA?.nama}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-1">
            <div className="space-y-3 py-2 px-1">
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                Buat pola jam dan assign ke hari yang relevan. Satu pola bisa berlaku untuk beberapa hari sekaligus.
                Perubahan tidak merusak data jadwal yang sudah ada.
              </p>
              <PolaJamEditor value={editPolaJam} onChange={setEditPolaJam} />
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
