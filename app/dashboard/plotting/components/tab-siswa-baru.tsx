// TIMPA SELURUH ISI FILE INI
// Lokasi: app/dashboard/plotting/components/tab-siswa-baru.tsx
'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Play, Save, CheckCircle2, UserPlus } from 'lucide-react'
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

  const jalankanSimulasi = () => {
    setIsSimulating(true); setSimulasiResult([]); setSuccessMsg('')
    setTimeout(() => {
      const selectedKelasObjects = kelasList.filter(k => selectedKelasIds.includes(k.id)).map(k => ({ ...k, sisa_kuota: k.kapasitas - k.jumlah_siswa }))
      if (selectedKelasObjects.length === 0) { alert("Pilih minimal satu kelas tujuan!"); setIsSimulating(false); return }

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
        return false 
      }

      let sisaSiswa = 0
      for (let s of siswaL) { if (!assignSiswa(s)) sisaSiswa++ }
      for (let s of siswaP) { if (!assignSiswa(s)) sisaSiswa++ }

      if (sisaSiswa > 0) alert(`Peringatan: Kapasitas kelas tidak cukup! Ada ${sisaSiswa} siswa tidak kebagian kursi.`)

      setSimulasiResult(hasil)
      setIsSimulating(false)
    }, 500) 
  }

  const simpanPermanen = async () => {
    if (simulasiResult.length === 0) return
    setIsSaving(true)
    const payload = simulasiResult.map(r => ({ siswa_id: r.siswa_id, kelas_id: r.kelas_id }))
    const res = await simpanPlottingMassal(payload)
    if (res.error) alert(res.error)
    else { setSuccessMsg(res.success!); setSimulasiResult([]) }
    setIsSaving(false)
  }

  if (siswaList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-slate-200 shadow-sm">
        <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-3" />
        <h3 className="text-sm font-semibold text-slate-800">Semua Siswa Terploting!</h3>
        <p className="text-slate-500 mt-2">Tidak ada siswa baru / tanpa kelas yang perlu di-plot saat ini.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 text-lg mb-1.5">1. Sumber Data</h3>
          <p className="text-sm text-slate-500 mb-3">Ada <strong className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{siswaList.length}</strong> siswa baru siap sebar.</p>
          <div className="flex gap-3 text-sm font-bold">
            <div className="bg-blue-50 text-blue-700 px-4 py-2.5 rounded-lg flex-1 text-center border border-blue-100 shadow-sm">Laki-laki: {siswaList.filter(s => s.jenis_kelamin === 'L').length}</div>
            <div className="bg-pink-50 text-pink-700 px-4 py-2.5 rounded-lg flex-1 text-center border border-pink-100 shadow-sm">Perempuan: {siswaList.filter(s => s.jenis_kelamin === 'P').length}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 text-lg mb-1.5">2. Wadah Kelas 10</h3>
          <p className="text-sm text-slate-500 mb-3">Centang kelas untuk menampung siswa.</p>
          
          <ScrollArea className="h-[200px] border border-slate-200 rounded-lg p-4 bg-slate-50 shadow-inner">
            <div className="space-y-3">
              {kelasList.map(k => {
                const isFull = k.jumlah_siswa >= k.kapasitas
                return (
                  <div key={k.id} className="flex items-center space-x-3 bg-white p-2.5 rounded-lg border border-slate-100">
                    <Checkbox id={`k-${k.id}`} checked={selectedKelasIds.includes(k.id)} onCheckedChange={() => handleToggleKelas(k.id)} disabled={isFull}/>
                    <Label htmlFor={`k-${k.id}`} className={`flex-1 flex justify-between cursor-pointer font-semibold ${isFull ? 'text-slate-400' : 'text-slate-700'}`}>
                      {k.nama} 
                      <span className="text-xs font-bold bg-slate-100 px-2 py-0.5 rounded opacity-80">({k.jumlah_siswa}/{k.kapasitas})</span>
                    </Label>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        <Button onClick={jalankanSimulasi} disabled={isSimulating || selectedKelasIds.length === 0} className="w-full h-14 rounded-lg text-base font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          {isSimulating ? <Loader2 className="animate-spin h-5 w-5" /> : <Play className="h-5 w-5" />} Jalankan Algo Penyebaran
        </Button>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">3. Preview Hasil Simulasi</h3>
              <p className="text-sm text-slate-500 mt-1">Cek distribusi (L/P) sebelum simpan permanen.</p>
            </div>
            {simulasiResult.length > 0 && (
              <Button onClick={simpanPermanen} disabled={isSaving} className="gap-2 bg-emerald-600 hover:bg-emerald-700 h-9 text-sm rounded-lg w-full sm:w-auto">
                {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} Simpan Permanen
              </Button>
            )}
          </div>
          
          <div className="flex-1 p-0 relative bg-white">
            {successMsg ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-emerald-50/80 backdrop-blur-sm z-20">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-3 animate-in zoom-in" />
                <h2 className="text-lg font-bold text-emerald-900">Plotting Berhasil!</h2>
                <p className="text-emerald-700 mt-2 font-medium">{successMsg}</p>
              </div>
            ) : simulasiResult.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-slate-400">
                <div className="bg-slate-50 p-4 rounded-full mb-3"><UserPlus className="h-8 w-8 text-slate-300" /></div>
                <p className="font-medium text-slate-500">Belum ada simulasi dijalankan.</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] absolute inset-0">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="w-[80px] text-center font-bold text-slate-600 pl-6">No</TableHead>
                      <TableHead className="font-bold text-slate-600">Nama Siswa</TableHead>
                      <TableHead className="text-center font-bold text-slate-600">L/P</TableHead>
                      <TableHead className="text-right font-bold text-slate-600 pr-6">Ditempatkan di</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulasiResult.map((res, idx) => (
                      <TableRow key={res.siswa_id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="text-center text-slate-500 font-medium pl-6">{idx + 1}</TableCell>
                        <TableCell className="font-bold text-slate-800">{res.nama_lengkap}</TableCell>
                        <TableCell className="text-center">
                           <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{res.jk}</span>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <span className="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200 shadow-sm">
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