'use client'

import { useState, useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, GraduationCap, AlertCircle, CheckCircle2, Filter, Search, RotateCcw } from 'lucide-react'
import { batalkanKelulusanMassal, prosesKelulusanMassal } from '../actions'

type SiswaType = {
  id: string
  nama_lengkap: string
  nisn: string
  jenis_kelamin: string
  kelas_lama: string
  kelompok: string
}

type Mode = 'graduate' | 'restore'

export function TabKelulusan({
  siswaList,
  siswaLulusList,
}: {
  siswaList: SiswaType[]
  siswaLulusList: SiswaType[]
}) {
  const defaultMode: Mode = siswaList.length > 0 ? 'graduate' : 'restore'
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [filterKelas, setFilterKelas] = useState('NONE')
  const [searchSiswa, setSearchSiswa] = useState('')

  const activeList = mode === 'graduate' ? siswaList : siswaLulusList
  const kelasLamaUnik = useMemo(() =>
    Array.from(new Set(activeList.map(s => s.kelas_lama))).sort(),
    [activeList]
  )

  const displayedSiswa = useMemo(() => {
    if (filterKelas === 'NONE') return []
    return activeList.filter(s => {
      const matchKelas = filterKelas === 'ALL' || s.kelas_lama === filterKelas
      const matchSearch = s.nama_lengkap.toLowerCase().includes(searchSiswa.toLowerCase()) || s.nisn.includes(searchSiswa)
      return matchKelas && matchSearch
    })
  }, [activeList, filterKelas, searchSiswa])

  const resetSelection = () => {
    setSelectedSiswaIds([])
    setFilterKelas('NONE')
    setSearchSiswa('')
  }

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode)
    resetSelection()
    setSuccessMsg('')
  }

  const handleToggleSiswa = (id: string) =>
    setSelectedSiswaIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])

  const handleSelectAll = () => {
    const ids = displayedSiswa.map(s => s.id)
    const allSelected = ids.length > 0 && ids.every(id => selectedSiswaIds.includes(id))
    if (allSelected) setSelectedSiswaIds(prev => prev.filter(id => !ids.includes(id)))
    else setSelectedSiswaIds(prev => Array.from(new Set([...prev, ...ids])))
  }

  const handleSubmit = async () => {
    if (!selectedSiswaIds.length) return

    const isGraduate = mode === 'graduate'
    const confirmText = isGraduate
      ? `TINDAKAN PENTING!\n\nAnda yakin meluluskan ${selectedSiswaIds.length} siswa?`
      : `Pulihkan ${selectedSiswaIds.length} siswa ke status aktif dan kelas 12 semula?`

    if (!confirm(confirmText)) return

    setIsSubmitting(true)
    const res = isGraduate
      ? await prosesKelulusanMassal(selectedSiswaIds)
      : await batalkanKelulusanMassal(selectedSiswaIds)

    if (res.error) alert(res.error)
    else {
      setSuccessMsg(res.success!)
      resetSelection()
    }
    setIsSubmitting(false)
  }

  const hasGraduateCandidates = siswaList.length > 0
  const hasRestoreCandidates = siswaLulusList.length > 0

  if (!hasGraduateCandidates && !hasRestoreCandidates && !successMsg) return (
    <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-surface text-center gap-3">
      <div className="p-3 rounded-full bg-emerald-50 dark:bg-emerald-950/50"><CheckCircle2 className="h-6 w-6 text-emerald-500" /></div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-slate-200">Tidak ada data kelulusan yang perlu diproses</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">Belum ada siswa aktif kelas 12 maupun data lulus yang bisa dipulihkan dari riwayat aktif.</p>
    </div>
  )

  if (successMsg) return (
    <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50/40 text-center gap-4">
      <div className="p-4 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
        {mode === 'graduate'
          ? <GraduationCap className="h-10 w-10 text-emerald-600" />
          : <RotateCcw className="h-10 w-10 text-emerald-600" />}
      </div>
      <div>
        <p className="text-base font-semibold text-emerald-900">{mode === 'graduate' ? 'Proses kelulusan selesai!' : 'Pemulihan berhasil!'}</p>
        <p className="text-sm text-emerald-600 mt-1">{successMsg}</p>
      </div>
      <Button
        onClick={() => setSuccessMsg('')}
        variant="outline"
        size="sm"
        className="border-emerald-300 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg"
      >
        Selesai
      </Button>
    </div>
  )

  const displayedIds = displayedSiswa.map(s => s.id)
  const isAllSelected = displayedIds.length > 0 && displayedIds.every(id => selectedSiswaIds.includes(id))
  const isGraduateMode = mode === 'graduate'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="space-y-3">
        <div className="rounded-lg border border-surface bg-surface p-4">
          <div className="flex items-center gap-2.5 mb-4">
            <div className={`p-2 rounded-md border ${isGraduateMode ? 'bg-rose-50 border-rose-100' : 'bg-blue-50 border-blue-100'}`}>
              {isGraduateMode
                ? <GraduationCap className="h-4 w-4 text-rose-500" />
                : <RotateCcw className="h-4 w-4 text-blue-500" />}
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">
              {isGraduateMode ? 'Kelulusan kelas 12' : 'Pulihkan kelulusan'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <Button
              type="button"
              variant={isGraduateMode ? 'default' : 'outline'}
              onClick={() => switchMode('graduate')}
              disabled={!hasGraduateCandidates}
              className={isGraduateMode ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''}
            >
              <GraduationCap className="h-3.5 w-3.5 mr-1.5" /> Luluskan
            </Button>
            <Button
              type="button"
              variant={!isGraduateMode ? 'default' : 'outline'}
              onClick={() => switchMode('restore')}
              disabled={!hasRestoreCandidates}
              className={!isGraduateMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Pulihkan
            </Button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mb-4 leading-relaxed">
            {isGraduateMode ? (
              <>
                Ditemukan <span className="font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">{siswaList.length}</span> siswa kelas 12.
                Proses ini mengubah status mereka menjadi <span className="font-semibold">Lulus</span> dan membersihkan data kelas.
              </>
            ) : (
              <>
                Ditemukan <span className="font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">{siswaLulusList.length}</span> siswa lulus
                dengan riwayat kelas 12 pada tahun ajaran aktif. Proses ini mengembalikan status ke <span className="font-semibold">Aktif</span>
                dan mengisi lagi kelas terakhir dari <span className="font-semibold">riwayat_kelas</span>.
              </>
            )}
          </p>

          <div className={`flex items-start gap-2 p-3 rounded-lg border mb-4 ${isGraduateMode ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
            {isGraduateMode
              ? <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              : <RotateCcw className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />}
            <p className={`text-[11px] leading-relaxed ${isGraduateMode ? 'text-amber-700' : 'text-blue-700'}`}>
              {isGraduateMode
                ? <>Lakukan ini <strong>sebelum</strong> menaikkan kelas 11, agar wadah kelas 12 kosong terlebih dahulu.</>
                : <>Pemulihan memakai riwayat kelas tahun ajaran aktif. Kalau riwayat siswa masih utuh, kelas asalnya akan kembali otomatis.</>}
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedSiswaIds.length}
            className={`w-full h-9 text-sm gap-2 text-white rounded-lg ${isGraduateMode ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isSubmitting ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memproses...</>
            ) : isGraduateMode ? (
              <><GraduationCap className="h-3.5 w-3.5" /> Luluskan {selectedSiswaIds.length > 0 ? `${selectedSiswaIds.length} ` : ''}siswa</>
            ) : (
              <><RotateCcw className="h-3.5 w-3.5" /> Pulihkan {selectedSiswaIds.length > 0 ? `${selectedSiswaIds.length} ` : ''}siswa</>
            )}
          </Button>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="rounded-lg border border-surface bg-surface flex flex-col" style={{ height: '520px' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-b border-surface-2">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 dark:text-slate-200">
                {isGraduateMode ? 'Daftar kandidat lulus' : 'Daftar kandidat pemulihan'}
              </p>
              {selectedSiswaIds.length > 0 && (
                <p className={`text-[10px] mt-0.5 font-medium ${isGraduateMode ? 'text-rose-500' : 'text-blue-500'}`}>
                  {selectedSiswaIds.length} siswa dipilih
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                <Input
                  placeholder="Cari nama / NISN..."
                  value={searchSiswa}
                  onChange={e => setSearchSiswa(e.target.value)}
                  className="pl-8 h-8 text-xs rounded-md w-40 sm:w-44"
                />
              </div>
              <Select value={filterKelas} onValueChange={setFilterKelas}>
                <SelectTrigger className="h-8 text-xs rounded-md w-36">
                  <SelectValue placeholder="Pilih kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE" disabled className="text-xs text-slate-400 dark:text-slate-500 italic">- Pilih kelas -</SelectItem>
                  <SelectItem value="ALL" className="text-xs font-medium">Semua kelas</SelectItem>
                  {kelasLamaUnik.map(k => <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800/95 backdrop-blur-sm z-10">
                <TableRow>
                  <TableHead className="w-12 text-center pl-4 h-9">
                    <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} disabled={filterKelas === 'NONE'} />
                  </TableHead>
                  <TableHead className="text-xs h-9">NISN / Nama siswa</TableHead>
                  <TableHead className="text-xs h-9 text-center w-12">L/P</TableHead>
                  <TableHead className="text-xs h-9 text-right pr-4">Kelas akhir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filterKelas === 'NONE' ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                        <Filter className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                        <p className="text-xs">Pilih kelas asal di atas untuk memuat kandidat</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : displayedSiswa.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-xs text-slate-400 dark:text-slate-500 h-24">Tidak ada siswa yang cocok.</TableCell>
                  </TableRow>
                ) : displayedSiswa.map(s => (
                  <TableRow
                    key={s.id}
                    className={`${selectedSiswaIds.includes(s.id) ? (isGraduateMode ? 'bg-rose-50/30' : 'bg-blue-50/30') : 'hover:bg-surface-2/50'} transition-colors`}
                  >
                    <TableCell className="text-center pl-4 py-2">
                      <Checkbox checked={selectedSiswaIds.includes(s.id)} onCheckedChange={() => handleToggleSiswa(s.id)} />
                    </TableCell>
                    <TableCell className="py-2">
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 dark:text-slate-100">{s.nama_lengkap}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{s.nisn}</p>
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <span className="text-[10px] font-bold bg-surface-3 text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600 px-1.5 py-0.5 rounded">{s.jenis_kelamin}</span>
                    </TableCell>
                    <TableCell className="text-right pr-4 py-2">
                      <span className="text-[10px] font-medium bg-surface-3 text-slate-700 dark:text-slate-300 dark:text-slate-200 border border-surface px-2 py-0.5 rounded">{s.kelas_lama}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}
