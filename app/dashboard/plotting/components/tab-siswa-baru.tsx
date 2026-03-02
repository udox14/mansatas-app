// BUAT FILE BARU
// Lokasi: app/dashboard/plotting/components/tab-siswa-baru.tsx
'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Play, Save, CheckCircle2 } from 'lucide-react'
import { simpanPlottingMassal } from '../actions'

type SiswaType = { id: string, nama_lengkap: string, nisn: string, jenis_kelamin: string }
type KelasType = { id: string, nama: string, kapasitas: number, jumlah_siswa: number }
type HasilPlottingType = { siswa_id: string, nama_lengkap: string, jk: string, kelas_id: string, kelas_nama: string }

export function TabSiswaBaru({ siswaList, kelasList }: { siswaList: SiswaType[], kelasList: KelasType[] }) {
  const [selectedKelasIds, setSelectedKelasIds] = useState<string[]>([])
  const [simulasiResult, setSimulasiResult] = useState<HasilPlottingType[]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const handleToggleKelas = (id: string) => {
    setSelectedKelasIds(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id])
  }

  // ALGORITMA ROUND-ROBIN (L/P & Abjad) dijalankan di sisi browser
  const jalankanSimulasi = () => {
    setIsSimulating(true)
    setSimulasiResult([])
    setSuccessMsg('')
    
    setTimeout(() => {
      const selectedKelasObjects = kelasList.filter(k => selectedKelasIds.includes(k.id)).map(k => ({ ...k, sisa_kuota: k.kapasitas - k.jumlah_siswa }))
      
      if (selectedKelasObjects.length === 0) {
        alert("Pilih minimal satu kelas tujuan!")
        setIsSimulating(false)
        return
      }

      // Pisahkan L/P dan urutkan abjad
      const siswaL = [...siswaList].filter(s => s.jenis_kelamin === 'L').sort((a,b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
      const siswaP = [...siswaList].filter(s => s.jenis_kelamin === 'P').sort((a,b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
      
      let hasil: HasilPlottingType[] = []
      let kelasIndex = 0

      const assignSiswa = (siswa: SiswaType) => {
        let attempts = 0
        while (attempts < selectedKelasObjects.length) {
          let target = selectedKelasObjects[kelasIndex]
          if (target.sisa_kuota > 0) {
            hasil.push({ siswa_id: siswa.id, nama_lengkap: siswa.nama_lengkap, jk: siswa.jenis_kelamin, kelas_id: target.id, kelas_nama: target.nama })
            target.sisa_kuota--
            kelasIndex = (kelasIndex + 1) % selectedKelasObjects.length
            return true
          }
          kelasIndex = (kelasIndex + 1) % selectedKelasObjects.length
          attempts++
        }
        return false // Jika semua kelas penuh
      }

      // Distribusikan Laki-laki dulu, baru Perempuan (agar merata)
      let sisaSiswa = 0
      for (let s of siswaL) { if (!assignSiswa(s)) sisaSiswa++ }
      for (let s of siswaP) { if (!assignSiswa(s)) sisaSiswa++ }

      if (sisaSiswa > 0) {
        alert(`Peringatan: Kapasitas kelas tidak cukup! Ada ${sisaSiswa} siswa yang tidak kebagian kelas. Silakan tambah kelas tujuan.`)
      }

      setSimulasiResult(hasil)
      setIsSimulating(false)
    }, 500) // Fake delay untuk efek loading
  }

  const simpanPermanen = async () => {
    if (simulasiResult.length === 0) return
    setIsSaving(true)
    
    const payload = simulasiResult.map(r => ({ siswa_id: r.siswa_id, kelas_id: r.kelas_id }))
    const res = await simpanPlottingMassal(payload)
    
    if (res.error) alert(res.error)
    else {
      setSuccessMsg(res.success!)
      setSimulasiResult([]) // Kosongkan preview jika sukses
    }
    setIsSaving(false)
  }

  if (siswaList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-emerald-50 rounded-xl border border-emerald-100">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
        <h3 className="text-lg font-bold text-emerald-900">Semua Siswa Sudah Masuk Kelas!</h3>
        <p className="text-emerald-700 mt-2">Tidak ada siswa baru atau siswa tanpa kelas yang perlu di-plot saat ini.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Panel Kiri: Pengaturan & Sumber */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <h3 className="font-bold text-slate-800 mb-2">1. Sumber Data (Siswa)</h3>
          <p className="text-sm text-slate-500 mb-4">Ditemukan <strong className="text-blue-600">{siswaList.length}</strong> siswa yang belum memiliki kelas.</p>
          <div className="flex gap-4 text-sm font-medium">
            <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg flex-1 text-center">Laki-laki: {siswaList.filter(s => s.jenis_kelamin === 'L').length}</div>
            <div className="bg-pink-50 text-pink-700 px-3 py-1.5 rounded-lg flex-1 text-center">Perempuan: {siswaList.filter(s => s.jenis_kelamin === 'P').length}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <h3 className="font-bold text-slate-800 mb-2">2. Pilih Kelas Tujuan (Wadah)</h3>
          <p className="text-sm text-slate-500 mb-4">Centang kelas 10 mana saja yang akan dibuka untuk siswa-siswa ini.</p>
          
          <ScrollArea className="h-[200px] border rounded-lg p-4 bg-slate-50">
            <div className="space-y-3">
              {kelasList.map(k => {
                const isFull = k.jumlah_siswa >= k.kapasitas
                return (
                  <div key={k.id} className="flex items-center space-x-3">
                    <Checkbox 
                      id={`k-${k.id}`} 
                      checked={selectedKelasIds.includes(k.id)}
                      onCheckedChange={() => handleToggleKelas(k.id)}
                      disabled={isFull}
                    />
                    <Label htmlFor={`k-${k.id}`} className={`flex-1 cursor-pointer ${isFull ? 'text-slate-400' : 'text-slate-700'}`}>
                      {k.nama} <span className="text-xs ml-1">({k.jumlah_siswa}/{k.kapasitas})</span>
                      {isFull && <span className="ml-2 text-[10px] text-red-500 font-bold uppercase">Penuh</span>}
                    </Label>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        <Button 
          onClick={jalankanSimulasi} 
          disabled={isSimulating || selectedKelasIds.length === 0}
          className="w-full h-12 text-base gap-2 bg-indigo-600 hover:bg-indigo-700"
        >
          {isSimulating ? <Loader2 className="animate-spin h-5 w-5" /> : <Play className="h-5 w-5" />}
          Jalankan Simulasi Plotting
        </Button>
      </div>

      {/* Panel Kanan: Preview Hasil */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
          <div className="p-5 border-b bg-slate-50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800">3. Preview Hasil Simulasi</h3>
              <p className="text-sm text-slate-500">Cek distribusi L/P sebelum menyimpan permanen.</p>
            </div>
            {simulasiResult.length > 0 && (
              <Button onClick={simpanPermanen} disabled={isSaving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                Simpan Permanen
              </Button>
            )}
          </div>
          
          <div className="flex-1 p-0">
            {successMsg ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-emerald-50">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4" />
                <h2 className="text-2xl font-bold text-emerald-900">Plotting Berhasil!</h2>
                <p className="text-emerald-700 mt-2">{successMsg}</p>
              </div>
            ) : simulasiResult.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-slate-400">
                <p>Belum ada simulasi yang dijalankan.</p>
                <p className="text-sm">Pilih kelas di sebelah kiri lalu klik "Jalankan Simulasi".</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-[60px] text-center">No</TableHead>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead className="text-center">L/P</TableHead>
                      <TableHead className="text-right">Ditempatkan di</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulasiResult.map((res, idx) => (
                      <TableRow key={res.siswa_id}>
                        <TableCell className="text-center text-slate-500">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{res.nama_lengkap}</TableCell>
                        <TableCell className="text-center font-bold text-slate-600">{res.jk}</TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
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