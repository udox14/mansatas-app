// Lokasi: app/dashboard/plotting/components/tab-penjurusan.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Play, Save, CheckCircle2, ArrowRight, Filter, AlertCircle, Search, Cloud } from 'lucide-react'
import { simpanPlottingMassal, setDraftPenjurusanMassal } from '../actions'

type SiswaType = { id: string; nama_lengkap: string; nisn: string; jenis_kelamin: string; kelas_lama: string; minat_jurusan?: string | null }
type KelasType = { id: string; nama: string; kelompok: string; kapasitas: number; jumlah_siswa: number }
type HasilPlottingType = { siswa_id: string; nama_lengkap: string; jk: string; kelas_lama: string; kelas_id: string; kelas_nama: string }

export function TabPenjurusan({
  siswaList, kelasList, daftarJurusan = []
}: {
  siswaList: SiswaType[]; kelasList: KelasType[]; daftarJurusan?: string[]
}) {
  const [penjurusan, setPenjurusan] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    siswaList.forEach(s => {
      if (s.minat_jurusan) {
        let val = s.minat_jurusan
        if (val === 'AGM') val = 'KEAGAMAAN'
        if (val === 'SOS') val = 'SOSHUM'
        init[s.id] = val
      }
    })
    return init
  })

  useEffect(() => {
    const init: Record<string, string> = {}
    siswaList.forEach(s => {
      if (s.minat_jurusan) {
        let val = s.minat_jurusan
        if (val === 'AGM') val = 'KEAGAMAAN'
        if (val === 'SOS') val = 'SOSHUM'
        init[s.id] = val
      }
    })
    setPenjurusan(init)
  }, [siswaList])

  const hasUnsavedChanges = useMemo(() => {
    for (const s of siswaList) {
      let dbVal = s.minat_jurusan || null
      if (dbVal === 'AGM') dbVal = 'KEAGAMAAN'
      if (dbVal === 'SOS') dbVal = 'SOSHUM'
      if ((penjurusan[s.id] || null) !== dbVal) return true
    }
    return false
  }, [siswaList, penjurusan])

  const [filterKelas, setFilterKelas] = useState('NONE')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [searchSiswa, setSearchSiswa] = useState('')
  const [selectedKelasIds, setSelectedKelasIds] = useState<string[]>([])
  const [simulasiResult, setSimulasiResult] = useState<HasilPlottingType[]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const [hasRunSimulation, setHasRunSimulation] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isSavingPermanent, setIsSavingPermanent] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [saveStatus, setSaveStatus] = useState('')

  const opsiJurusan = useMemo(() => daftarJurusan.filter(j => j !== 'UMUM'), [daftarJurusan])

  const kelasLamaUnik = useMemo(() =>
    Array.from(new Set(siswaList.map(s => s.kelas_lama)))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })),
    [siswaList]
  )

  // FIX: field 'nama' sudah ada dari actions.ts — localeCompare aman
  const sortedKelas = useMemo(() =>
    [...kelasList].sort((a, b) => (a.nama ?? '').localeCompare(b.nama ?? '', undefined, { numeric: true, sensitivity: 'base' })),
    [kelasList]
  )

  const plottedIds = useMemo(() => new Set(simulasiResult.map(r => r.siswa_id)), [simulasiResult])

  const displayedSiswa = useMemo(() => {
    if (filterKelas === 'NONE') return []
    return siswaList.filter(s => {
      const matchKelas = filterKelas === 'ALL' || s.kelas_lama === filterKelas
      const isSet = !!penjurusan[s.id]
      const isPlotted = plottedIds.has(s.id)
      const failed = hasRunSimulation && isSet && !isPlotted
      let matchStatus = true
      if (filterStatus === 'UNSET') matchStatus = !isSet
      if (filterStatus === 'SET') matchStatus = isSet
      if (filterStatus === 'PLOTTED') matchStatus = isPlotted
      if (filterStatus === 'FAILED') matchStatus = failed
      const matchSearch = s.nama_lengkap.toLowerCase().includes(searchSiswa.toLowerCase()) || s.nisn.includes(searchSiswa)
      return matchKelas && matchStatus && matchSearch
    })
  }, [siswaList, filterKelas, filterStatus, penjurusan, plottedIds, hasRunSimulation, searchSiswa])

  const handleToggleKelas = (id: string) =>
    setSelectedKelasIds(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id])

  const handleSimpanDraft = async () => {
    setIsSavingDraft(true); setSaveStatus('Menyimpan...')
    const payload = Object.entries(penjurusan).map(([id, minat_jurusan]) => ({ id, minat_jurusan }))
    siswaList.forEach(s => { if (s.minat_jurusan && !penjurusan[s.id]) payload.push({ id: s.id, minat_jurusan: '' }) })
    const res = await setDraftPenjurusanMassal(payload) as { error?: string; success?: boolean }
    if (res.error) { alert(res.error); setSaveStatus('') }
    else { setSaveStatus('Tersimpan'); setTimeout(() => setSaveStatus(''), 2000) }
    setIsSavingDraft(false)
  }

  const jalankanSimulasi = () => {
    if (hasUnsavedChanges) { alert("Simpan tiket jurusan terlebih dahulu sebelum simulasi!"); return }
    setIsSimulating(true); setHasRunSimulation(false); setSimulasiResult([]); setSuccessMsg('')
    setTimeout(() => {
      const target = sortedKelas.filter(k => selectedKelasIds.includes(k.id)).map(k => ({ ...k, sisa: k.kapasitas - k.jumlah_siswa }))
      const hasil: HasilPlottingType[] = []
      let sisa = 0, err = ''

      const distribute = (group: SiswaType[], kelompok: string) => {
        const wadah = target.filter(k => k.kelompok === kelompok)
        if (group.length && !wadah.length) { err += `\n- Kelas ${kelompok} belum dicentang!`; sisa += group.length; return }
        let ki = 0
        for (const s of group) {
          let ok = false
          for (let i = 0; i < wadah.length; i++) {
            const t = wadah[ki]; ki = (ki + 1) % wadah.length
            if (t.sisa > 0) { hasil.push({ siswa_id: s.id, nama_lengkap: s.nama_lengkap, jk: s.jenis_kelamin, kelas_lama: s.kelas_lama, kelas_id: t.id, kelas_nama: t.nama }); t.sisa--; ok = true; break }
          }
          if (!ok) sisa++
        }
      }

      const siap = siswaList.filter(s => !!penjurusan[s.id])
      if (!siap.length) { alert('Belum ada siswa yang diberi tiket jurusan.'); setIsSimulating(false); return }

      Array.from(new Set(siap.map(s => penjurusan[s.id]))).forEach(kel => {
        const g = siap.filter(s => penjurusan[s.id] === kel)
        distribute(g.filter(s => s.jenis_kelamin === 'L').sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap)), kel)
        distribute(g.filter(s => s.jenis_kelamin === 'P').sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap)), kel)
      })

      if (sisa > 0) alert(`PERINGATAN! ${sisa} siswa gagal di-plot.${err}`)
      setSimulasiResult(hasil); setHasRunSimulation(true); setIsSimulating(false)
    }, 600)
  }

  const simpanPermanen = async () => {
    if (!simulasiResult.length) return
    setIsSavingPermanent(true)
    const res = await simpanPlottingMassal(simulasiResult.map(r => ({ siswa_id: r.siswa_id, kelas_id: r.kelas_id })))
    if (res.error) alert(res.error)
    else { setSuccessMsg(res.success!); setSimulasiResult([]); setPenjurusan({}); setHasRunSimulation(false) }
    setIsSavingPermanent(false)
  }

  if (!siswaList.length) return (
    <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-surface text-center gap-3">
      <div className="p-3 rounded-full bg-emerald-50"><CheckCircle2 className="h-6 w-6 text-emerald-500" /></div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Semua siswa sudah terploting</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">Tidak ada data siswa kelas 10 yang perlu dijuruskan.</p>
    </div>
  )

  const jumlahSiap = Object.keys(penjurusan).length
  const belumDiset = siswaList.length - jumlahSiap

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

      {/* PANEL KIRI — tiket jurusan */}
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-surface bg-surface p-4">

          {/* Header + counter */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">1. Tetapkan tiket jurusan</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Pilih kelas asal untuk mulai menjuruskan siswa</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <div className="text-center px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
                <p className="text-base font-bold text-emerald-700 leading-none">{jumlahSiap}</p>
                <p className="text-[9px] text-emerald-500 font-medium mt-0.5">Siap plot</p>
              </div>
              <div className="text-center px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-100">
                <p className="text-base font-bold text-rose-700 leading-none">{belumDiset}</p>
                <p className="text-[9px] text-rose-500 font-medium mt-0.5">Belum diset</p>
              </div>
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-col gap-2 mb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <Input placeholder="Cari nama / NISN..." value={searchSiswa}
                onChange={e => setSearchSiswa(e.target.value)}
                className="pl-8 h-8 text-xs rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterKelas} onValueChange={setFilterKelas}>
                <SelectTrigger className={`h-8 text-xs rounded-md ${filterKelas === 'NONE' ? 'border-violet-300 text-violet-700 bg-violet-50' : ''}`}>
                  <SelectValue placeholder="Pilih kelas asal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE" disabled className="text-xs text-slate-400 dark:text-slate-500 italic">— Pilih kelas —</SelectItem>
                  <SelectItem value="ALL" className="text-xs font-medium">Semua kelas (berat)</SelectItem>
                  {kelasLamaUnik.map(k => <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs rounded-md"><SelectValue placeholder="Semua status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">Semua status</SelectItem>
                  <SelectItem value="UNSET" className="text-xs text-rose-600">Belum diset</SelectItem>
                  <SelectItem value="SET" className="text-xs text-blue-600">Sudah diset</SelectItem>
                  {hasRunSimulation && <>
                    <SelectItem value="PLOTTED" className="text-xs text-emerald-600">Berhasil diplot</SelectItem>
                    <SelectItem value="FAILED" className="text-xs text-rose-600">Gagal / penuh</SelectItem>
                  </>}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tombol simpan draft — muncul hanya bila ada perubahan */}
          {hasUnsavedChanges && (
            <Button onClick={handleSimpanDraft} disabled={isSavingDraft}
              className="w-full h-9 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-md mb-3">
              {isSavingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
              {isSavingDraft ? 'Menyimpan...' : saveStatus || 'Simpan tiket jurusan ke cloud'}
            </Button>
          )}
          {saveStatus && !hasUnsavedChanges && (
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium mb-2">
              <CheckCircle2 className="h-3 w-3" /> {saveStatus}
            </div>
          )}

          {/* Tabel siswa */}
          <div className="rounded-md border border-surface overflow-hidden">
            <div className="overflow-auto max-h-[440px]">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
                  <TableRow>
                    <TableHead className="text-xs h-8 pl-3">Siswa & kelas asal</TableHead>
                    <TableHead className="text-xs h-8 text-right pr-3 min-w-[200px]">Tiket jurusan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterKelas === 'NONE' ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-40 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                          <Filter className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                          <p className="text-xs">Pilih kelas asal di atas untuk memuat data</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : displayedSiswa.length === 0 ? (
                    <TableRow><TableCell colSpan={2} className="text-center text-xs text-slate-400 dark:text-slate-500 h-20">Tidak ada siswa yang cocok.</TableCell></TableRow>
                  ) : displayedSiswa.map(s => {
                    const hasTicket = !!penjurusan[s.id]
                    const isPlotted = plottedIds.has(s.id)
                    const failed = hasRunSimulation && hasTicket && !isPlotted
                    return (
                      <TableRow key={s.id} className={`${failed ? 'bg-rose-50/50' : isPlotted ? 'bg-emerald-50/30' : hasTicket ? 'bg-violet-50/20' : 'hover:bg-surface-2/50'} transition-colors`}>
                        <TableCell className="pl-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-xs font-medium ${failed ? 'text-rose-800' : 'text-slate-800 dark:text-slate-100'} truncate max-w-[140px]`}>{s.nama_lengkap}</p>
                            {isPlotted && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                            {failed && <AlertCircle className="h-3 w-3 text-rose-500 shrink-0" />}
                          </div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{s.kelas_lama}</p>
                        </TableCell>
                        <TableCell className="pr-3 py-2">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {opsiJurusan.map(jur => {
                              const isActive = penjurusan[s.id] === jur
                              const short = jur === 'SOSHUM' ? 'SOS' : jur === 'KEAGAMAAN' ? 'AGM' : jur.length > 6 ? jur.slice(0, 5) + '..' : jur
                              return (
                                <button key={jur} onClick={() => setPenjurusan(prev => {
                                  const n = { ...prev }
                                  if (n[s.id] === jur) delete n[s.id]; else n[s.id] = jur
                                  return n
                                })} title={jur}
                                  className={`px-2 py-1 text-[9px] font-semibold rounded transition-all border ${
                                    isActive
                                      ? 'bg-violet-600 text-white border-violet-700 scale-105'
                                      : 'bg-surface-2 text-slate-500 dark:text-slate-400 dark:text-slate-500 border-surface hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200'
                                  }`}
                                >{short}</button>
                              )
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL KANAN — pilih kelas + preview */}
      <div className="flex flex-col gap-3">

        {/* Pilih wadah kelas */}
        <div className="rounded-lg border border-surface bg-surface p-4">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">2. Pilih wadah kelas 11</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Centang kelas tujuan penjurusan</p>
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto mb-3">
            {sortedKelas.map(k => {
              const full = k.jumlah_siswa >= k.kapasitas
              return (
                <div key={k.id} className="flex items-center gap-2 p-2 rounded-md border border-surface-2 hover:bg-surface-2 transition-colors">
                  <Checkbox id={`pj-${k.id}`} checked={selectedKelasIds.includes(k.id)} onCheckedChange={() => handleToggleKelas(k.id)} disabled={full} />
                  <Label htmlFor={`pj-${k.id}`} className={`flex-1 flex items-center justify-between text-xs cursor-pointer ${full ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200 font-medium'}`}>
                    <span>{k.nama}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${full ? 'bg-rose-50 text-rose-500' : 'bg-surface-3 text-slate-500 dark:text-slate-400 dark:text-slate-500'}`}>
                      {k.jumlah_siswa}/{k.kapasitas}
                    </span>
                  </Label>
                </div>
              )
            })}
          </div>
          <Button onClick={jalankanSimulasi} disabled={isSimulating || !selectedKelasIds.length || !Object.keys(penjurusan).length}
            className="w-full h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md">
            {isSimulating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Jalankan algoritma penjurusan
          </Button>
        </div>

        {/* Preview hasil */}
        <div className="flex-1 rounded-lg border border-surface bg-surface flex flex-col min-h-[320px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-2">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">3. Preview sebaran kelas 11</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Siswa diurutkan dan disebar rata (L/P)</p>
            </div>
            {simulasiResult.length > 0 && (
              <Button onClick={simpanPermanen} disabled={isSavingPermanent} size="sm"
                className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md">
                {isSavingPermanent ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Simpan permanen
              </Button>
            )}
          </div>

          <div className="flex-1 relative">
            {successMsg ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-emerald-50/60">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-sm font-semibold text-emerald-800">Penjurusan berhasil!</p>
                <p className="text-xs text-emerald-600">{successMsg}</p>
              </div>
            ) : !simulasiResult.length ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
                <Filter className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="text-xs">Belum ada simulasi dijalankan</p>
              </div>
            ) : (
              <div className="overflow-auto h-full max-h-[400px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
                    <TableRow>
                      <TableHead className="text-xs h-8 pl-3">Nama siswa</TableHead>
                      <TableHead className="text-xs h-8 text-center w-20">Lama</TableHead>
                      <TableHead className="text-xs h-8 w-6"></TableHead>
                      <TableHead className="text-xs h-8 text-right pr-3">Tujuan (11)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {simulasiResult.map(r => (
                      <TableRow key={r.siswa_id} className="hover:bg-surface-2/50">
                        <TableCell className="pl-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100">
                          {r.nama_lengkap}
                          <span className="ml-1 text-[9px] font-bold bg-surface-3 text-slate-500 dark:text-slate-400 dark:text-slate-500 px-1 py-0.5 rounded">{r.jk}</span>
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <span className="text-[10px] font-medium text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded">{r.kelas_lama}</span>
                        </TableCell>
                        <TableCell className="text-center py-2 text-slate-300 dark:text-slate-600">
                          <ArrowRight className="h-3 w-3 mx-auto" />
                        </TableCell>
                        <TableCell className="text-right pr-3 py-2">
                          <span className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">{r.kelas_nama}</span>
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
