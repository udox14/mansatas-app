// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/plotting/components/tab-kelulusan.tsx
'use client'

import { useState, useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, GraduationCap, AlertCircle, CheckCircle2, Filter, Search } from 'lucide-react'
import { prosesKelulusanMassal } from '../actions'

type SiswaType = { id: string, nama_lengkap: string, nisn: string, jenis_kelamin: string, kelas_lama: string, kelompok: string }

export function TabKelulusan({ siswaList }: { siswaList: SiswaType[] }) {
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // LAZY LOAD FILTER STATE
  const [filterKelas, setFilterKelas] = useState('NONE')
  const [searchSiswa, setSearchSiswa] = useState('') // STATE PENCARIAN
  const kelasLamaUnik = useMemo(() => Array.from(new Set(siswaList.map(s => s.kelas_lama))).sort(), [siswaList])

  const displayedSiswa = useMemo(() => {
    if (filterKelas === 'NONE') return []
    return siswaList.filter(s => {
      const matchKelas = filterKelas === 'ALL' || s.kelas_lama === filterKelas
      const matchSearch = s.nama_lengkap.toLowerCase().includes(searchSiswa.toLowerCase()) || s.nisn.includes(searchSiswa)
      return matchKelas && matchSearch
    })
  }, [siswaList, filterKelas, searchSiswa])

  const handleToggleSiswa = (id: string) => {
    setSelectedSiswaIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  // Pilih Semua hanya menyeleksi siswa yang TERTAMPIL saat ini (berdasarkan filter)
  const handleSelectAll = () => {
    const displayedIds = displayedSiswa.map(s => s.id)
    const allDisplayedSelected = displayedIds.length > 0 && displayedIds.every(id => selectedSiswaIds.includes(id))

    if (allDisplayedSelected) {
      setSelectedSiswaIds(prev => prev.filter(id => !displayedIds.includes(id)))
    } else {
      const newSelected = new Set([...selectedSiswaIds, ...displayedIds])
      setSelectedSiswaIds(Array.from(newSelected))
    }
  }

  const handleLuluskan = async () => {
    if (selectedSiswaIds.length === 0) return
    if (!confirm(`TINDAKAN PERMANEN!\n\nAnda yakin meluluskan ${selectedSiswaIds.length} siswa ini?`)) return

    setIsSubmitting(true)
    const res = await prosesKelulusanMassal(selectedSiswaIds)
    
    if (res.error) alert(res.error)
    else { setSuccessMsg(res.success!); setSelectedSiswaIds([]) }
    setIsSubmitting(false)
  }

  if (siswaList.length === 0 && !successMsg) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-slate-200 shadow-sm">
        <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-3" />
        <h3 className="text-sm font-semibold text-slate-800">Semua Lulus!</h3>
        <p className="text-slate-500 mt-2">Siswa kelas 12 sudah kosong atau belum ada data baru masuk.</p>
      </div>
    )
  }

  if (successMsg) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-emerald-50/80 rounded-lg border border-emerald-200/60 shadow-sm animate-in zoom-in duration-500">
        <GraduationCap className="h-24 w-24 text-emerald-500 mb-6 drop-shadow-md" />
        <h2 className="text-3xl font-black text-emerald-900 tracking-tight">Proses Kelulusan Selesai!</h2>
        <p className="text-emerald-700 mt-3 text-lg font-medium">{successMsg}</p>
        <Button onClick={() => setSuccessMsg('')} variant="outline" className="mt-4 border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-lg h-9 px-6 text-sm">
          Selesai
        </Button>
      </div>
    )
  }

  const displayedIds = displayedSiswa.map(s => s.id)
  const isAllDisplayedSelected = displayedIds.length > 0 && displayedIds.every(id => selectedSiswaIds.includes(id))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-rose-100 p-2.5 rounded-lg text-rose-600 shadow-inner">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-xl tracking-tight">Kelulusan 12</h3>
          </div>
          
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Ditemukan <strong className="text-rose-600 font-black">{siswaList.length}</strong> siswa kelas 12. Proses ini akan mengubah status mereka menjadi <strong className="text-slate-800">Lulus</strong> dan membersihkan data wadah kelas mereka.
          </p>

          <div className="bg-orange-50 border border-orange-200 p-5 rounded-lg mb-6 shadow-sm">
            <div className="flex items-start gap-3 text-orange-800">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                <p className="font-black mb-1 tracking-wide">PERHATIAN!</p>
                <p>Lakukan ini <strong>SEBELUM</strong> menaikkan anak kelas 11, agar wadah kelas 12 kosong terlebih dahulu.</p>
              </div>
            </div>
          </div>

          <Button onClick={handleLuluskan} disabled={isSubmitting || selectedSiswaIds.length === 0} className="w-full h-14 text-base font-bold gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-md transition-all rounded-lg">
            {isSubmitting ? <><Loader2 className="animate-spin h-5 w-5" /> Memproses...</> : <><GraduationCap className="h-5 w-5" /> Luluskan {selectedSiswaIds.length} Siswa</>}
          </Button>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Daftar Kandidat Lulus</h3>
              <p className="text-sm text-slate-500 mt-1">Pilih kelas asal dan centang siswa yang layak diluluskan.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari nama/NISN..."
                  value={searchSiswa}
                  onChange={e => setSearchSiswa(e.target.value)}
                  className="pl-9 h-10 rounded-lg bg-white border-slate-200 focus:border-indigo-500"
                />
              </div>

              <Select value={filterKelas} onValueChange={setFilterKelas}>
                <SelectTrigger className={`h-10 w-full sm:w-[160px] rounded-lg transition-colors font-semibold ${filterKelas === 'NONE' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 ring-2 ring-indigo-100' : 'bg-white'}`}>
                  <SelectValue placeholder="Pilih Kelas" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="NONE" disabled className="text-slate-400 italic">-- Pilih Kelas --</SelectItem>
                  <SelectItem value="ALL" className="font-bold text-indigo-600">Tampilkan Semua</SelectItem>
                  {kelasLamaUnik.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="text-sm font-bold text-rose-700 bg-rose-100 px-4 py-2 rounded-lg border border-rose-200 shadow-sm whitespace-nowrap w-full sm:w-auto text-center">
                {selectedSiswaIds.length} Dipilih
              </div>
            </div>
          </div>
          
          <ScrollArea className="flex-1 bg-white relative">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[60px] text-center pl-4">
                    <Checkbox 
                      checked={isAllDisplayedSelected} 
                      onCheckedChange={handleSelectAll} 
                      disabled={filterKelas === 'NONE'}
                    />
                  </TableHead>
                  <TableHead className="font-bold text-slate-600">NISN / Nama Siswa</TableHead>
                  <TableHead className="text-center font-bold text-slate-600">L/P</TableHead>
                  <TableHead className="text-right font-bold text-slate-600 pr-6">Kelas Akhir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filterKelas === 'NONE' ? (
                  <TableRow>
                     <TableCell colSpan={4} className="h-48 text-center">
                        <div className="flex flex-col items-center text-slate-400">
                          <Filter className="h-10 w-10 mb-3 opacity-50" />
                          <p className="font-medium text-slate-500">Pilih <strong className="text-indigo-600">Kelas Asal</strong> di atas untuk memuat daftar kandidat lulus.</p>
                        </div>
                     </TableCell>
                   </TableRow>
                ) : displayedSiswa.length === 0 ? (
                   <TableRow><TableCell colSpan={4} className="text-center h-32 text-slate-500">Tidak ada siswa yang cocok.</TableCell></TableRow>
                ) : displayedSiswa.map((siswa) => (
                  <TableRow key={siswa.id} className={`${selectedSiswaIds.includes(siswa.id) ? 'bg-rose-50/30' : 'hover:bg-slate-50/50'} transition-colors`}>
                    <TableCell className="text-center pl-4">
                      <Checkbox checked={selectedSiswaIds.includes(siswa.id)} onCheckedChange={() => handleToggleSiswa(siswa.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-800">{siswa.nama_lengkap}</div>
                      <div className="text-xs font-semibold text-slate-500 mt-0.5">{siswa.nisn}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{siswa.jenis_kelamin}</span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <span className="inline-flex items-center rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200 shadow-sm">
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