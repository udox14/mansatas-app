// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/kelas/components/kelas-client.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Trash2, Users, ChevronRight, UserCircle, Library } from 'lucide-react'
import { TambahModal } from './tambah-modal'
import { ImportModal } from './import-modal'
import { hapusKelas, setWaliKelas } from '../actions'

type KelasData = {
  id: string
  tingkat: number
  nomor_kelas: string
  kelompok: string
  kapasitas: number
  wali_kelas_id: string
  wali_kelas_nama: string
  jumlah_siswa: number
}

type GuruType = { id: string; nama_lengkap: string }

// PERBAIKAN TYPE: Menambahkan daftarJurusan?: string[] ke Interface
export function KelasClient({ 
  initialData, 
  daftarGuru, 
  daftarJurusan = [] 
}: { 
  initialData: KelasData[], 
  daftarGuru: GuruType[], 
  daftarJurusan?: string[] 
}) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTingkat, setFilterTingkat] = useState('Semua')
  const [isPending, setIsPending] = useState(false)

  const filteredData = initialData.filter(k => {
    const matchTingkat = filterTingkat === 'Semua' || k.tingkat.toString() === filterTingkat
    const namaKelasPencarian = `${k.tingkat} ${k.kelompok} ${k.nomor_kelas}`.toLowerCase()
    const matchSearch = namaKelasPencarian.includes(searchTerm.toLowerCase()) || 
           k.wali_kelas_nama.toLowerCase().includes(searchTerm.toLowerCase())
           
    return matchTingkat && matchSearch
  })

  const sortedData = [...filteredData].sort((a, b) => {
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

  const handleUbahWali = async (kelasId: string, guruId: string) => {
    setIsPending(true)
    const res = await setWaliKelas(kelasId, guruId)
    if (res?.error) alert(res.error)
    setIsPending(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/60">
        <div className="flex flex-col sm:flex-row w-full sm:w-auto items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari kelas atau wali..."
              className="pl-11 h-12 rounded-xl bg-white shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Select value={filterTingkat} onValueChange={setFilterTingkat}>
            <SelectTrigger className="w-full sm:w-[160px] h-12 rounded-xl bg-white shadow-sm font-semibold text-slate-700">
              <SelectValue placeholder="Semua Tingkat" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="Semua">Semua Tingkat</SelectItem>
              <SelectItem value="10">Kelas 10</SelectItem>
              <SelectItem value="11">Kelas 11</SelectItem>
              <SelectItem value="12">Kelas 12</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <ImportModal />
          {/* PERBAIKAN: Mem-passing daftarJurusan ke modal Tambah Kelas */}
          <TambahModal daftarGuru={daftarGuru} daftarJurusan={daftarJurusan} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center gap-5">
          <div className="bg-blue-100 p-4 rounded-2xl text-blue-600"><Library className="h-7 w-7" /></div>
          <div><p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Kelas</p><h3 className="text-3xl font-black text-slate-800 leading-none">{sortedData.length}</h3></div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center gap-5">
          <div className="bg-emerald-100 p-4 rounded-2xl text-emerald-600"><Users className="h-7 w-7" /></div>
          <div><p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Kapasitas Kursi</p><h3 className="text-3xl font-black text-slate-800 leading-none">{sortedData.reduce((acc, curr) => acc + curr.kapasitas, 0)}</h3></div>
        </div>
      </div>

      {/* MOBILE VIEW */}
      <div className="block lg:hidden space-y-4">
        {sortedData.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center shadow-sm">
            <Library className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-500">Belum ada data kelas.</p>
          </div>
        ) : (
          sortedData.map((k) => {
            const namaKelasSingkat = `${k.tingkat}-${k.nomor_kelas}`
            const namaUntukAlert = `${k.tingkat}-${k.nomor_kelas} ${k.kelompok !== 'UMUM' ? k.kelompok : ''}`.trim()
            const isFull = k.jumlah_siswa >= k.kapasitas
            const percentage = Math.round((k.jumlah_siswa / k.kapasitas) * 100)

            return (
              <div key={k.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4 relative overflow-hidden">
                <div 
                  className="flex items-center justify-between cursor-pointer group pb-3 border-b border-slate-100"
                  onClick={() => router.push(`/dashboard/kelas/${k.id}`)}
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="font-black text-slate-800 text-2xl group-hover:text-blue-700 transition-colors tracking-tight leading-none">
                      {namaKelasSingkat}
                    </span>
                    {k.kelompok !== 'UMUM' && (
                      <span className="w-fit px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md">
                        {k.kelompok}
                      </span>
                    )}
                  </div>
                  <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600 group-hover:bg-blue-100 transition-colors">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Penugasan Wali Kelas</p>
                  <div className="flex items-center gap-3">
                    <UserCircle className={`h-6 w-6 shrink-0 ${k.wali_kelas_id === 'none' ? 'text-slate-300' : 'text-emerald-500'}`} />
                    <Select value={k.wali_kelas_id} onValueChange={(val) => handleUbahWali(k.id, val)} disabled={isPending}>
                      <SelectTrigger className="h-11 w-full bg-white border-slate-200 hover:bg-slate-50 transition-colors text-sm font-semibold focus:ring-emerald-500 shadow-sm rounded-xl">
                        <SelectValue placeholder="-- Pilih Wali Kelas --" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl shadow-lg">
                        <SelectItem value="none" className="text-slate-400 italic">-- Kosongkan --</SelectItem>
                        {daftarGuru.map(g => (
                          <SelectItem key={g.id} value={g.id} className="font-medium focus:bg-emerald-50 focus:text-emerald-700">
                            {g.nama_lengkap}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex flex-col gap-1.5 w-1/2">
                    <span className={`text-xs font-bold w-fit px-2.5 py-1 rounded-md ${isFull ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                      {k.jumlah_siswa} / {k.kapasitas} Kursi {isFull && '(Penuh)'}
                    </span>
                    <div className="w-full max-w-[140px] h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                      <div className={`h-full ${isFull ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                    </div>
                  </div>

                  <Button 
                    variant="ghost" size="sm" 
                    onClick={() => handleHapus(k.id, namaUntukAlert, k.jumlah_siswa)}
                    disabled={isPending || k.jumlah_siswa > 0}
                    className={`h-11 rounded-xl px-5 text-sm font-bold shadow-sm ${k.jumlah_siswa > 0 ? "text-slate-400 bg-slate-50" : "text-red-600 bg-red-50 hover:bg-red-100 hover:text-red-700"}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Hapus
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden lg:flex rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden flex-col">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="border-b border-slate-100">
              <TableHead className="font-bold text-slate-600 px-6 h-14 w-[300px]">Nama Kelas</TableHead>
              <TableHead className="font-bold text-slate-600 h-14">Wali Kelas</TableHead>
              <TableHead className="font-bold text-slate-600 text-center h-14 w-[200px]">Keterisian</TableHead>
              <TableHead className="text-right font-bold text-slate-600 px-6 h-14 w-[100px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500">Belum ada data kelas.</TableCell></TableRow>
            ) : (
              sortedData.map((k) => {
                const namaKelasSingkat = `${k.tingkat}-${k.nomor_kelas}`
                const namaUntukAlert = `${k.tingkat}-${k.nomor_kelas} ${k.kelompok !== 'UMUM' ? k.kelompok : ''}`.trim()
                const isFull = k.jumlah_siswa >= k.kapasitas
                const percentage = Math.round((k.jumlah_siswa / k.kapasitas) * 100)

                return (
                  <TableRow key={k.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 group">
                    <TableCell 
                      className="px-6 py-5 cursor-pointer relative"
                      onClick={() => router.push(`/dashboard/kelas/${k.id}`)}
                      title={`Klik untuk melihat detail kelas ${namaKelasSingkat}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-slate-800 text-xl group-hover:text-blue-700 transition-colors">
                            {namaKelasSingkat}
                          </span>
                          {k.kelompok !== 'UMUM' && (
                            <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md">
                              {k.kelompok}
                            </span>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                      </div>
                    </TableCell>
                    
                    <TableCell className="py-5">
                      <div className="flex items-center gap-3">
                        <UserCircle className={`h-6 w-6 ${k.wali_kelas_id === 'none' ? 'text-slate-300' : 'text-emerald-500'}`} />
                        <Select value={k.wali_kelas_id} onValueChange={(val) => handleUbahWali(k.id, val)} disabled={isPending}>
                          <SelectTrigger className="h-11 w-[260px] bg-slate-50/80 border-slate-200/60 hover:bg-white transition-colors text-sm font-semibold focus:ring-emerald-500 shadow-sm rounded-xl">
                            <SelectValue placeholder="-- Pilih Wali Kelas --" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl shadow-lg border-slate-100">
                            <SelectItem value="none" className="text-slate-400 italic focus:bg-slate-50">-- Kosongkan --</SelectItem>
                            {daftarGuru.map(g => (
                              <SelectItem key={g.id} value={g.id} className="font-medium focus:bg-emerald-50 focus:text-emerald-700">
                                {g.nama_lengkap}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>

                    <TableCell className="py-5">
                      <div className="flex flex-col items-center gap-2">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${isFull ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                          {k.jumlah_siswa} / {k.kapasitas} {isFull && '(Penuh)'}
                        </span>
                        <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                          <div className={`h-full ${isFull ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-right px-6 py-5">
                      <Button 
                        variant="ghost" size="icon" 
                        onClick={() => handleHapus(k.id, namaUntukAlert, k.jumlah_siswa)}
                        disabled={isPending || k.jumlah_siswa > 0}
                        title={k.jumlah_siswa > 0 ? "Kosongkan kelas dulu untuk menghapus" : "Hapus Kelas"}
                        className={`h-11 w-11 rounded-xl ${k.jumlah_siswa > 0 ? "text-slate-300" : "text-red-500 hover:text-red-700 hover:bg-red-50 bg-red-50/50 shadow-sm"}`}
                      >
                        <Trash2 className="h-5 w-5" />
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