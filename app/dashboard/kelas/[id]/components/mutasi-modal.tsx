// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kelas/[id]/components/mutasi-modal.tsx
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeftRight, AlertCircle, CheckCircle2 } from 'lucide-react'
// Import dari actions.ts yang sudah kita perbarui di atas
import { getKelasTujuanMutasi, getSiswaUntukBarter, prosesMutasi } from '../../actions'

type MutasiModalProps = {
  isOpen: boolean
  onClose: () => void
  siswa: { id: string; nama_lengkap: string; nisn: string } | null
  currentKelasId: string
  tingkat: number
}

type KelasTujuanType = { id: string; nama: string; kapasitas: number; jumlah_siswa: number }
type SiswaBarterType = { id: string; nama_lengkap: string; nisn: string }

export function MutasiModal({ isOpen, onClose, siswa, currentKelasId, tingkat }: MutasiModalProps) {
  const [kelasTujuanList, setKelasTujuanList] = useState<KelasTujuanType[]>([])
  const [selectedKelasId, setSelectedKelasId] = useState<string>('')
  const [isKelasLoading, setIsKelasLoading] = useState(false)

  const [siswaBarterList, setSiswaBarterList] = useState<SiswaBarterType[]>([])
  const [selectedSiswaBarterId, setSelectedSiswaBarterId] = useState<string>('')
  const [isSiswaLoading, setIsSiswaLoading] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (isOpen && currentKelasId) {
      setIsKelasLoading(true)
      getKelasTujuanMutasi(tingkat, currentKelasId).then((data: KelasTujuanType[]) => {
        setKelasTujuanList(data)
        setIsKelasLoading(false)
      })
    } else {
      setSelectedKelasId('')
      setSelectedSiswaBarterId('')
      setSiswaBarterList([])
      setMessage(null)
    }
  }, [isOpen, currentKelasId, tingkat])

  const selectedKelas = kelasTujuanList.find(k => k.id === selectedKelasId)
  const isTargetFull = selectedKelas ? selectedKelas.jumlah_siswa >= selectedKelas.kapasitas : false

  useEffect(() => {
    if (selectedKelasId && isTargetFull) {
      setIsSiswaLoading(true)
      setSelectedSiswaBarterId('')
      getSiswaUntukBarter(selectedKelasId).then((data: SiswaBarterType[]) => {
        setSiswaBarterList(data)
        setIsSiswaLoading(false)
      })
    } else {
      setSiswaBarterList([])
      setSelectedSiswaBarterId('')
    }
  }, [selectedKelasId, isTargetFull])

  const handleSubmit = async () => {
    if (!selectedKelasId) return
    if (isTargetFull && !selectedSiswaBarterId) {
      setMessage({ type: 'error', text: 'Kelas tujuan penuh! Anda wajib memilih siswa untuk ditukar (barter).' })
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    const result = await prosesMutasi({
      siswaIdLama: siswa!.id,
      kelasIdLama: currentKelasId,
      kelasIdTujuan: selectedKelasId,
      siswaIdBarter: isTargetFull ? selectedSiswaBarterId : null
    })

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      setIsSubmitting(false)
    } else {
      setMessage({ type: 'success', text: result.success || 'Berhasil!' })
      setTimeout(() => {
        setIsSubmitting(false)
        onClose()
      }, 1500)
    }
  }

  if (!siswa) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-blue-600" />
            Mutasi & Barter Siswa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {message && (
            <div className={`p-3 text-sm rounded-md flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
              {message.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {message.text}
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Siswa yang akan dipindah</p>
            <p className="text-lg font-bold text-slate-900">{siswa.nama_lengkap}</p>
            <p className="text-sm text-slate-600">NISN: {siswa.nisn}</p>
          </div>

          <div className="space-y-3">
            <Label>Pilih Kelas Tujuan (Tingkat {tingkat})</Label>
            {isKelasLoading ? (
              <div className="h-10 border rounded-md flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat daftar kelas...
              </div>
            ) : (
              <Select value={selectedKelasId} onValueChange={setSelectedKelasId}>
                <SelectTrigger>
                  <SelectValue placeholder="-- Pilih Kelas --" />
                </SelectTrigger>
                <SelectContent>
                  {kelasTujuanList.length === 0 ? (
                    <SelectItem value="empty" disabled>Tidak ada kelas lain di tingkat ini</SelectItem>
                  ) : (
                    kelasTujuanList.map(k => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.nama} - ({k.jumlah_siswa}/{k.kapasitas} Siswa)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedKelasId && isTargetFull && (
            <div className="space-y-3 p-4 bg-orange-50 border border-orange-200 rounded-lg animate-in fade-in slide-in-from-top-2">
              <div className="flex gap-2 text-orange-800">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div className="text-sm">
                  <p className="font-bold">Kelas tujuan sudah penuh!</p>
                  <p>Sistem mewajibkan Barter. Pilih satu siswa dari kelas tersebut untuk dipindahkan sebagai ganti {siswa.nama_lengkap}.</p>
                </div>
              </div>
              
              <div className="mt-3">
                <Label className="text-orange-900">Pilih Siswa untuk Ditukar</Label>
                {isSiswaLoading ? (
                  <div className="mt-1 h-10 border border-orange-200 rounded-md flex items-center justify-center bg-white text-orange-500 text-sm">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat data siswa...
                  </div>
                ) : (
                  <Select value={selectedSiswaBarterId} onValueChange={setSelectedSiswaBarterId}>
                    <SelectTrigger className="mt-1 bg-white border-orange-200">
                      <SelectValue placeholder="-- Pilih Siswa Pengganti --" />
                    </SelectTrigger>
                    <SelectContent>
                      {siswaBarterList.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nama_lengkap} (NISN: {s.nisn})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          <Button 
            onClick={handleSubmit} 
            disabled={!selectedKelasId || isSubmitting || (isTargetFull && !selectedSiswaBarterId)}
            className="w-full bg-blue-600 hover:bg-blue-700 mt-4"
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses Transaksi...</>
            ) : isTargetFull ? (
              'Lakukan Barter Siswa'
            ) : (
              'Pindahkan Siswa'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}