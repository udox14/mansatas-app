'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeftRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { getKelasTujuanMutasi, getSiswaUntukBarter, prosesMutasi } from '../../actions'

type MutasiModalProps = { isOpen: boolean; onClose: () => void; siswa: { id: string; nama_lengkap: string; nisn: string } | null; currentKelasId: string; tingkat: number }
type KelasTujuanType = { id: string; nama: string; kapasitas: number; jumlah_siswa: number }
type SiswaBarterType = { id: string; nama_lengkap: string; nisn: string }

export function MutasiModal({ isOpen, onClose, siswa, currentKelasId, tingkat }: MutasiModalProps) {
  const [kelasTujuanList, setKelasTujuanList] = useState<KelasTujuanType[]>([])
  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [isKelasLoading, setIsKelasLoading] = useState(false)
  const [siswaBarterList, setSiswaBarterList] = useState<SiswaBarterType[]>([])
  const [selectedSiswaBarterId, setSelectedSiswaBarterId] = useState('')
  const [isSiswaLoading, setIsSiswaLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (isOpen && currentKelasId) {
      setIsKelasLoading(true)
      getKelasTujuanMutasi(tingkat, currentKelasId).then((data: KelasTujuanType[]) => {
        setKelasTujuanList(data); setIsKelasLoading(false)
      })
    } else {
      setSelectedKelasId(''); setSelectedSiswaBarterId(''); setSiswaBarterList([]); setMessage(null)
    }
  }, [isOpen, currentKelasId, tingkat])

  const selectedKelas = kelasTujuanList.find(k => k.id === selectedKelasId)
  const isTargetFull = selectedKelas ? selectedKelas.jumlah_siswa >= selectedKelas.kapasitas : false

  useEffect(() => {
    if (selectedKelasId && isTargetFull) {
      setIsSiswaLoading(true); setSelectedSiswaBarterId('')
      getSiswaUntukBarter(selectedKelasId).then((data: SiswaBarterType[]) => {
        setSiswaBarterList(data); setIsSiswaLoading(false)
      })
    } else { setSiswaBarterList([]); setSelectedSiswaBarterId('') }
  }, [selectedKelasId, isTargetFull])

  const handleSubmit = async () => {
    if (!selectedKelasId) return
    if (isTargetFull && !selectedSiswaBarterId) { setMessage({ type: 'error', text: 'Kelas penuh! Pilih siswa untuk ditukar (barter).' }); return }
    setIsSubmitting(true); setMessage(null)
    const result = await prosesMutasi({ siswaIdLama: siswa!.id, kelasIdLama: currentKelasId, kelasIdTujuan: selectedKelasId, siswaIdBarter: isTargetFull ? selectedSiswaBarterId : null })
    if (result.error) { setMessage({ type: 'error', text: result.error }); setIsSubmitting(false) }
    else { setMessage({ type: 'success', text: result.success || 'Berhasil!' }); setTimeout(() => { setIsSubmitting(false); onClose() }, 1500) }
  }

  if (!siswa) return null

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-blue-600" /> Mutasi & Barter Siswa
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {message && (
            <div className={`p-2.5 text-xs rounded-lg flex items-center gap-2 ${message.type === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {message.type === 'error' ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {message.text}
            </div>
          )}
          <div className="bg-surface-2 p-2.5 rounded-lg border border-surface-2">
            <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Siswa dipindah</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{siswa.nama_lengkap}</p>
            <p className="text-xs text-slate-500">NISN: {siswa.nisn}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">Kelas Tujuan (Tingkat {tingkat})</Label>
            {isKelasLoading ? (
              <div className="h-9 border rounded-lg flex items-center justify-center bg-surface-2 text-xs text-slate-400"><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Memuat kelas...</div>
            ) : (
              <Select value={selectedKelasId} onValueChange={setSelectedKelasId}>
                <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue placeholder="-- Pilih Kelas --" /></SelectTrigger>
                <SelectContent>
                  {kelasTujuanList.length === 0 ? <SelectItem value="empty" disabled>Tidak ada kelas lain</SelectItem>
                    : kelasTujuanList.map(k => <SelectItem key={k.id} value={k.id} className="text-xs">{k.nama} ({k.jumlah_siswa}/{k.kapasitas})</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          {selectedKelasId && isTargetFull && (
            <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex gap-2 text-amber-800 text-xs">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <p><strong>Kelas penuh!</strong> Pilih siswa pengganti (barter) dari kelas tersebut.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-amber-900">Siswa untuk Ditukar</Label>
                {isSiswaLoading ? (
                  <div className="h-9 border border-amber-200 rounded-lg flex items-center justify-center bg-surface text-xs text-amber-500"><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Memuat...</div>
                ) : (
                  <Select value={selectedSiswaBarterId} onValueChange={setSelectedSiswaBarterId}>
                    <SelectTrigger className="h-9 text-xs rounded-lg bg-surface border-amber-200"><SelectValue placeholder="-- Pilih Siswa --" /></SelectTrigger>
                    <SelectContent>
                      {siswaBarterList.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.nama_lengkap} (NISN: {s.nisn})</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}
          <Button onClick={handleSubmit} disabled={!selectedKelasId || isSubmitting || (isTargetFull && !selectedSiswaBarterId)} className="w-full h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
            {isSubmitting ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Memproses...</> : isTargetFull ? 'Lakukan Barter Siswa' : 'Pindahkan Siswa'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}