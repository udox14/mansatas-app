// BUAT FILE BARU
// Lokasi: app/dashboard/plotting/components/tab-pengacakan.tsx
'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Play, Save, CheckCircle2, ArrowRight, Shuffle } from 'lucide-react'
import { simpanPlottingMassal } from '../actions'

type SiswaType = { id: string, nama_lengkap: string, nisn: string, jenis_kelamin: string, kelas_lama: string, kelompok: string }
type KelasType = { id: string, nama: string, kelompok: string, kapasitas: number, jumlah_siswa: number }
type HasilPlottingType = { siswa_id: string, nama_lengkap: string, jk: string, kelas_lama: string, kelas_id: string, kelas_nama: string }

export function TabPengacakan({ siswaList, kelasList }: { siswaList: SiswaType[], kelasList: KelasType[] }) {
  const [selectedKelasIds, setSelectedKelasIds] = useState<string[]>([])
  const [simulasiResult, setSimulasiResult] = useState<HasilPlottingType[]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const handleToggleKelas = (id: string) => {
    setSelectedKelasIds(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id])
  }

  // Menandai semua kelas 12
  const handleSelectAllKelas = () => {
    if (selectedKelasIds.length === kelasList.length) setSelectedKelasIds([])
    else setSelectedKelasIds(kelasList.map(k => k.id))
  }

  // ALGORITMA PENGACAKAN CERDAS
  const jalankanSimulasi = () => {
    setIsSimulating(true)
    setSimulasiResult([])
    setSuccessMsg('')
    
    setTimeout(() => {
      let hasil: HasilPlottingType[] = []
      let sisaSiswa = 0
      let errorMessage = ''

      const targetKelas = kelasList.filter(k => selectedKelasIds.includes(k.id)).map(k => ({ ...k, sisa_kuota: k.kapasitas - k.jumlah_siswa }))

      const distributeGroup = (siswaGroup: SiswaType[], kelompok: string) => {
        const wadah = targetKelas.filter(k => k.kelompok === kelompok)
        if (siswaGroup.length > 0 && wadah.length === 0) {
          errorMessage += `\n- Kelas 12 ${kelompok} belum dicentang/dibuka! (${siswaGroup.length} siswa gagal di-plot).`
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

      // 1. Ekstrak jurusan unik dari anak kelas 11 saat ini (MIPA/SOSHUM/dsb)
      const kelompokUnik = Array.from(new Set(siswaList.map(s => s.kelompok)))
      
      // 2. Acak & sebar per kelompok (MIPA ke MIPA, dsb)
      kelompokUnik.forEach(kelompok => {
        const siswaKelompokIni = siswaList.filter(s => s.kelompok === kelompok)
        
        // Pemisahan L/P & Urut Abjad agar hasil distribusi menyilang rata
        const siswaL = siswaKelompokIni.filter(s => s.jenis_kelamin === 'L').sort((a,b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
        const siswaP = siswaKelompokIni.filter(s => s.jenis_kelamin === 'P').sort((a,b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
        
        distributeGroup(siswaL, kelompok)
        distributeGroup(siswaP, kelompok)
      })

      if (sisaSiswa > 0) {
        alert(`PERINGATAN! Ada ${sisaSiswa} siswa yang gagal di-plot. Kemungkinan kapasitas kelas tujuan tidak mencukupi atau kelas jurusannya belum dibuka.${errorMessage}`)
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
    }
    setIsSaving(false)
  }

  if (siswaList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-indigo-50 rounded-xl border border-indigo-100">
        <CheckCircle2 className="h-12 w-12 text-indigo-500 mb-4" />
        <h3 className="text-lg font-bold text-indigo-900">Tidak ada data kelas 11!</h3>
        <p className="text-indigo-700 mt-2">Semua siswa kelas 11 mungkin sudah dinaikkan ke kelas 12 atau belum ada data masuk.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* PANEL KIRI: INFO & SETTING */}
      <div className="xl:col-span-1 space-y-4 flex flex-col">
        <div className="bg-white p-5 rounded-xl border shadow-sm flex-shrink-0">
          <h3 className="font-bold text-slate-800 mb-2">1. Sumber Data (Kelas 11)</h3>
          <p className="text-sm text-slate-500 mb-4">Sistem mendeteksi <strong className="text-blue-600">{siswaList.length}</strong> siswa kelas 11 yang siap diacak.</p>
          
          <div className="flex gap-2 flex-wrap text-sm font-medium mb-2">
            {Array.from(new Set(siswaList.map(s => s.kelompok))).map(k => (
               <div key={k} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 flex-1 min-w-[100px] text-center">
                 {k}: {siswaList.filter(s => s.kelompok === k).length}
               </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border shadow-sm flex-shrink-0 flex-1">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-slate-800">2. Pilih Wadah Kelas 12</h3>
            <Button variant="ghost" size="sm" onClick={handleSelectAllKelas} className="h-6 text-xs text-blue-600">
              Pilih Semua
            </Button>
          </div>
          <p className="text-sm text-slate-500 mb-4">Centang kelas tujuan pengacakan ini.</p>
          
          <ScrollArea className="h-[200px] border rounded-lg p-3 bg-slate-50">
            <div className="space-y-3">
              {kelasList.map(k => {
                const isFull = k.jumlah_siswa >= k.kapasitas
                return (
                  <div key={k.id} className="flex items-center space-x-3">
                    <Checkbox id={`p-${k.id}`} checked={selectedKelasIds.includes(k.id)} onCheckedChange={() => handleToggleKelas(k.id)} disabled={isFull} />
                    <Label htmlFor={`p-${k.id}`} className={`flex-1 cursor-pointer ${isFull ? 'text-slate-400' : 'text-slate-700'}`}>
                      {k.nama} <span className="text-xs text-slate-400 ml-1">({k.jumlah_siswa}/{k.kapasitas})</span>
                      {isFull && <span className="ml-2 text-[10px] text-red-500 font-bold uppercase">Penuh</span>}
                    </Label>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
          
          <Button 
            onClick={jalankanSimulasi} 
            disabled={isSimulating || selectedKelasIds.length === 0}
            className="w-full mt-4 gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            {isSimulating ? <Loader2 className="animate-spin h-5 w-5" /> : <Shuffle className="h-5 w-5" />}
            Jalankan Pengacakan (Simulasi)
          </Button>
        </div>
      </div>

      {/* PANEL KANAN: PREVIEW PENGACAKAN */}
      <div className="xl:col-span-2">
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col min-h-[500px] h-full">
          <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800">3. Preview Hasil Pengacakan</h3>
              <p className="text-xs text-slate-500">Siswa diacak sesuai abjad L/P ke dalam jurusan yang sama.</p>
            </div>
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
                <h2 className="text-xl font-bold text-emerald-900">Pengacakan Berhasil!</h2>
                <p className="text-emerald-700 mt-2">{successMsg}</p>
              </div>
            ) : simulasiResult.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-slate-400 text-center">
                <Shuffle className="h-12 w-12 text-slate-300 mb-4 opacity-50" />
                <p>Belum ada simulasi.</p>
                <p className="text-sm">Pilih wadah kelas 12, lalu klik tombol jalankan pengacakan.</p>
              </div>
            ) : (
              <ScrollArea className="h-full absolute inset-0">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                    <TableRow>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead className="text-center">Kelas Lama (11)</TableHead>
                      <TableHead className="text-center"><ArrowRight className="h-4 w-4 mx-auto text-slate-400"/></TableHead>
                      <TableHead className="text-right">Kelas Baru (12)</TableHead>
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