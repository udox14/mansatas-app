'use client'

import { useState, useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Play, Save, CheckCircle2, ArrowRight, Shuffle } from 'lucide-react'
import { simpanPlottingMassal } from '../actions'

type SiswaType = { id: string; nama_lengkap: string; nisn: string; jenis_kelamin: string; kelas_lama: string; kelompok: string }
type KelasType = { id: string; nama: string; kelompok: string; kapasitas: number; jumlah_siswa: number }
type HasilType = { siswa_id: string; nama_lengkap: string; jk: string; kelas_lama: string; kelas_id: string; kelas_nama: string }

export function TabPengacakan({ siswaList, kelasList }: { siswaList: SiswaType[]; kelasList: KelasType[] }) {
  const [selectedKelasIds, setSelectedKelasIds] = useState<string[]>([])
  const [simulasiResult, setSimulasiResult] = useState<HasilType[]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const sortedKelas = useMemo(() =>
    [...kelasList].sort((a, b) => a.nama.localeCompare(b.nama, undefined, { numeric: true, sensitivity: 'base' })),
    [kelasList]
  )

  const handleToggleKelas = (id: string) =>
    setSelectedKelasIds(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id])

  const handleSelectAll = () =>
    setSelectedKelasIds(selectedKelasIds.length === sortedKelas.length ? [] : sortedKelas.map(k => k.id))

  const jalankanSimulasi = () => {
    setIsSimulating(true); setSimulasiResult([]); setSuccessMsg('')
    setTimeout(() => {
      const targetKelas = sortedKelas.filter(k => selectedKelasIds.includes(k.id)).map(k => ({ ...k, sisa: k.kapasitas - k.jumlah_siswa }))
      let hasil: HasilType[] = [], sisaSiswa = 0, errMsg = ''

      const dist = (group: SiswaType[], kelompok: string) => {
        const wadah = targetKelas.filter(k => k.kelompok === kelompok)
        if (group.length && !wadah.length) { errMsg += `\n- Kelas 12 ${kelompok} belum dicentang!`; sisaSiswa += group.length; return }
        let ki = 0
        for (const s of group) {
          let ok = false
          for (let i = 0; i < wadah.length; i++) {
            const t = wadah[ki]; ki = (ki + 1) % wadah.length
            if (t.sisa > 0) { hasil.push({ siswa_id: s.id, nama_lengkap: s.nama_lengkap, jk: s.jenis_kelamin, kelas_lama: s.kelas_lama, kelas_id: t.id, kelas_nama: t.nama }); t.sisa--; ok = true; break }
          }
          if (!ok) sisaSiswa++
        }
      }

      Array.from(new Set(siswaList.map(s => s.kelompok))).forEach(kelompok => {
        const g = siswaList.filter(s => s.kelompok === kelompok)
        dist(g.filter(s => s.jenis_kelamin === 'L').sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap)), kelompok)
        dist(g.filter(s => s.jenis_kelamin === 'P').sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap)), kelompok)
      })

      if (sisaSiswa > 0) alert(`PERINGATAN! ${sisaSiswa} siswa gagal di-plot.${errMsg}`)
      setSimulasiResult(hasil); setIsSimulating(false)
    }, 500)
  }

  const simpanPermanen = async () => {
    if (!simulasiResult.length) return
    setIsSaving(true)
    const res = await simpanPlottingMassal(simulasiResult.map(r => ({ siswa_id: r.siswa_id, kelas_id: r.kelas_id })))
    if (res.error) alert(res.error)
    else { setSuccessMsg(res.success!); setSimulasiResult([]) }
    setIsSaving(false)
  }

  if (!siswaList.length) return (
    <div className="flex flex-col items-center justify-center p-10 text-center bg-white rounded-lg border border-slate-200">
      <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-2" />
      <p className="text-sm font-semibold text-slate-700">Tidak ada data kelas 11!</p>
      <p className="text-xs text-slate-400 mt-1">Semua sudah dinaikkan atau belum ada data.</p>
    </div>
  )

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
      {/* Panel kiri */}
      <div className="xl:col-span-1 space-y-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-600 mb-2">Sumber (Kelas 11)</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set(siswaList.map(s => s.kelompok))).map(k => (
              <div key={k} className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold px-2 py-1 rounded-md">
                {k}: {siswaList.filter(s => s.kelompok === k).length}
              </div>
            ))}
            <div className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-1 rounded-md">
              Total: {siswaList.length}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-600">Wadah Kelas 12</p>
            <Button variant="outline" size="sm" onClick={handleSelectAll}
              className="h-6 text-[10px] px-2 rounded border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              {selectedKelasIds.length === sortedKelas.length ? 'Batal Semua' : 'Pilih Semua'}
            </Button>
          </div>
          <div className="space-y-1 max-h-[240px] overflow-y-auto pr-0.5 custom-scrollbar">
            {sortedKelas.map(k => {
              const isFull = k.jumlah_siswa >= k.kapasitas
              return (
                <div key={k.id} className="flex items-center gap-2 p-2 rounded-md border border-slate-100 hover:bg-slate-50 transition-colors">
                  <Checkbox id={`p-${k.id}`} checked={selectedKelasIds.includes(k.id)} onCheckedChange={() => handleToggleKelas(k.id)} disabled={isFull} />
                  <Label htmlFor={`p-${k.id}`} className={`flex-1 flex justify-between text-xs cursor-pointer ${isFull ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>
                    {k.nama}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isFull ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'}`}>
                      {k.jumlah_siswa}/{k.kapasitas}
                    </span>
                  </Label>
                </div>
              )
            })}
          </div>
          <Button onClick={jalankanSimulasi} disabled={isSimulating || !selectedKelasIds.length}
            className="w-full h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md mt-3">
            {isSimulating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shuffle className="h-3.5 w-3.5" />}
            Jalankan Algoritma Acak
          </Button>
        </div>
      </div>

      {/* Panel kanan */}
      <div className="xl:col-span-2">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
          <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-700">Preview Hasil Pengacakan</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Siswa diacak silang L/P dalam jurusan yang sama.</p>
            </div>
            {simulasiResult.length > 0 && (
              <Button onClick={simpanPermanen} disabled={isSaving} size="sm"
                className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shrink-0">
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Simpan Permanen
              </Button>
            )}
          </div>
          <div className="flex-1 relative">
            {successMsg ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-emerald-50 p-8">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                <p className="text-sm font-semibold text-emerald-800">Berhasil!</p>
                <p className="text-xs text-emerald-600 mt-1">{successMsg}</p>
              </div>
            ) : simulasiResult.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                <Shuffle className="h-8 w-8 mb-2 text-slate-300" />
                <p className="text-xs text-slate-400">Belum ada simulasi.</p>
              </div>
            ) : (
              <div className="overflow-auto h-full">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50 z-10">
                    <TableRow>
                      <TableHead className="text-xs h-9">Nama Siswa</TableHead>
                      <TableHead className="text-xs h-9 text-center w-24">Lama (11)</TableHead>
                      <TableHead className="text-xs h-9 w-8"></TableHead>
                      <TableHead className="text-xs h-9 text-right pr-4">Baru (12)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulasiResult.map(res => (
                      <TableRow key={res.siswa_id} className="hover:bg-slate-50/50">
                        <TableCell className="text-xs font-medium text-slate-800 py-2">
                          {res.nama_lengkap}
                          <span className="ml-1.5 text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{res.jk}</span>
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">{res.kelas_lama}</span>
                        </TableCell>
                        <TableCell className="py-2 text-slate-300">
                          <ArrowRight className="h-3.5 w-3.5 mx-auto" />
                        </TableCell>
                        <TableCell className="text-right py-2 pr-4">
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">{res.kelas_nama}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}