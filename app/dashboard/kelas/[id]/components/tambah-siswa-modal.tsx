'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react'
import { getSiswaTanpaKelas, assignSiswaKeKelas } from '../../actions'

type SiswaTanpaKelasType = { id: string; nama_lengkap: string; nisn: string }

export function TambahSiswaModal({ kelasId }: { kelasId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [siswaList, setSiswaList] = useState<SiswaTanpaKelasType[]>([])
  const [selectedSiswaId, setSelectedSiswaId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      getSiswaTanpaKelas().then(data => { setSiswaList(data); setIsLoading(false) })
    } else { setSelectedSiswaId(''); setMessage(null) }
  }, [isOpen])

  const handleSubmit = async () => {
    if (!selectedSiswaId) return
    setIsSubmitting(true); setMessage(null)
    const result = await assignSiswaKeKelas(selectedSiswaId, kelasId)
    if (result.error) { setMessage({ type: 'error', text: result.error }); setIsSubmitting(false) }
    else { setMessage({ type: 'success', text: result.success || 'Berhasil!' }); setTimeout(() => { setIsSubmitting(false); setIsOpen(false) }, 1500) }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white gap-1.5 ml-auto">
          <UserPlus className="h-3.5 w-3.5" /> Tambah Siswa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-blue-600" /> Masukkan Siswa ke Kelas
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {message && (
            <div className={`p-2.5 text-xs rounded-lg flex items-center gap-2 ${message.type === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'}`}>
              {message.type === 'error' ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {message.text}
            </div>
          )}
          <div className="bg-blue-50 p-2.5 rounded-lg text-xs text-blue-700 border border-blue-100">
            Hanya menampilkan siswa aktif yang <strong>belum memiliki kelas</strong>. Untuk memindah dari kelas lain, gunakan tombol <strong>Mutasi</strong>.
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Pilih Siswa</Label>
            {isLoading ? (
              <div className="h-9 border rounded-lg flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-xs text-slate-400 dark:text-slate-500"><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Memuat siswa...</div>
            ) : (
              <Select value={selectedSiswaId} onValueChange={setSelectedSiswaId}>
                <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue placeholder="-- Cari & Pilih Siswa --" /></SelectTrigger>
                <SelectContent>
                  {siswaList.length === 0 ? <SelectItem value="empty" disabled>Semua siswa sudah memiliki kelas</SelectItem>
                    : siswaList.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.nama_lengkap} (NISN: {s.nisn})</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <Button onClick={handleSubmit} disabled={!selectedSiswaId || isSubmitting} className="w-full h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
            {isSubmitting ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Menyimpan...</> : 'Masukkan ke Kelas'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}