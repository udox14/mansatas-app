// Lokasi: app/dashboard/plotting/components/tab-siswa-baru.tsx
'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Play, Save, CheckCircle2, UserPlus } from 'lucide-react'
import { simpanPlottingMassal } from '../actions'

type SiswaType = { id: string; nama_lengkap: string; nisn: string; jenis_kelamin: string }
type KelasType = { id: string; nama: string; kapasitas: number; jumlah_siswa: number }
type HasilPlottingType = { siswa_id: string; nama_lengkap: string; jk: string; kelas_id: string; kelas_nama: string }

export function TabSiswaBaru({ siswaList, kelasList }: { siswaList: SiswaType[]; kelasList: KelasType[] }) {
  const [selectedKelasIds, setSelectedKelasIds] = useState<string[]>([])
  const [simulasiResult, setSimulasiResult] = useState<HasilPlottingType[]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const handleToggleKelas = (id: string) =>
    setSelectedKelasIds(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id])

  const jalankanSimulasi = () => {
    setIsSimulating(true); setSimulasiResult([]); setSuccessMsg('')
    setTimeout(() => {
      const selectedKelas = kelasList
        .filter(k => selectedKelasIds.includes(k.id))
        .map(k => ({ ...k, sisa: k.kapasitas - k.jumlah_siswa }))

      if (!selectedKelas.length) { alert('Pilih minimal satu kelas tujuan!'); setIsSimulating(false); return }

      const siswaL = [...siswaList].filter(s => s.jenis_kelamin === 'L').sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
      const siswaP = [...siswaList].filter(s => s.jenis_kelamin === 'P').sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))

      const hasil: HasilPlottingType[] = []
      let ki = 0, sisa = 0

      const assign = (siswa: SiswaType) => {
        for (let i = 0; i < selectedKelas.length; i++) {
          const t = selectedKelas[ki]
          ki = (ki + 1) % selectedKelas.length
          if (t.sisa > 0) {
            hasil.push({ siswa_id: siswa.id, nama_lengkap: siswa.nama_lengkap, jk: siswa.jenis_kelamin, kelas_id: t.id, kelas_nama: t.nama })
            t.sisa--; return
          }
        }
        sisa++
      }

      siswaL.forEach(assign); siswaP.forEach(assign)
      if (sisa > 0) alert(`Peringatan: ${sisa} siswa tidak kebagian kursi!`)
      setSimulasiResult(hasil); setIsSimulating(false)
    }, 400)
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
    <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-surface text-center gap-3">
      <div className="p-3 rounded-full bg-emerald-50"><CheckCircle2 className="h-6 w-6 text-emerald-500" /></div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Semua siswa sudah terploting</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">Tidak ada siswa baru / tanpa kelas saat ini.</p>
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* Panel kiri */}
      <div className="space-y-3">
        {/* Info sumber */}
        <div className="rounded-lg border border-surface bg-surface p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Sumber data</p>
          <p className="text-sm text-slate-600 dark:text-slate-300 dark:text-slate-600 mb-3">
            <span className="font-semibold text-slate-900 dark:text-slate-50">{siswaList.length}</span> siswa baru siap disebar
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-center">
              <p className="text-lg font-bold text-blue-700">{siswaList.filter(s => s.jenis_kelamin === 'L').length}</p>
              <p className="text-[10px] text-blue-500 font-medium">Laki-laki</p>
            </div>
            <div className="rounded-md bg-pink-50 border border-pink-100 px-3 py-2 text-center">
              <p className="text-lg font-bold text-pink-700">{siswaList.filter(s => s.jenis_kelamin === 'P').length}</p>
              <p className="text-[10px] text-pink-500 font-medium">Perempuan</p>
            </div>
          </div>
        </div>

        {/* Pilih kelas */}
        <div className="rounded-lg border border-surface bg-surface p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Wadah kelas 10</p>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {kelasList.map(k => {
              const full = k.jumlah_siswa >= k.kapasitas
              return (
                <div key={k.id} className="flex items-center gap-2.5 p-2 rounded-md hover:bg-surface-2 border border-transparent hover:border-surface-2 transition-colors">
                  <Checkbox id={`k-${k.id}`} checked={selectedKelasIds.includes(k.id)} onCheckedChange={() => handleToggleKelas(k.id)} disabled={full} />
                  <Label htmlFor={`k-${k.id}`} className={`flex-1 flex items-center justify-between text-xs cursor-pointer ${full ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200 font-medium'}`}>
                    <span>{k.nama}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${full ? 'bg-rose-50 text-rose-500' : 'bg-surface-3 text-slate-500 dark:text-slate-400 dark:text-slate-500'}`}>
                      {k.jumlah_siswa}/{k.kapasitas}
                    </span>
                  </Label>
                </div>
              )
            })}
          </div>
        </div>

        <Button
          onClick={jalankanSimulasi}
          disabled={isSimulating || !selectedKelasIds.length}
          className="w-full h-9 text-sm gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
        >
          {isSimulating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Jalankan Algoritma
        </Button>
      </div>

      {/* Panel kanan - preview */}
      <div className="lg:col-span-2">
        <div className="rounded-lg border border-surface bg-surface flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-2">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Preview hasil simulasi</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Cek distribusi L/P sebelum simpan permanen</p>
            </div>
            {simulasiResult.length > 0 && (
              <Button onClick={simpanPermanen} disabled={isSaving} size="sm"
                className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md">
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Simpan permanen
              </Button>
            )}
          </div>

          <div className="flex-1 relative">
            {successMsg ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-emerald-50/60">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-sm font-semibold text-emerald-800">Plotting berhasil!</p>
                <p className="text-xs text-emerald-600">{successMsg}</p>
              </div>
            ) : simulasiResult.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
                <UserPlus className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="text-xs">Belum ada simulasi dijalankan</p>
              </div>
            ) : (
              <div className="overflow-auto h-full max-h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
                    <TableRow>
                      <TableHead className="text-xs h-9 w-10 text-center">#</TableHead>
                      <TableHead className="text-xs h-9">Nama siswa</TableHead>
                      <TableHead className="text-xs h-9 text-center w-16">L/P</TableHead>
                      <TableHead className="text-xs h-9 text-right pr-4">Ditempatkan di</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulasiResult.map((r, i) => (
                      <TableRow key={r.siswa_id} className="hover:bg-surface-2/50">
                        <TableCell className="text-center text-xs text-slate-400 dark:text-slate-500 py-2">{i + 1}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-800 dark:text-slate-100 py-2">{r.nama_lengkap}</TableCell>
                        <TableCell className="text-center py-2">
                          <span className="text-[10px] font-bold bg-surface-3 text-slate-600 dark:text-slate-300 dark:text-slate-600 px-1.5 py-0.5 rounded">{r.jk}</span>
                        </TableCell>
                        <TableCell className="text-right pr-4 py-2">
                          <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">{r.kelas_nama}</span>
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
