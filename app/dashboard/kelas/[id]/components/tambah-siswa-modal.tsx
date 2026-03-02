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
  const [selectedSiswaId, setSelectedSiswaId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      getSiswaTanpaKelas().then((data) => {
        setSiswaList(data)
        setIsLoading(false)
      })
    } else {
      setSelectedSiswaId('')
      setMessage(null)
    }
  }, [isOpen])

  const handleSubmit = async () => {
    if (!selectedSiswaId) return
    
    setIsSubmitting(true)
    setMessage(null)

    const result = await assignSiswaKeKelas(selectedSiswaId, kelasId)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      setIsSubmitting(false)
    } else {
      setMessage({ type: 'success', text: result.success || 'Berhasil!' })
      setTimeout(() => {
        setIsSubmitting(false)
        setIsOpen(false)
      }, 1500)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
          <UserPlus className="h-4 w-4" />
          Tambah Siswa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            Masukkan Siswa ke Kelas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {message && (
            <div className={`p-3 text-sm rounded-md flex items-center gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
              {message.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {message.text}
            </div>
          )}

          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700 border border-blue-100">
            Fitur ini akan mengambil daftar siswa aktif yang <strong>belum memiliki kelas</strong>. Jika ingin memindahkan siswa dari kelas lain, silakan gunakan tombol <strong>Mutasi</strong> di tabel.
          </div>

          <div className="space-y-2">
            <Label>Pilih Siswa</Label>
            {isLoading ? (
              <div className="h-10 border rounded-md flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat data siswa...
              </div>
            ) : (
              <Select value={selectedSiswaId} onValueChange={setSelectedSiswaId}>
                <SelectTrigger>
                  <SelectValue placeholder="-- Cari & Pilih Siswa --" />
                </SelectTrigger>
                <SelectContent>
                  {siswaList.length === 0 ? (
                    <SelectItem value="empty" disabled>Semua siswa sudah memiliki kelas</SelectItem>
                  ) : (
                    siswaList.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nama_lengkap} (NISN: {s.nisn})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={!selectedSiswaId || isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 mt-4"
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</>
            ) : (
              'Masukkan ke Kelas'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}