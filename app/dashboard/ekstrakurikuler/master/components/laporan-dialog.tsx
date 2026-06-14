'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Printer, Loader2, AlertCircle } from 'lucide-react'
import { openPdfFromUrl } from '@/lib/pdf/download'

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function LaporanDialog({ ekskulId, ekskulNama, onClose }: {
  ekskulId: string
  ekskulNama: string
  onClose: () => void
}) {
  const [bulan, setBulan] = useState(currentMonth())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCetak = async () => {
    setLoading(true); setError(null)
    try {
      const url = `/api/pdf/ekskul-kehadiran?ekskulId=${encodeURIComponent(ekskulId)}&bulan=${encodeURIComponent(bulan)}`
      const fname = `Kehadiran_${ekskulNama.replace(/[^a-zA-Z0-9-_]+/g, '_')}_${bulan}.pdf`
      await openPdfFromUrl(url, fname)
    } catch (e: any) {
      setError(e?.message || 'Gagal membuat PDF.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-sm rounded-xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Printer className="h-4 w-4 text-slate-600 dark:text-slate-400" /> Cetak Kehadiran
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">{ekskulNama}</p>

          {error && (
            <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-100 flex gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Pilih Bulan</Label>
            <Input type="month" value={bulan} onChange={e => setBulan(e.target.value)} className="h-9 text-sm" />
          </div>

          <Button onClick={handleCetak} disabled={loading} className="w-full h-10">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyiapkan PDF...</> : <><Printer className="h-4 w-4 mr-2" />Cetak Laporan</>}
          </Button>
          <p className="text-[11px] text-slate-400 text-center">PDF berisi rekap H/S/I/A tiap siswa per pertemuan.</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
