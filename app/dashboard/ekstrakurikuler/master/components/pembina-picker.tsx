'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, AlertCircle, CheckCircle2, Users } from 'lucide-react'
import { getRoleLabel } from '@/config/menu'
import { setPembina } from '../actions'
import type { EkskulMaster, GuruOption } from '../actions'

export function PembinaPicker({ ekskul, guruList, onClose }: {
  ekskul: EkskulMaster
  guruList: GuruOption[]
  onClose: (refreshed?: boolean) => void
}) {
  const initial = useMemo(
    () => new Set((ekskul.pembina_ids || '').split(',').filter(Boolean)),
    [ekskul.pembina_ids]
  )
  const [selected, setSelected] = useState<Set<string>>(initial)
  const [q, setQ] = useState('')
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)

  useEffect(() => { setSelected(initial) }, [initial])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return guruList
    return guruList.filter(g => g.nama_lengkap.toLowerCase().includes(term))
  }, [q, guruList])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleSave = () => {
    setMsg(null)
    startTransition(async () => {
      const res = await setPembina(ekskul.id, [...selected])
      if (res.error) { setMsg({ tipe: 'error', teks: res.error }); return }
      setMsg({ tipe: 'sukses', teks: res.success || 'Tersimpan.' })
      setTimeout(() => onClose(true), 900)
    })
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            Pembina — {ekskul.nama}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {msg && (
            <div className={`p-2.5 text-xs rounded-lg border flex gap-2 ${msg.tipe === 'sukses' ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100'}`}>
              {msg.tipe === 'sukses' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
              {msg.teks}
            </div>
          )}

          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Cari nama guru..."
            className="h-8 text-sm rounded-md bg-slate-50 dark:bg-slate-800"
          />

          <p className="text-xs text-slate-500 dark:text-slate-400">{selected.size} pembina dipilih</p>

          <div className="max-h-72 overflow-y-auto rounded-lg border divide-y dark:divide-slate-800">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Tidak ada guru ditemukan.</p>
            ) : filtered.map(g => (
              <label key={g.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <Checkbox checked={selected.has(g.id)} onCheckedChange={() => toggle(g.id)} />
                <div className="min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{g.nama_lengkap}</p>
                  <p className="text-[11px] text-slate-400">{getRoleLabel(g.role)}</p>
                </div>
              </label>
            ))}
          </div>

          <Button onClick={handleSave} disabled={pending} className="w-full h-9 text-sm">
            {pending ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Menyimpan...</> : 'Simpan Pembina'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
