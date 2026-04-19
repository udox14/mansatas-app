'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { createDspt } from '../../actions'

export function TambahDsptModal({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [nisn, setNisn] = useState('')
  const [nominal, setNominal] = useState('')
  const [catatan, setCatatan] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nisn.trim() || !nominal) { setError('NISN dan nominal wajib diisi'); return }
    startTransition(async () => {
      // Note: createDspt needs siswaId, not NISN. In practice,
      // this modal would include a combobox search by name/NISN.
      // For now we pass nisn as placeholder — implement siswa picker as needed.
      const res = await createDspt(nisn, parseInt(nominal.replace(/\D/g, '')), catatan)
      if (res.error) { setError(res.error); return }
      setOpen(false); setNisn(''); setNominal(''); setCatatan('')
      onSuccess()
    })
  }

  return (
    <>
      <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Input Manual
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-xl p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 dark:border-slate-700">
            <DialogTitle className="text-sm font-semibold">Input Tagihan DSPT</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cari Siswa (NISN / Nama)</Label>
              <Input
                placeholder="Ketik NISN atau nama siswa..."
                value={nisn}
                onChange={e => setNisn(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nominal Target DSPT</Label>
              <Input
                placeholder="Contoh: 5000000"
                value={nominal}
                onChange={e => setNominal(e.target.value)}
                className="h-9 text-sm"
                type="number"
                min={0}
              />
              <p className="text-[11px] text-slate-400">Sesuai kesepakatan saat pendaftaran</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Catatan (opsional)</Label>
              <Input
                placeholder="Misalnya: anak guru, beasiswa, dll"
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            {error && <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 rounded-md">{error}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-sm" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" size="sm" className="flex-1 h-9 text-sm" disabled={isPending}>
                {isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
