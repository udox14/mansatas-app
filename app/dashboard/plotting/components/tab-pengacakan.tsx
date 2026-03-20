// Lokasi: app/dashboard/plotting/components/tab-pengacakan.tsx
'use client'

import { useState, useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Save, CheckCircle2, ArrowRight, Shuffle } from 'lucide-react'
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

  // FIX: field 'nama' sudah ada dari actions.ts — localeCompare aman
  const sortedKelas = useMemo(() =>
    [...kelasList].sort((a, b) => (a.nama ?? '').localeCompare(b.nama ?? '', undefined, { numeric: true, sensitivity: 'base' })),
    [kelasList]
  )

  const handleToggleKelas = (id: string) =>
    setSelectedKelasIds(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id])

  const handleSelectAll = () =>
    setSelectedKelasIds(selectedKelasIds.length === sortedKelas.length ? [] : sortedKelas.map(k => k.id))

  const jalankanSimulasi = () => {
    setIsSimulating(true); setSimulasiResult([]); setSuccessMsg('')
    setTimeout(() => {
      const targetKelas = sortedKelas
        .filter(k => selectedKelasIds.includes(k.id))
        .map(k => ({ ...k, sisa: k.kapasitas - k.jumlah_siswa }))

      const hasil: HasilType[] = []
      let sisaSiswa = 0, errMsg = ''

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
      <p className="text-sm font-medium text-slate-700">Tidak ada data kelas 11</p>
      <p className="text-xs text-slate-400">Semua sudah dinaikkan atau belum ada data.</p>
    </div>
  )

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

      {/* Panel kiri */}
      <div className="space-y-3">
        {/* Info sumber */}
        <div className="rounded-lg border border-surface bg-surface p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Sumber (kelas 11)</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set(siswaList.map(s => s.kelompok))).map(k => (
              <div key={k} className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-semibold px-2 py-1 rounded">
                {k}: {siswaList.filter(s => s.kelompok === k).length}
              </div>
            ))}
            <div className="bg-surface-3 text-slate-600 text-[10px] font-semibold px-2 py-1 rounded">
              Total: {siswaList.length}
            </div>
          </div>
        </div>

        {/* Pilih kelas */}
        <div className="rounded-lg border border-surface bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Wadah kelas 12</p>
            <Button variant="outline" size="sm" onClick={handleSelectAll}
              className="h-6 text-[10px] px-2 rounded border-surface text-slate-600 hover:bg-surface-2">
              {selectedKelasIds.length === sortedKelas.length ? 'Batal semua' : 'Pilih semua'}
            </Button>
          </div>
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {sortedKelas.map(k => {
              const full = k.jumlah_siswa >= k.kapasitas
              return (
                <div key={k.id} className="flex items-center gap-2.5 p-2 rounded-md hover:bg-surface-2 border border-transparent hover:border-surface-2 transition-colors">
                  <Checkbox id={`p-${k.id}`} checked={selectedKelasIds.includes(k.id)} onCheckedChange={() => handleToggleKelas(k.id)} disabled={full} />
                  <Label htmlFor={`p-${k.id}`} className={`flex-1 flex items-center justify-between text-xs cursor-pointer ${full ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>
                    <span>{k.nama}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${full ? 'bg-rose-50 text-rose-500' : 'bg-surface-3 text-slate-500'}`}>
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
            Jalankan algoritma acak
          </Button>
        </div>
      </div>

      {/* Panel kanan - preview */}
      <div className="xl:col-span-2">
        <div className="rounded-lg border border-surface bg-surface flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-2">
            <div>
              <p className="text-xs font-semibold text-slate-700">Preview hasil pengacakan</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Siswa diacak silang L/P dalam jurusan yang sama</p>
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
                <p className="text-sm font-semibold text-emerald-800">Berhasil!</p>
                <p className="text-xs text-emerald-600">{successMsg}</p>
              </div>
            ) : !simulasiResult.length ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Shuffle className="h-8 w-8 text-slate-300" />
                <p className="text-xs">Belum ada simulasi dijalankan</p>
              </div>
            ) : (
              <div className="overflow-auto h-full max-h-[500px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
                    <TableRow>
                      <TableHead className="text-xs h-9">Nama siswa</TableHead>
                      <TableHead className="text-xs h-9 text-center w-24">Lama (11)</TableHead>
                      <TableHead className="text-xs h-9 w-8 text-center"></TableHead>
                      <TableHead className="text-xs h-9 text-right pr-4">Baru (12)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulasiResult.map(r => (
                      <TableRow key={r.siswa_id} className="hover:bg-surface-2/50">
                        <TableCell className="text-xs font-medium text-slate-800 py-2">
                          {r.nama_lengkap}
                          <span className="ml-1.5 text-[9px] font-bold bg-surface-3 text-slate-500 px-1 py-0.5 rounded">{r.jk}</span>
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <span className="text-[10px] font-medium text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">{r.kelas_lama}</span>
                        </TableCell>
                        <TableCell className="text-center py-2 text-slate-300">
                          <ArrowRight className="h-3 w-3 mx-auto" />
                        </TableCell>
                        <TableCell className="text-right py-2 pr-4">
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
