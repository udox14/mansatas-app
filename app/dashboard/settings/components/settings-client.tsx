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
import { CalendarDays, Loader2, PlusCircle, CheckCircle2, AlertCircle, Trash2, Power, X, Tags, Edit3 } from 'lucide-react'
import { tambahTahunAjaran, setAktifTahunAjaran, hapusTahunAjaran, simpanDaftarJurusan } from '../actions'

type TAProps = { id: string; nama: string; semester: number; is_active: boolean; daftar_jurusan?: string[] }
const initialState = { error: null as string | null, success: null as string | null }
const defaultJurusan = ['MIPA', 'SOSHUM', 'KEAGAMAAN', 'UMUM']

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
      isUmum ? 'bg-surface-3 text-slate-500 border-surface' : 'bg-surface text-blue-700 border-blue-200'
    }`}>
      {label}
      {!isUmum && onRemove && (
        <button type="button" onClick={onRemove} className="text-slate-300 hover:text-rose-500 transition-colors">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
}

export function SettingsClient({ taData }: { taData: TAProps[] }) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [state, formAction] = useActionState(tambahTahunAjaran, initialState)

  const [tambahJurusanList, setTambahJurusanList] = useState<string[]>(defaultJurusan)
  const [tambahJurusanInput, setTambahJurusanInput] = useState('')

  const [editingTA, setEditingTA] = useState<TAProps | null>(null)
  const [editJurusanList, setEditJurusanList] = useState<string[]>([])
  const [editJurusanInput, setEditJurusanInput] = useState('')
  const [isSavingJurusan, setIsSavingJurusan] = useState(false)

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
    if (!editingTA) return
    setIsSavingJurusan(true)
    const res = await simpanDaftarJurusan(editingTA.id, editJurusanList)
    if (res.error) alert(res.error)
    else { alert(res.success); setEditingTA(null) }
    setIsSavingJurusan(false)
  }

  useEffect(() => {
    if (state?.success) {
      const t = setTimeout(() => { setIsAddOpen(false); setTambahJurusanList(defaultJurusan) }, 1500)
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
    if (!confirm('Yakin ingin menghapus Tahun Ajaran ini?')) return
    setIsPending(true)
    const res = await hapusTahunAjaran(id, isActive)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

  return (
    <div className="space-y-4">

      {/* KARTU TAHUN AJARAN */}
      <div className="rounded-xl border border-surface bg-surface shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-2">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-surface-3 border border-surface">
              <CalendarDays className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Manajemen Tahun Ajaran & Jurusan</p>
              <p className="text-xs text-slate-400 mt-0.5">Kelola periode aktif dan daftar jurusan tiap periode</p>
            </div>
          </div>

          {/* Dialog tambah */}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg">
                <PlusCircle className="h-3.5 w-3.5" /> Tambah Periode
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-xl border-surface">
              <DialogHeader className="border-b border-surface-2 pb-3">
                <DialogTitle className="text-sm font-semibold text-slate-800">Setup Tahun Ajaran & Jurusan</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-1 py-1">
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
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">Nama periode</Label>
                    <Input name="nama" required placeholder="Contoh: 2025/2026" className="h-9 rounded-lg bg-surface-2 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">Semester</Label>
                    <Select name="semester" defaultValue="1">
                      <SelectTrigger className="h-9 rounded-lg bg-surface-2 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1" className="text-sm">Ganjil (1)</SelectItem>
                        <SelectItem value="2" className="text-sm">Genap (2)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Jurusan */}
                  <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Tags className="h-3.5 w-3.5 text-blue-600" />
                      <p className="text-xs font-semibold text-blue-800">Daftar jurusan</p>
                    </div>
                    <p className="text-[10px] text-blue-600 leading-relaxed -mt-1">
                      Jurusan yang dibuka pada tahun ajaran ini. Dipakai saat pembuatan kelas dan plotting.
                    </p>
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

                  <SubmitBtn />
                </form>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>

        {/* List TA */}
        {taData.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">Belum ada data Tahun Ajaran.</div>
        ) : taData.map(ta => (
          <div key={ta.id} className={`flex flex-col xl:flex-row xl:items-center justify-between p-4 border-b border-surface-2 last:border-0 gap-4 transition-colors ${ta.is_active ? 'bg-emerald-50/40' : 'hover:bg-surface-2/50'}`}>

            {/* Info */}
            <div className="flex items-start gap-3">
              <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                ta.is_active ? 'bg-emerald-500 text-white border-emerald-300' : 'bg-surface-3 text-slate-400 border-surface'
              }`}>
                {ta.semester}
              </div>
              <div>
                <p className={`text-sm font-semibold ${ta.is_active ? 'text-emerald-900' : 'text-slate-800'}`}>{ta.nama}</p>
                <p className="text-xs text-slate-400">Semester {ta.semester === 1 ? 'Ganjil' : 'Genap'}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {ta.daftar_jurusan?.map(j => (
                    <span key={j} className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                      ta.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-surface-3 text-slate-500 border-surface'
                    }`}>{j}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Aksi */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setEditingTA(ta); setEditJurusanList(ta.daftar_jurusan || defaultJurusan) }}
                className="h-8 text-xs gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg">
                <Edit3 className="h-3.5 w-3.5" /> Edit Jurusan
              </Button>

              {ta.is_active ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Aktif saat ini
                </span>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleSetAktif(ta.id)} disabled={isPending}
                    className="h-8 text-xs gap-1.5 border-surface text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 rounded-lg">
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

      {/* MODAL EDIT JURUSAN */}
      <Dialog open={!!editingTA} onOpenChange={open => !open && setEditingTA(null)}>
        <DialogContent className="sm:max-w-sm rounded-xl border-surface">
          <DialogHeader className="border-b border-surface-2 pb-3">
            <DialogTitle className="text-sm font-semibold text-slate-800">
              Edit Jurusan — TA {editingTA?.nama}
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

    </div>
  )
}
