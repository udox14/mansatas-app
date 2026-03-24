// Lokasi: app/dashboard/siswa/[id]/components/tandai-keluar-modal.tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, Loader2, LogOut } from 'lucide-react'
import { tandaiSiswaKeluar, batalkanKeluarSiswa } from '../../actions'

const ALASAN_OPTIONS = [
  'Pindah Sekolah',
  'Mengundurkan Diri',
  'Dikeluarkan',
  'Meninggal Dunia',
  'Lainnya',
]

// ── Modal Tandai Keluar ────────────────────────────────────────────────
export function TandaiKeluarModal({
  siswaId, namaSiswa, onSuccess, onClose,
}: {
  siswaId: string
  namaSiswa: string
  onSuccess: () => void
  onClose: () => void
}) {
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0])
  const [alasan, setAlasan] = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSimpan = async () => {
    if (!tanggal) { alert('Tanggal keluar wajib diisi.'); return }
    if (!alasan) { alert('Alasan keluar wajib dipilih.'); return }
    if (!confirm(`Tandai ${namaSiswa} sebagai siswa KELUAR?\n\nSiswa akan dikeluarkan dari kelas dan tidak muncul di data aktif.`)) return

    setIsSaving(true)
    const res = await tandaiSiswaKeluar({
      siswa_id: siswaId,
      tanggal_keluar: tanggal,
      alasan_keluar: alasan,
      keterangan_keluar: keterangan,
    })
    setIsSaving(false)
    if (res.error) { alert(res.error); return }
    onSuccess()
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader className="border-b border-surface-2 pb-3">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2 text-rose-600">
            <LogOut className="h-4 w-4" /> Tandai Siswa Keluar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{namaSiswa}</p>
              <p className="mt-0.5 opacity-80">Siswa akan dilepas dari kelas dan statusnya berubah menjadi <strong>KELUAR</strong>. Data tetap tersimpan di database.</p>
            </div>
          </div>

          {/* Tanggal */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Tanggal Keluar <span className="text-rose-500">*</span>
            </label>
            <Input
              type="date"
              value={tanggal}
              onChange={e => setTanggal(e.target.value)}
              className="h-9 text-sm rounded-lg border-surface"
            />
          </div>

          {/* Alasan */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Alasan Keluar <span className="text-rose-500">*</span>
            </label>
            <Select value={alasan} onValueChange={setAlasan}>
              <SelectTrigger className="h-9 text-sm rounded-lg border-surface bg-surface-2">
                <SelectValue placeholder="Pilih alasan..." />
              </SelectTrigger>
              <SelectContent>
                {ALASAN_OPTIONS.map(a => (
                  <SelectItem key={a} value={a} className="text-sm">{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Keterangan */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Keterangan <span className="text-slate-400 dark:text-slate-500 font-normal">(opsional)</span>
            </label>
            <textarea
              value={keterangan}
              onChange={e => setKeterangan(e.target.value)}
              rows={3}
              placeholder="Informasi tambahan..."
              className="w-full rounded-lg border border-surface bg-surface-2 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm rounded-lg">
              Batal
            </Button>
            <Button
              onClick={handleSimpan}
              disabled={isSaving || !alasan || !tanggal}
              className="flex-1 h-9 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isSaving
                ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Menyimpan...</>
                : <><LogOut className="mr-2 h-3.5 w-3.5" />Tandai Keluar</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal Batalkan Keluar ──────────────────────────────────────────────
export function BatalkanKeluarModal({
  siswaId, namaSiswa, onSuccess, onClose,
}: {
  siswaId: string
  namaSiswa: string
  onSuccess: () => void
  onClose: () => void
}) {
  const [isSaving, setIsSaving] = useState(false)

  const handleBatalkan = async () => {
    if (!confirm(`Batalkan status keluar ${namaSiswa}?\nSiswa akan kembali aktif tapi perlu di-assign ke kelas secara manual.`)) return
    setIsSaving(true)
    const res = await batalkanKeluarSiswa(siswaId)
    setIsSaving(false)
    if (res.error) { alert(res.error); return }
    onSuccess()
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-sm rounded-xl">
        <DialogHeader className="border-b border-surface-2 pb-3">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Batalkan Status Keluar
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Batalkan status keluar <strong>{namaSiswa}</strong>? Siswa akan kembali berstatus <strong className="text-emerald-600">Aktif</strong> tanpa kelas — perlu di-assign ke kelas secara manual.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm rounded-lg">Batal</Button>
            <Button onClick={handleBatalkan} disabled={isSaving}
              className="flex-1 h-9 text-sm rounded-lg bg-amber-500 hover:bg-amber-600 text-white">
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Ya, Batalkan Keluar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
