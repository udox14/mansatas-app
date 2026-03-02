// BUAT FILE BARU
// Lokasi: app/dashboard/plotting/components/tab-penjurusan.tsx
'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Play, Save, CheckCircle2, ArrowRight } from 'lucide-react'
import { simpanPlottingMassal } from '../actions'

type SiswaType = { id: string, nama_lengkap: string, nisn: string, jenis_kelamin: string, kelas_lama: string }
type KelasType = { id: string, nama: string, kelompok: string, kapasitas: number, jumlah_siswa: number }
type HasilPlottingType = { siswa_id: string, nama_lengkap: string, jk: string, kelas_lama: string, kelas_id: string, kelas_nama: string }

export function TabPenjurusan({ siswaList, kelasList }: { siswaList: SiswaType[], kelasList: KelasType[] }) {
  // State untuk menetapkan jurusan per siswa { "siswa_id": "MIPA" }
  const [penjurusan, setPenjurusan] = useState<Record<string, string>>({})
  
  // State UI
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<string[]>([])
  const [bulkKelompok, setBulkKelompok] = useState<string>('')
  
  const [selectedKelasIds, setSelectedKelasIds] = useState<string[]>([])
  const [simulasiResult, setSimulasiResult] = useState<HasilPlottingType[]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // Menandai semua siswa atau batalkan
  const handleSelectAllSiswa = () => {
    if (selectedSiswaIds.length === siswaList.length) setSelectedSiswaIds([])
    else setSelectedSiswaIds(siswaList.map(s => s.id))
  }

  const handleToggleSiswa = (id: string) => {
    setSelectedSiswaIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  // Terapkan jurusan secara massal ke siswa yang dicentang
  const applyBulkPenjurusan = () => {
    if (!bulkKelompok || selectedSiswaIds.length === 0) return
    const newPenjurusan = { ...penjurusan }
    selectedSiswaIds.forEach(id => { newPenjurusan[id] = bulkKelompok })
    setPenjurusan(newPenjurusan)
    setSelectedSiswaIds([]) // Bersihkan centang setelah di-apply
  }

  const handleToggleKelas = (id: string) => {
    setSelectedKelasIds(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id])
  }

  // Algoritma Round-Robin Cerdas (Memperhatikan Kelompok Mapel)
  const jalankanSimulasi = () => {
    setIsSimulating(true)
    setSimulasiResult([])
    setSuccessMsg('')
    
    setTimeout(() => {
      let hasil: HasilPlottingType[] = []
      let sisaSiswa = 0
      let errorMessage = ''

      // Siapkan object kelas yang dicentang beserta sisa kuotanya
      const targetKelas = kelasList.filter(k => selectedKelasIds.includes(k.id)).map(k => ({ ...k, sisa_kuota: k.kapasitas - k.jumlah_siswa }))

      // Fungsi Helper untuk mendistribusikan satu grup (Misal: Semua Laki-laki MIPA ke Kelas-kelas MIPA)
      const distributeGroup = (siswaGroup: SiswaType[], kelompok: string) => {
        const wadah = targetKelas.filter(k => k.kelompok === kelompok)
        if (siswaGroup.length > 0 && wadah.length === 0) {
          errorMessage += `\n- Tidak ada kelas tujuan ${kelompok} yang dipilih! (${siswaGroup.length} siswa gagal di-plot).`
          sisaSiswa += siswaGroup.length
          return
        }

        let kelasIndex = 0
        for (const siswa of siswaGroup) {
          let assigned = false
          let attempts = 0
          while (attempts < wadah.length) {
            let target = wadah[kelasIndex]
            if (target.sisa_kuota > 0) {
              hasil.push({ 
                siswa_id: siswa.id, nama_lengkap: siswa.nama_lengkap, jk: siswa.jenis_kelamin, 
                kelas_lama: siswa.kelas_lama, kelas_id: target.id, kelas_nama: target.nama 
              })
              target.sisa_kuota--
              assigned = true
              kelasIndex = (kelasIndex + 1) % wadah.length
              break
            }
            kelasIndex = (kelasIndex + 1) % wadah.length
            attempts++
          }
          if (!assigned) sisaSiswa++
        }
      }

      // Filter siswa yang SUDAH ditentukan jurusannya
      const siswaSiapPlot = siswaList.filter(s => penjurusan[s.id])

      if (siswaSiapPlot.length === 0) {
        alert("Belum ada satupun siswa yang diberikan tiket jurusan (MIPA/SOSHUM/dll).")
        setIsSimulating(false)
        return
      }

      // Eksekusi distribusi per kelompok dan per jenis kelamin (agar rata L/P)
      const kelompokUnik = Array.from(new Set(siswaSiapPlot.map(s => penjurusan[s.id])))
      
      kelompokUnik.forEach(kelompok => {
        const siswaKelompokIni = siswaSiapPlot.filter(s => penjurusan[s.id] === kelompok)
        const siswaL = siswaKelompokIni.filter(s => s.jenis_kelamin === 'L').sort((a,b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
        const siswaP = siswaKelompokIni.filter(s => s.jenis_kelamin === 'P').sort((a,b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
        
        distributeGroup(siswaL, kelompok)
        distributeGroup(siswaP, kelompok)
      })

      if (sisaSiswa > 0) {
        alert(`PERINGATAN! Ada ${sisaSiswa} siswa yang gagal di-plot. Kemungkinan kapasitas kelas tujuan tidak mencukupi.${errorMessage}`)
      }

      setSimulasiResult(hasil)
      setIsSimulating(false)
    }, 600)
  }

  const simpanPermanen = async () => {
    if (simulasiResult.length === 0) return
    setIsSaving(true)
    
    const payload = simulasiResult.map(r => ({ siswa_id: r.siswa_id, kelas_id: r.kelas_id }))
    const res = await simpanPlottingMassal(payload)
    
    if (res.error) alert(res.error)
    else {
      setSuccessMsg(res.success!)
      setSimulasiResult([])
      setPenjurusan({}) // Reset
    }
    setIsSaving(false)
  }

  if (siswaList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-blue-50 rounded-xl border border-blue-100">
        <CheckCircle2 className="h-12 w-12 text-blue-500 mb-4" />
        <h3 className="text-lg font-bold text-blue-900">Tidak ada data kelas 10!</h3>
        <p className="text-blue-700 mt-2">Semua siswa kelas 10 mungkin sudah dinaikkan ke kelas 11.</p>
      </div>
    )
  }

  const siswaTertahan = siswaList.length - Object.keys(penjurusan).length

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* PANEL KIRI: PENETAPAN JURUSAN */}
      <div className="space-y-4">
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-slate-800">1. Tetapkan Tiket Penjurusan</h3>
              <p className="text-sm text-slate-500">Pilih siswa kelas 10 lalu set jurusannya.</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                {Object.keys(penjurusan).length} Siap Plot
              </span>
              <div className="text-xs text-slate-400 mt-1">{siswaTertahan} Belum di-set</div>
            </div>
          </div>

          <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border mb-4">
            <Select value={bulkKelompok} onValueChange={setBulkKelompok}>
              <SelectTrigger className="w-[180px] bg-white"><SelectValue placeholder="Pilih Jurusan..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MIPA">MIPA</SelectItem>
                <SelectItem value="SOSHUM">SOSHUM</SelectItem>
                <SelectItem value="KEAGAMAAN">KEAGAMAAN</SelectItem>
                <SelectItem value="UMUM">UMUM</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={applyBulkPenjurusan} disabled={!bulkKelompok || selectedSiswaIds.length === 0} variant="secondary" className="text-indigo-700 bg-indigo-100 hover:bg-indigo-200">
              Set ke {selectedSiswaIds.length} Terpilih
            </Button>
          </div>

          <ScrollArea className="h-[400px] border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-white shadow-sm z-10">
                <TableRow>
                  <TableHead className="w-[40px]"><Checkbox checked={selectedSiswaIds.length === siswaList.length && siswaList.length > 0} onCheckedChange={handleSelectAllSiswa} /></TableHead>
                  <TableHead>Nama Siswa & Kelas</TableHead>
                  <TableHead className="text-right">Jurusan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {siswaList.map(s => (
                  <TableRow key={s.id} className={penjurusan[s.id] ? 'bg-indigo-50/30' : ''}>
                    <TableCell><Checkbox checked={selectedSiswaIds.includes(s.id)} onCheckedChange={() => handleToggleSiswa(s.id)} /></TableCell>
                    <TableCell>
                      <div className="font-medium">{s.nama_lengkap}</div>
                      <div className="text-xs text-slate-500">Dari: {s.kelas_lama}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      {penjurusan[s.id] 
                        ? <span className="text-xs font-bold text-indigo-700">{penjurusan[s.id]}</span> 
                        : <span className="text-xs text-rose-500 italic">Belum Set</span>
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </div>

      {/* PANEL KANAN: PILIH WADAH & SIMULASI */}
      <div className="space-y-4 flex flex-col">
        <div className="bg-white p-5 rounded-xl border shadow-sm flex-shrink-0">
          <h3 className="font-bold text-slate-800 mb-2">2. Pilih Wadah Kelas 11</h3>
          <p className="text-sm text-slate-500 mb-4">Centang kelas 11 yang akan dibuka.</p>
          <ScrollArea className="h-[120px] border rounded-lg p-3 bg-slate-50">
            <div className="grid grid-cols-2 gap-2">
              {kelasList.map(k => {
                const isFull = k.jumlah_siswa >= k.kapasitas
                return (
                  <div key={k.id} className="flex items-center space-x-2">
                    <Checkbox id={`p-${k.id}`} checked={selectedKelasIds.includes(k.id)} onCheckedChange={() => handleToggleKelas(k.id)} disabled={isFull} />
                    <Label htmlFor={`p-${k.id}`} className={`text-sm cursor-pointer ${isFull ? 'text-slate-400' : 'text-slate-700'}`}>
                      {k.nama} <span className="text-xs text-slate-400">({k.jumlah_siswa}/{k.kapasitas})</span>
                    </Label>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
          
          <Button 
            onClick={jalankanSimulasi} 
            disabled={isSimulating || selectedKelasIds.length === 0 || Object.keys(penjurusan).length === 0}
            className="w-full mt-4 gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            {isSimulating ? <Loader2 className="animate-spin h-4 w-4" /> : <Play className="h-4 w-4" />}
            Jalankan Pengacakan Cerdas (Simulasi)
          </Button>
        </div>

        {/* HASIL PREVIEW */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex-1 flex flex-col min-h-[300px]">
          <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">3. Preview Sebaran Kelas 11</h3>
            {simulasiResult.length > 0 && (
              <Button onClick={simpanPermanen} disabled={isSaving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                Simpan Permanen
              </Button>
            )}
          </div>
          <div className="flex-1 p-0 relative">
            {successMsg ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-emerald-50">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4" />
                <h2 className="text-xl font-bold text-emerald-900">Kenaikan Kelas Berhasil!</h2>
                <p className="text-emerald-700 mt-2">{successMsg}</p>
              </div>
            ) : simulasiResult.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-slate-400 text-center">
                <p>Belum ada simulasi.</p>
                <p className="text-sm">Tetapkan jurusan, pilih wadah, lalu jalankan simulasi.</p>
              </div>
            ) : (
              <ScrollArea className="h-full absolute inset-0">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                    <TableRow>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead className="text-center">Kelas Lama</TableHead>
                      <TableHead className="text-center"><ArrowRight className="h-4 w-4 mx-auto text-slate-400"/></TableHead>
                      <TableHead className="text-right">Kelas Baru (11)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulasiResult.map((res) => (
                      <TableRow key={res.siswa_id}>
                        <TableCell className="font-medium">
                          {res.nama_lengkap} <span className="text-slate-400 text-xs ml-1">({res.jk})</span>
                        </TableCell>
                        <TableCell className="text-center text-xs text-rose-600 font-semibold">{res.kelas_lama}</TableCell>
                        <TableCell className="text-center text-slate-300">→</TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-100">
                            {res.kelas_nama}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}