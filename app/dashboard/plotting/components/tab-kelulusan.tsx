// BUAT FILE BARU
// Lokasi: app/dashboard/plotting/components/tab-kelulusan.tsx
'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, GraduationCap, AlertCircle, CheckCircle2 } from 'lucide-react'
import { prosesKelulusanMassal } from '../actions'

type SiswaType = { id: string, nama_lengkap: string, nisn: string, jenis_kelamin: string, kelas_lama: string, kelompok: string }

export function TabKelulusan({ siswaList }: { siswaList: SiswaType[] }) {
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const handleToggleSiswa = (id: string) => {
    setSelectedSiswaIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const handleSelectAll = () => {
    if (selectedSiswaIds.length === siswaList.length) setSelectedSiswaIds([])
    else setSelectedSiswaIds(siswaList.map(s => s.id))
  }

  const handleLuluskan = async () => {
    if (selectedSiswaIds.length === 0) return
    
    if (!confirm(`TINDAKAN PERMANEN!\n\nAnda yakin ingin meluluskan ${selectedSiswaIds.length} siswa ini? Status mereka akan berubah menjadi 'Lulus' dan mereka akan dikeluarkan dari kelas saat ini.`)) {
      return
    }

    setIsSubmitting(true)
    const res = await prosesKelulusanMassal(selectedSiswaIds)
    
    if (res.error) {
      alert(res.error)
    } else {
      setSuccessMsg(res.success!)
      setSelectedSiswaIds([])
    }
    setIsSubmitting(false)
  }

  if (siswaList.length === 0 && !successMsg) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-rose-50 rounded-xl border border-rose-100">
        <CheckCircle2 className="h-12 w-12 text-rose-400 mb-4" />
        <h3 className="text-lg font-bold text-rose-900">Tidak ada data kelas 12!</h3>
        <p className="text-rose-700 mt-2">Semua siswa kelas 12 mungkin sudah diluluskan atau datanya belum ada.</p>
      </div>
    )
  }

  if (successMsg) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-emerald-50 rounded-xl border border-emerald-100 animate-in zoom-in duration-500">
        <GraduationCap className="h-20 w-20 text-emerald-500 mb-4" />
        <h2 className="text-2xl font-bold text-emerald-900">Selamat! Proses Kelulusan Selesai.</h2>
        <p className="text-emerald-700 mt-2">{successMsg}</p>
        <p className="text-sm text-emerald-600 mt-4 font-medium">Wadah Kelas 12 kini sudah kosong dan siap diisi oleh siswa kelas 11 yang naik kelas.</p>
        <Button onClick={() => setSuccessMsg('')} variant="outline" className="mt-6 border-emerald-200 text-emerald-700 hover:bg-emerald-100">
          Tutup
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* PANEL KIRI: INFO & PERINGATAN */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-rose-100 p-2 rounded-lg text-rose-600">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">Kelulusan Kelas 12</h3>
          </div>
          
          <p className="text-sm text-slate-600 mb-4 leading-relaxed">
            Sistem mendeteksi ada <strong className="text-rose-600">{siswaList.length}</strong> siswa kelas 12 yang berstatus aktif. 
            Proses ini akan mengubah status mereka menjadi <strong className="text-slate-800">Lulus</strong> dan membersihkan mereka dari tabel kelas saat ini.
          </p>

          <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg mb-6">
            <div className="flex items-start gap-2 text-orange-800">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold mb-1">Perhatian!</p>
                <p>Lakukan proses ini <strong>sebelum</strong> Anda menaikkan anak kelas 11 ke kelas 12 (Pengacakan), agar wadah kelas 12 kosong terlebih dahulu.</p>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleLuluskan} 
            disabled={isSubmitting || selectedSiswaIds.length === 0}
            className="w-full py-6 text-base gap-2 bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-200"
          >
            {isSubmitting ? (
              <><Loader2 className="animate-spin h-5 w-5" /> Memproses...</>
            ) : (
              <><GraduationCap className="h-5 w-5" /> Luluskan {selectedSiswaIds.length} Siswa Terpilih</>
            )}
          </Button>
        </div>
      </div>

      {/* PANEL KANAN: DAFTAR KANDIDAT LULUS */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800">Daftar Kandidat Lulus</h3>
              <p className="text-xs text-slate-500">Pilih semua siswa yang memenuhi syarat kelulusan.</p>
            </div>
            <div className="text-sm font-semibold text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
              {selectedSiswaIds.length} Dipilih
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[50px] text-center">
                    <Checkbox 
                      checked={selectedSiswaIds.length === siswaList.length && siswaList.length > 0} 
                      onCheckedChange={handleSelectAll} 
                    />
                  </TableHead>
                  <TableHead>NISN / Nama Siswa</TableHead>
                  <TableHead className="text-center">L/P</TableHead>
                  <TableHead className="text-right">Kelas Akhir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {siswaList.map((siswa) => (
                  <TableRow key={siswa.id} className={selectedSiswaIds.includes(siswa.id) ? 'bg-rose-50/30' : ''}>
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={selectedSiswaIds.includes(siswa.id)} 
                        onCheckedChange={() => handleToggleSiswa(siswa.id)} 
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">{siswa.nama_lengkap}</div>
                      <div className="text-xs text-slate-500">{siswa.nisn}</div>
                    </TableCell>
                    <TableCell className="text-center font-medium text-slate-600">{siswa.jenis_kelamin}</TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        {siswa.kelas_lama}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}