// TIMPA SELURUH ISI FILE INI
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

  const handleSelectAllKelas = () => {
    if (selectedKelasIds.length === kelasList.length) setSelectedKelasIds([])
    else setSelectedKelasIds(kelasList.map(k => k.id))
  }

  const jalankanSimulasi = () => {
    setIsSimulating(true); setSimulasiResult([]); setSuccessMsg('')
    setTimeout(() => {
      let hasil: HasilPlottingType[] = []
      let sisaSiswa = 0
      let errorMessage = ''

      const targetKelas = kelasList.filter(k => selectedKelasIds.includes(k.id)).map(k => ({ ...k, sisa_kuota: k.kapasitas - k.jumlah_siswa }))

      const distributeGroup = (siswaGroup: SiswaType[], kelompok: string) => {
        const wadah = targetKelas.filter(k => k.kelompok === kelompok)
        if (siswaGroup.length > 0 && wadah.length === 0) {
          errorMessage += `\n- Kelas 12 ${kelompok} belum dicentang!`
          sisaSiswa += siswaGroup.length; return
        }

        let kelasIndex = 0
        for (const siswa of siswaGroup) {
          let assigned = false
          let attempts = 0
          while (attempts < wadah.length) {
            let target = wadah[kelasIndex]
            if (target.sisa_kuota > 0) {
              hasil.push({ siswa_id: siswa.id, nama_lengkap: siswa.nama_lengkap, jk: siswa.jenis_kelamin, kelas_lama: siswa.kelas_lama, kelas_id: target.id, kelas_nama: target.nama })
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

      const kelompokUnik = Array.from(new Set(siswaList.map(s => s.kelompok)))
      kelompokUnik.forEach(kelompok => {
        const siswaKelompokIni = siswaList.filter(s => s.kelompok === kelompok)
        const siswaL = siswaKelompokIni.filter(s => s.jenis_kelamin === 'L').sort((a,b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
        const siswaP = siswaKelompokIni.filter(s => s.jenis_kelamin === 'P').sort((a,b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
        distributeGroup(siswaL, kelompok)
        distributeGroup(siswaP, kelompok)
      })

      if (sisaSiswa > 0) alert(`PERINGATAN! Ada ${sisaSiswa} siswa gagal di-plot. Pastikan kelas tersedia.${errorMessage}`)
      setSimulasiResult(hasil); setIsSimulating(false)
    }, 600)
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
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 shadow-sm">
        <CheckCircle2 className="h-16 w-16 text-emerald-400 mb-4" />
        <h3 className="text-xl font-bold text-slate-800">Tidak ada data kelas 11!</h3>
        <p className="text-slate-500 mt-2">Semua siswa kelas 11 mungkin sudah dinaikkan atau belum ada data.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-1 space-y-6 flex flex-col">
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/60 shadow-sm flex-shrink-0">
          <h3 className="font-bold text-slate-800 text-lg mb-2">1. Sumber Data (Kelas 11)</h3>
          <p className="text-sm text-slate-500 mb-4">Sistem mendeteksi <strong className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{siswaList.length}</strong> siswa siap diacak.</p>
          <div className="flex gap-2 flex-wrap text-sm font-bold">
            {Array.from(new Set(siswaList.map(s => s.kelompok))).map(k => (
               <div key={k} className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 flex-1 min-w-[100px] text-center shadow-sm">
                 {k}: {siswaList.filter(s => s.kelompok === k).length}
               </div>
            ))}
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/60 shadow-sm flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-slate-800 text-lg">2. Wadah Kelas 12</h3>
            <Button variant="outline" size="sm" onClick={handleSelectAllKelas} className="h-8 rounded-lg text-xs font-bold text-emerald-700 hover:bg-emerald-50 border-emerald-200">
              Pilih Semua
            </Button>
          </div>
          <p className="text-sm text-slate-500 mb-4">Centang kelas tujuan pengacakan ini.</p>
          
          <ScrollArea className="flex-1 min-h-[150px] border border-slate-200/60 rounded-2xl p-4 bg-slate-50 shadow-inner">
            <div className="space-y-3">
              {kelasList.map(k => {
                const isFull = k.jumlah_siswa >= k.kapasitas
                return (
                  <div key={k.id} className="flex items-center space-x-3 bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                    <Checkbox id={`p-${k.id}`} checked={selectedKelasIds.includes(k.id)} onCheckedChange={() => handleToggleKelas(k.id)} disabled={isFull} />
                    <Label htmlFor={`p-${k.id}`} className={`flex-1 flex justify-between cursor-pointer font-semibold ${isFull ? 'text-slate-400' : 'text-slate-700'}`}>
                      {k.nama} <span className="text-xs font-bold opacity-70 bg-slate-100 px-2 py-0.5 rounded">({k.jumlah_siswa}/{k.kapasitas})</span>
                    </Label>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
          
          <Button onClick={jalankanSimulasi} disabled={isSimulating || selectedKelasIds.length === 0} className="w-full mt-5 h-12 rounded-2xl gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold shadow-md transition-all text-base">
            {isSimulating ? <Loader2 className="animate-spin h-5 w-5" /> : <Shuffle className="h-5 w-5" />} Jalankan Algo Acak
          </Button>
        </div>
      </div>

      <div className="xl:col-span-2">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">3. Preview Hasil Pengacakan</h3>
              <p className="text-sm text-slate-500 mt-1">Siswa diacak silang L/P ke dalam jurusan yang sama.</p>
            </div>
            {simulasiResult.length > 0 && (
              <Button onClick={simpanPermanen} disabled={isSaving} className="gap-2 bg-emerald-600 hover:bg-emerald-700 h-11 rounded-xl shadow-md w-full sm:w-auto">
                {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} Simpan Permanen
              </Button>
            )}
          </div>

          <div className="flex-1 p-0 relative bg-white">
            {successMsg ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-emerald-50/80 backdrop-blur-sm z-20">
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4 animate-in zoom-in" />
                <h2 className="text-2xl font-black text-emerald-900 tracking-tight">Pengacakan Berhasil!</h2>
                <p className="text-emerald-700 mt-2 font-medium">{successMsg}</p>
              </div>
            ) : simulasiResult.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-slate-400 text-center">
                <div className="bg-slate-50 p-4 rounded-full mb-3"><Shuffle className="h-8 w-8 text-slate-300" /></div>
                <p className="font-medium text-slate-500">Belum ada simulasi pengacakan.</p>
              </div>
            ) : (
              <ScrollArea className="h-full absolute inset-0">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 shadow-sm">
                    <TableRow>
                      <TableHead className="font-bold text-slate-600 pl-6">Nama Siswa</TableHead>
                      <TableHead className="text-center font-bold text-slate-600">Lama (11)</TableHead>
                      <TableHead className="text-center"></TableHead>
                      <TableHead className="text-right font-bold text-slate-600 pr-6">Baru (12)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulasiResult.map((res) => (
                      <TableRow key={res.siswa_id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-bold text-slate-800 pl-6">
                          {res.nama_lengkap} <span className="text-slate-400 text-[10px] font-black ml-1 bg-slate-100 px-1.5 py-0.5 rounded">{res.jk}</span>
                        </TableCell>
                        <TableCell className="text-center text-xs text-rose-600 font-bold">{res.kelas_lama}</TableCell>
                        <TableCell className="text-center text-slate-300"><ArrowRight className="h-4 w-4 mx-auto"/></TableCell>
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