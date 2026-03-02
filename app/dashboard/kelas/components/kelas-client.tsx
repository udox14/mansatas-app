// TIMPA FILE INI
// Lokasi: app/dashboard/kelas/components/kelas-client.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Trash2, Users, ChevronRight } from 'lucide-react'
import { TambahModal } from './tambah-modal'
import { ImportModal } from './import-modal'
import { hapusKelas } from '../actions'

type KelasData = {
  id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
  kapasitas: number
  wali_kelas_nama: string
  jumlah_siswa: number
}

type GuruType = { id: string; nama_lengkap: string }

export function KelasClient({ initialData, daftarGuru }: { initialData: KelasData[], daftarGuru: GuruType[] }) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTingkat, setFilterTingkat] = useState('Semua')
  const [isPending, setIsPending] = useState(false)

  const filteredData = initialData.filter(k => {
    const matchTingkat = filterTingkat === 'Semua' || k.tingkat.toString() === filterTingkat
    // Tetap gunakan string gabungan untuk pencarian agar user tetap bisa mencari "MIPA"
    const namaKelasPencarian = `${k.tingkat} ${k.kelompok} ${k.nomor_kelas}`.toLowerCase()
    const matchSearch = namaKelasPencarian.includes(searchTerm.toLowerCase()) || 
           k.wali_kelas_nama.toLowerCase().includes(searchTerm.toLowerCase())
           
    return matchTingkat && matchSearch
  })

  const sortedData = [...filteredData].sort((a, b) => {
    // Natural sort menggunakan string gabungan
    const namaA = `${a.tingkat} ${a.kelompok} ${a.nomor_kelas}`
    const namaB = `${b.tingkat} ${b.kelompok} ${b.nomor_kelas}`
    return namaA.localeCompare(namaB, undefined, { numeric: true, sensitivity: 'base' })
  })

  const handleHapus = async (id: string, namaKelas: string, jumlahSiswa: number) => {
    if (jumlahSiswa > 0) {
      alert(`Peringatan: Tidak bisa menghapus kelas ${namaKelas} karena masih ada ${jumlahSiswa} siswa di dalamnya. Kosongkan kelas terlebih dahulu.`)
      return
    }

    if (!confirm(`Yakin ingin menghapus kelas ${namaKelas}?`)) return
    
    setIsPending(true)
    const res = await hapusKelas(id)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex w-full sm:w-auto items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Cari kelas atau wali..."
              className="pl-9 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Select value={filterTingkat} onValueChange={setFilterTingkat}>
            <SelectTrigger className="w-[140px] bg-white">
              <SelectValue placeholder="Semua Tingkat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Semua">Semua Tingkat</SelectItem>
              <SelectItem value="10">Kelas 10</SelectItem>
              <SelectItem value="11">Kelas 11</SelectItem>
              <SelectItem value="12">Kelas 12</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <ImportModal />
          <TambahModal daftarGuru={daftarGuru} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-lg text-blue-600"><Users className="h-6 w-6" /></div>
          <div><p className="text-sm text-slate-500">Total Kelas</p><h3 className="text-2xl font-bold">{sortedData.length}</h3></div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600"><Users className="h-6 w-6" /></div>
          <div><p className="text-sm text-slate-500">Kapasitas Tersedia</p><h3 className="text-2xl font-bold">{sortedData.reduce((acc, curr) => acc + (curr.kapasitas - curr.jumlah_siswa), 0)} <span className="text-sm font-normal text-slate-500">kursi</span></h3></div>
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-semibold text-slate-600">Nama Kelas</TableHead>
              <TableHead className="font-semibold text-slate-600">Wali Kelas</TableHead>
              <TableHead className="font-semibold text-slate-600 text-center">Keterisian</TableHead>
              <TableHead className="text-right font-semibold text-slate-600">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">Belum ada data kelas.</TableCell></TableRow>
            ) : (
              sortedData.map((k) => {
                // Format Singkat (Contoh: 10-1)
                const namaKelasSingkat = `${k.tingkat}-${k.nomor_kelas}`
                const namaUntukAlert = `${k.tingkat}-${k.nomor_kelas} ${k.kelompok !== 'UMUM' ? k.kelompok : ''}`.trim()
                
                const isFull = k.jumlah_siswa >= k.kapasitas
                const percentage = Math.round((k.jumlah_siswa / k.kapasitas) * 100)

                return (
                  <TableRow key={k.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell 
                      className="cursor-pointer group hover:bg-blue-50 transition-all duration-200 relative"
                      onClick={() => router.push(`/dashboard/kelas/${k.id}`)}
                      title={`Klik untuk melihat detail kelas ${namaKelasSingkat}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                            {namaKelasSingkat}
                          </span>
                          {/* Badge Kelompok (Hanya tampil jika bukan UMUM) */}
                          {k.kelompok !== 'UMUM' && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 border border-indigo-200 rounded-full">
                              {k.kelompok}
                            </span>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" />
                      </div>
                    </TableCell>
                    
                    <TableCell className="font-medium text-slate-700">{k.wali_kelas_nama}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isFull ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {k.jumlah_siswa} / {k.kapasitas} {isFull && '(Penuh)'}
                        </span>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${isFull ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" size="icon" 
                        onClick={() => handleHapus(k.id, namaUntukAlert, k.jumlah_siswa)}
                        disabled={isPending || k.jumlah_siswa > 0}
                        title={k.jumlah_siswa > 0 ? "Kosongkan kelas dulu untuk menghapus" : "Hapus Kelas"}
                        className={k.jumlah_siswa > 0 ? "text-slate-300" : "text-red-500 hover:text-red-700 hover:bg-red-50"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}