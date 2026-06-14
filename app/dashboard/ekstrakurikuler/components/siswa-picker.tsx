'use client'

import { useEffect, useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, AlertCircle, CheckCircle2, UserPlus } from 'lucide-react'
import { getSiswaUntukPilih, addAnggota } from '../actions'
import type { SiswaPilih, KelasOption } from '../actions'

const ALL_KELAS = '__all__'

export function SiswaPicker({ ekskulId, kelasList, onClose }: {
  ekskulId: string
  kelasList: KelasOption[]
  onClose: (added?: boolean) => void
}) {
  const [kelasId, setKelasId] = useState<string>(ALL_KELAS)
  const [q, setQ] = useState('')
  const [list, setList] = useState<SiswaPilih[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)

  // Debounced load on filter change
  useEffect(() => {
    let active = true
    setLoading(true)
    const t = setTimeout(async () => {
      const data = await getSiswaUntukPilih(ekskulId, kelasId === ALL_KELAS ? undefined : kelasId, q)
      if (!active) return
      setList(data)
      setLoading(false)
    }, 250)
    return () => { active = false; clearTimeout(t) }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [ekskulId, kelasId, q])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleAdd = () => {
    if (selected.size === 0) { setMsg({ tipe: 'error', teks: 'Pilih minimal satu siswa.' }); return }
    setMsg(null)
    startTransition(async () => {
      const res = await addAnggota(ekskulId, [...selected])
      if (res.error) { setMsg({ tipe: 'error', teks: res.error }); return }
      setMsg({ tipe: 'sukses', teks: res.success || 'Berhasil.' })
      setTimeout(() => onClose(true), 800)
    })
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-slate-600 dark:text-slate-400" /> Tambah Anggota
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {msg && (
            <div className={`p-2.5 text-xs rounded-lg border flex gap-2 ${msg.tipe === 'sukses' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100'}`}>
              {msg.tipe === 'sukses' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
              {msg.teks}
            </div>
          )}

          <div className="flex gap-2">
            <Select value={kelasId} onValueChange={setKelasId}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_KELAS} className="text-xs">Semua Kelas</SelectItem>
                {kelasList.map(k => <SelectItem key={k.id} value={k.id} className="text-xs">{k.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama / NISN..."
              className="h-8 text-sm flex-1 bg-slate-50 dark:bg-slate-800" />
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">{selected.size} dipilih</p>

          <div className="max-h-72 overflow-y-auto rounded-lg border divide-y dark:divide-slate-800">
            {loading ? (
              <p className="text-center py-8"><Loader2 className="h-5 w-5 mx-auto animate-spin text-slate-400" /></p>
            ) : list.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Tidak ada siswa.</p>
            ) : list.map(s => (
              <label key={s.siswa_id}
                className={`flex items-center gap-3 px-3 py-2 ${s.sudah_anggota ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <Checkbox
                  checked={s.sudah_anggota || selected.has(s.siswa_id)}
                  disabled={s.sudah_anggota}
                  onCheckedChange={() => !s.sudah_anggota && toggle(s.siswa_id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{s.nama_lengkap}</p>
                  <p className="text-[11px] text-slate-400">{s.nisn} · {s.kelas_label}</p>
                </div>
                {s.sudah_anggota && <span className="text-[10px] text-emerald-600">sudah anggota</span>}
              </label>
            ))}
          </div>

          <Button onClick={handleAdd} disabled={pending || selected.size === 0} className="w-full h-9 text-sm">
            {pending ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Menyimpan...</> : `Tambahkan ${selected.size > 0 ? `(${selected.size})` : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
