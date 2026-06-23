// Lokasi: app/dashboard/plotting/components/tab-penjurusan.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Play, Save, CheckCircle2, ArrowRight, Filter, AlertCircle, Search, BarChart3, Users } from 'lucide-react'
import { simpanPlottingMassal, setDraftPenjurusan } from '../actions'
import { CetakPenjurusanModal } from './cetak-penjurusan-modal'

type SiswaType = { id: string; nama_lengkap: string; nisn: string; nis_lokal?: string | null; jenis_kelamin: string; kelas_lama: string; minat_jurusan?: string | null }
type KelasType = { id: string; nama: string; kelompok: string; kapasitas: number; jumlah_siswa: number }
type HasilPlottingType = { siswa_id: string; nama_lengkap: string; jk: string; kelas_lama: string; kelas_id: string; kelas_nama: string }
type PlottingContext = { source_tahun_ajaran_id: string; target_tahun_ajaran_id: string; source_tahun_ajaran_label?: string }

// ── Palet warna per jurusan ────────────────────────────────────────────────
const JURUSAN_COLOR: Record<string, { bg: string; bar: string; text: string; border: string }> = {
  IPA:        { bg: 'bg-sky-50 dark:bg-sky-950/40',       bar: 'bg-sky-500',      text: 'text-sky-700 dark:text-sky-300',      border: 'border-sky-200 dark:border-sky-800' },
  SOSHUM:     { bg: 'bg-amber-50 dark:bg-amber-950/40',   bar: 'bg-amber-500',    text: 'text-amber-700 dark:text-amber-300',  border: 'border-amber-200 dark:border-amber-800' },
  KEAGAMAAN:  { bg: 'bg-emerald-50 dark:bg-emerald-950/40', bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  IPS:        { bg: 'bg-orange-50 dark:bg-orange-950/40', bar: 'bg-orange-500',   text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
  BAHASA:     { bg: 'bg-purple-50 dark:bg-purple-950/40', bar: 'bg-purple-500',   text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
}
const DEFAULT_COLOR = { bg: 'bg-slate-50 dark:bg-slate-800/50', bar: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' }

const KUOTA_PER_KELAS = 36

function StatistikSebaran({
  siswaList, penjurusan, opsiJurusan, kelasList, selectedKelasIds,
}: {
  siswaList: SiswaType[]
  penjurusan: Record<string, string>
  opsiJurusan: string[]
  kelasList: KelasType[]
  selectedKelasIds: string[]
}) {
  const stats = useMemo(() => {
    const map: Record<string, { total: number; L: number; P: number }> = {}
    opsiJurusan.forEach(j => { map[j] = { total: 0, L: 0, P: 0 } })
    siswaList.forEach(s => {
      const jur = penjurusan[s.id]
      if (!jur) return
      if (!map[jur]) map[jur] = { total: 0, L: 0, P: 0 }
      map[jur].total++
      if (s.jenis_kelamin === 'L') map[jur].L++
      else map[jur].P++
    })
    return opsiJurusan.map(j => ({ jurusan: j, ...map[j] }))
  }, [siswaList, penjurusan, opsiJurusan])

  // Kuota kelas per jurusan: dari kelas yang sudah dicentang
  const kuotaPerJurusan = useMemo(() => {
    const map: Record<string, { kelasCount: number; kapasitasSisa: number }> = {}
    opsiJurusan.forEach(j => { map[j] = { kelasCount: 0, kapasitasSisa: 0 } })
    kelasList.forEach(k => {
      if (!selectedKelasIds.includes(k.id)) return
      const jur = k.kelompok
      if (!map[jur]) map[jur] = { kelasCount: 0, kapasitasSisa: 0 }
      map[jur].kelasCount++
      map[jur].kapasitasSisa += (k.kapasitas - k.jumlah_siswa)
    })
    return map
  }, [kelasList, selectedKelasIds, opsiJurusan])

  const totalSiap  = useMemo(() => Object.keys(penjurusan).length, [penjurusan])
  const totalSiswa = siswaList.length
  const belum      = totalSiswa - totalSiap
  const maxCount   = Math.max(...stats.map(s => s.total), 1)

  return (
    <div className="rounded-lg border border-surface bg-surface p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-violet-100 dark:bg-violet-950/50">
            <BarChart3 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Sebaran jurusan pilihan</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Distribusi & kebutuhan kelas sebelum plotting</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <Users className="h-3 w-3" />
          <span><span className="font-semibold text-slate-700 dark:text-slate-200">{totalSiap}</span>/{totalSiswa} siap</span>
        </div>
      </div>

      {/* Bar chart per jurusan */}
      <div className="flex flex-col gap-2">
        {stats.map(s => {
          const col    = JURUSAN_COLOR[s.jurusan] ?? DEFAULT_COLOR
          const pct    = totalSiswa > 0 ? Math.round((s.total / totalSiswa) * 100) : 0
          const barW   = maxCount > 0 ? Math.round((s.total / maxCount) * 100) : 0
          const label  = s.jurusan === 'SOSHUM' ? 'Soshum' : s.jurusan === 'KEAGAMAAN' ? 'Keagamaan' : s.jurusan

          // Kuota & status
          const kelasPerlu    = s.total > 0 ? Math.ceil(s.total / KUOTA_PER_KELAS) : 0
          const kuota         = kuotaPerJurusan[s.jurusan] ?? { kelasCount: 0, kapasitasSisa: 0 }
          const selisihSiswa  = kuota.kapasitasSisa - s.total   // + = masih ada ruang, - = over
          const adaKelas      = kuota.kelasCount > 0
          const status: 'pas' | 'lebih' | 'kurang' | 'belum' =
            !adaKelas          ? 'belum' :
            selisihSiswa === 0 ? 'pas'   :
            selisihSiswa > 0   ? 'lebih' : 'kurang'

          const statusStyle = {
            pas:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
            lebih:  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
            kurang: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
            belum:  'bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400',
          }[status]

          const statusLabel = {
            pas:    '✓ Pas',
            lebih:  `+${selisihSiswa} sisa`,
            kurang: `${selisihSiswa} kurang`,
            belum:  'Pilih kelas',
          }[status]

          return (
            <div key={s.jurusan} className={`rounded-md border ${col.border} ${col.bg} p-2.5`}>
              {/* Baris 1: nama jurusan + L/P + total + % */}
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-bold tracking-wide uppercase ${col.text}`}>{label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                    <span className="text-sky-600 dark:text-sky-400">♂{s.L}</span>
                    {' · '}
                    <span className="text-pink-600 dark:text-pink-400">♀{s.P}</span>
                  </span>
                  <span className={`text-xs font-bold ${col.text}`}>{s.total}</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500">({pct}%)</span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-white/60 dark:bg-black/20 overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${col.bar}`}
                  style={{ width: `${barW}%` }}
                />
              </div>
              {/* Baris 2: info kuota kelas */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
                  <span className="font-medium">Butuh</span>
                  <span className={`font-bold px-1 py-0.5 rounded ${col.text} bg-white/50 dark:bg-black/20`}>
                    {kelasPerlu} kelas
                  </span>
                  {adaKelas && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span>Dipilih</span>
                      <span className="font-bold">{kuota.kelasCount} kelas</span>
                      <span className="text-slate-300 dark:text-slate-600">(cap. {kuota.kapasitasSisa})</span>
                    </>
                  )}
                </div>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${statusStyle}`}>
                  {statusLabel}
                </span>
              </div>
            </div>
          )
        })}

        {/* Belum diset */}
        {belum > 0 && (
          <div className="flex items-center justify-between rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5">
            <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">Belum diset</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-300">{belum}</span>
              <span className="text-[9px] text-rose-400">siswa</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalSiap === 0 && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-1">
            Belum ada jurusan pilihan yang ditetapkan
          </p>
        )}
      </div>
    </div>
  )
}

export function TabPenjurusan({
  siswaList, kelasList, daftarJurusan = [], plottingContext
}: {
  siswaList: SiswaType[]; kelasList: KelasType[]; daftarJurusan?: string[]; plottingContext: PlottingContext
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

  const [filterKelas, setFilterKelas] = useState('NONE')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [searchSiswa, setSearchSiswa] = useState('')
  const [selectedJurusan, setSelectedJurusan] = useState('')
  const [searchJurusanSiswa, setSearchJurusanSiswa] = useState('')
  const [selectedKelasIds, setSelectedKelasIds] = useState<string[]>([])
  const [simulasiResult, setSimulasiResult] = useState<HasilPlottingType[]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const [hasRunSimulation, setHasRunSimulation] = useState(false)
  const [savingJurusanIds, setSavingJurusanIds] = useState<Record<string, boolean>>({})
  const [isSavingPermanent, setIsSavingPermanent] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [previewKelasId, setPreviewKelasId] = useState('ALL')
  const isSavingDraft = useMemo(() => Object.values(savingJurusanIds).some(Boolean), [savingJurusanIds])

  const opsiJurusan = useMemo(() => daftarJurusan.filter(j => j !== 'UMUM'), [daftarJurusan])

  useEffect(() => {
    if (!selectedJurusan || (selectedJurusan !== 'UNSET' && !opsiJurusan.includes(selectedJurusan))) {
      setSelectedJurusan(opsiJurusan[0] || 'UNSET')
    }
  }, [opsiJurusan, selectedJurusan])

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
  const hasilPlottingBySiswa = useMemo(() => {
    const map: Record<string, HasilPlottingType> = {}
    simulasiResult.forEach(r => { map[r.siswa_id] = r })
    return map
  }, [simulasiResult])
  const previewKelasOptions = useMemo(() =>
    Array.from(new Map(simulasiResult.map(r => [r.kelas_id, r.kelas_nama])).entries())
      .map(([id, nama]) => ({ id, nama }))
      .sort((a, b) => a.nama.localeCompare(b.nama, undefined, { numeric: true, sensitivity: 'base' })),
    [simulasiResult]
  )
  const filteredSimulasiResult = useMemo(() =>
    previewKelasId === 'ALL' ? simulasiResult : simulasiResult.filter(r => r.kelas_id === previewKelasId),
    [simulasiResult, previewKelasId]
  )

  const jurusanCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    opsiJurusan.forEach(j => { counts[j] = 0 })
    let unset = 0
    siswaList.forEach(s => {
      const jur = penjurusan[s.id]
      if (!jur) unset++
      else counts[jur] = (counts[jur] || 0) + 1
    })
    return { counts, unset }
  }, [siswaList, penjurusan, opsiJurusan])

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

  const displayedJurusanSiswa = useMemo(() => {
    const q = searchJurusanSiswa.trim().toLowerCase()
    return siswaList.filter(s => {
      const jur = penjurusan[s.id] || 'UNSET'
      const matchJurusan = jur === selectedJurusan
      const matchSearch = !q || s.nama_lengkap.toLowerCase().includes(q) || s.nisn.includes(q)
      return matchJurusan && matchSearch
    })
  }, [siswaList, penjurusan, selectedJurusan, searchJurusanSiswa])

  const handleToggleKelas = (id: string) =>
    setSelectedKelasIds(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id])

  const setSiswaJurusan = async (siswaId: string, jurusan: string | null) => {
    const previousJurusan = penjurusan[siswaId] || null
    setPenjurusan(prev => {
      const next = { ...prev }
      if (!jurusan) delete next[siswaId]
      else next[siswaId] = jurusan
      return next
    })
    setSavingJurusanIds(prev => ({ ...prev, [siswaId]: true }))
    setSaveStatus('Menyimpan...')

    const res = await setDraftPenjurusan(siswaId, jurusan, plottingContext) as { error?: string; success?: boolean }
    if (res.error) {
      setPenjurusan(prev => {
        const next = { ...prev }
        if (!previousJurusan) delete next[siswaId]
        else next[siswaId] = previousJurusan
        return next
      })
      setSaveStatus('')
      alert(res.error)
    } else {
      setSaveStatus('Tersimpan otomatis')
      setTimeout(() => setSaveStatus(''), 2000)
    }

    setSavingJurusanIds(prev => {
      const next = { ...prev }
      delete next[siswaId]
      return next
    })
  }

  const jalankanSimulasi = () => {
    if (isSavingDraft) { alert("Tunggu pilihan jurusan selesai tersimpan otomatis sebelum simulasi."); return }
    setIsSimulating(true); setHasRunSimulation(false); setSimulasiResult([]); setSuccessMsg(''); setPreviewKelasId('ALL')
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
      if (!siap.length) { alert('Belum ada siswa yang diberi jurusan pilihan.'); setIsSimulating(false); return }

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
    const res = await simpanPlottingMassal(
      simulasiResult.map(r => ({ siswa_id: r.siswa_id, kelas_id: r.kelas_id })),
      plottingContext
    )
    if (res.error) alert(res.error)
    else { setSuccessMsg(res.success!); setSimulasiResult([]); setPenjurusan({}); setHasRunSimulation(false) }
    setIsSavingPermanent(false)
  }

  if (!siswaList.length) return (
    <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-dashed border-surface text-center gap-3">
      <div className="p-3 rounded-full bg-emerald-50 dark:bg-emerald-950/50"><CheckCircle2 className="h-6 w-6 text-emerald-500" /></div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-slate-200">Semua siswa sudah terploting</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">Tidak ada data siswa kelas 10 yang perlu dijuruskan.</p>
    </div>
  )

  const jumlahSiap = Object.keys(penjurusan).length
  const belumDiset = siswaList.length - jumlahSiap

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

      {/* PANEL KIRI — jurusan pilihan */}
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-surface bg-surface p-4">

          {/* Header + counter */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">1. Tetapkan jurusan pilihan</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Pilih kelas asal untuk mulai menjuruskan siswa</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <div className="text-center px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100">
                <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 leading-none">{jumlahSiap}</p>
                <p className="text-[9px] text-emerald-500 font-medium mt-0.5">Siap plot</p>
              </div>
              <div className="text-center px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-100">
                <p className="text-base font-bold text-rose-700 leading-none">{belumDiset}</p>
                <p className="text-[9px] text-rose-500 font-medium mt-0.5">Belum diset</p>
              </div>
            </div>
            <div className="shrink-0">
              <CetakPenjurusanModal
                siswaList={siswaList}
                penjurusan={penjurusan}
                tahunAjaranLabel={plottingContext.source_tahun_ajaran_label}
              />
            </div>
          </div>

          <Tabs defaultValue="tiket" className="w-full">
            <TabsList className="mb-3 grid h-auto w-full grid-cols-2 rounded-lg border border-surface bg-surface-2 p-1">
              <TabsTrigger value="tiket" className="rounded-md py-1.5 text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                Pilihan Siswa
              </TabsTrigger>
              <TabsTrigger value="jurusan" className="rounded-md py-1.5 text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                Per Jurusan
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tiket" className="m-0 focus-visible:ring-0">
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

          {/* Status auto-save pilihan jurusan */}
          {saveStatus && (
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium mb-2">
              {isSavingDraft ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} {saveStatus}
            </div>
          )}

          {/* Tabel siswa */}
          <div className="rounded-md border border-surface overflow-hidden">
            <div className="overflow-auto max-h-[440px]">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800/95 backdrop-blur-sm z-10">
                  <TableRow>
                    <TableHead className="text-xs h-8 pl-3">Siswa & kelas asal</TableHead>
                    <TableHead className="text-xs h-8 text-right pr-3 min-w-[200px]">Jurusan pilihan</TableHead>
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
                    const isSavingJurusan = !!savingJurusanIds[s.id]
                    const isPlotted = plottedIds.has(s.id)
                    const failed = hasRunSimulation && hasTicket && !isPlotted
                    return (
                      <TableRow key={s.id} className={`${failed ? 'bg-rose-50/50' : isPlotted ? 'bg-emerald-50 dark:bg-emerald-950/50/30' : hasTicket ? 'bg-violet-50/20' : 'hover:bg-surface-2/50'} transition-colors`}>
                        <TableCell className="pl-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-xs font-medium ${failed ? 'text-rose-800' : 'text-slate-800 dark:text-slate-200 dark:text-slate-100'} truncate max-w-[140px]`}>{s.nama_lengkap}</p>
                            {isSavingJurusan && <Loader2 className="h-3 w-3 animate-spin text-violet-500 shrink-0" />}
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
                                <button key={jur} onClick={() => setSiswaJurusan(s.id, isActive ? null : jur)} title={jur} disabled={isSavingJurusan}
                                  className={`px-2 py-1 text-[9px] font-semibold rounded transition-all border ${
                                    isActive
                                      ? 'bg-violet-600 text-white border-violet-700 scale-105'
                                      : 'bg-surface-2 text-slate-500 dark:text-slate-400 dark:text-slate-500 border-surface hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 disabled:opacity-50'
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
            </TabsContent>

            <TabsContent value="jurusan" className="m-0 focus-visible:ring-0">
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {opsiJurusan.map(jur => {
                    const active = selectedJurusan === jur
                    const col = JURUSAN_COLOR[jur] ?? DEFAULT_COLOR
                    return (
                      <button
                        key={jur}
                        type="button"
                        onClick={() => setSelectedJurusan(jur)}
                        className={`rounded-md border px-2 py-2 text-left transition ${
                          active ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40' : `${col.border} ${col.bg} hover:border-violet-300`
                        }`}
                      >
                        <span className={`block truncate text-[10px] font-bold uppercase ${active ? 'text-violet-700 dark:text-violet-300' : col.text}`}>{jur}</span>
                        <span className="mt-1 block text-xs font-bold text-slate-800 dark:text-slate-100">{jurusanCounts.counts[jur] || 0} siswa</span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setSelectedJurusan('UNSET')}
                    className={`rounded-md border px-2 py-2 text-left transition ${
                      selectedJurusan === 'UNSET'
                        ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40'
                        : 'border-rose-200 bg-rose-50/70 hover:border-rose-300 dark:border-rose-900 dark:bg-rose-950/20'
                    }`}
                  >
                    <span className="block truncate text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">Belum diset</span>
                    <span className="mt-1 block text-xs font-bold text-slate-800 dark:text-slate-100">{jurusanCounts.unset} siswa</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <Input
                    placeholder="Cari siswa di jurusan ini..."
                    value={searchJurusanSiswa}
                    onChange={e => setSearchJurusanSiswa(e.target.value)}
                    className="pl-8 h-8 text-xs rounded-md"
                  />
                </div>

                {hasRunSimulation && isSavingDraft && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Preview kelas di kanan memakai simulasi lama. Tunggu auto-save selesai lalu jalankan algoritma ulang sebelum simpan permanen.</span>
                  </div>
                )}

                <div className="rounded-md border border-surface overflow-hidden">
                  <div className="overflow-auto max-h-[440px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800/95 backdrop-blur-sm z-10">
                        <TableRow>
                          <TableHead className="text-xs h-8 pl-3">Siswa</TableHead>
                          <TableHead className="text-xs h-8 text-center w-24">Tujuan</TableHead>
                          <TableHead className="text-xs h-8 text-right pr-3 min-w-[150px]">Pindahkan</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedJurusanSiswa.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center text-xs text-slate-400 dark:text-slate-500">
                              Tidak ada siswa di pilihan ini.
                            </TableCell>
                          </TableRow>
                        ) : displayedJurusanSiswa.map(s => {
                          const hasil = hasilPlottingBySiswa[s.id]
                          const isSavingJurusan = !!savingJurusanIds[s.id]
                          return (
                            <TableRow key={s.id} className="hover:bg-surface-2/50">
                              <TableCell className="pl-3 py-2">
                                <div className="flex items-center gap-1.5">
                                  <p className="max-w-[150px] truncate text-xs font-medium text-slate-800 dark:text-slate-100">{s.nama_lengkap}</p>
                                  <span className="rounded bg-surface-3 px-1 py-0.5 text-[9px] font-bold text-slate-500 dark:text-slate-400">{s.jenis_kelamin}</span>
                                </div>
                                <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{s.kelas_lama} | {s.nisn}</p>
                              </TableCell>
                              <TableCell className="py-2 text-center">
                                {hasil ? (
                                  <span className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
                                    {hasil.kelas_nama}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500">-</span>
                                )}
                              </TableCell>
                              <TableCell className="pr-3 py-2">
                                <Select value={penjurusan[s.id] || 'UNSET'} onValueChange={(value) => setSiswaJurusan(s.id, value === 'UNSET' ? null : value)} disabled={isSavingJurusan}>
                                  <SelectTrigger className="ml-auto h-8 w-[140px] rounded-md text-xs">
                                    <SelectValue placeholder="Jurusan" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="UNSET" className="text-xs text-rose-600">Belum diset</SelectItem>
                                    {opsiJurusan.map(jur => (
                                      <SelectItem key={jur} value={jur} className="text-xs">{jur}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* PANEL KANAN — statistik + pilih kelas + preview */}
      <div className="flex flex-col gap-3">

        {/* === STATISTIK SEBARAN TIKET JURUSAN === */}
        <StatistikSebaran
          siswaList={siswaList}
          penjurusan={penjurusan}
          opsiJurusan={opsiJurusan}
          kelasList={kelasList}
          selectedKelasIds={selectedKelasIds}
        />

        {/* Pilih wadah kelas */}
        <div className="rounded-lg border border-surface bg-surface p-4">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 mb-0.5">2. Pilih wadah kelas 11</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Centang kelas tujuan penjurusan</p>
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto mb-3">
            {sortedKelas.map(k => {
              const full = k.jumlah_siswa >= k.kapasitas
              return (
                <div key={k.id} className="flex items-center gap-2 p-2 rounded-md border border-surface-2 hover:bg-surface-2 transition-colors">
                  <Checkbox id={`pj-${k.id}`} checked={selectedKelasIds.includes(k.id)} onCheckedChange={() => handleToggleKelas(k.id)} disabled={full} />
                  <Label htmlFor={`pj-${k.id}`} className={`flex-1 flex items-center justify-between text-xs cursor-pointer ${full ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300 dark:text-slate-200 font-medium'}`}>
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
          <div className="flex flex-col gap-3 px-4 py-3 border-b border-surface-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 dark:text-slate-200">3. Preview sebaran kelas 11</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Siswa diurutkan dan disebar rata (L/P)</p>
            </div>
            {simulasiResult.length > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={previewKelasId} onValueChange={setPreviewKelasId}>
                  <SelectTrigger className="h-8 w-full rounded-md text-xs sm:w-[170px]">
                    <SelectValue placeholder="Filter kelas tujuan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">Semua kelas tujuan</SelectItem>
                    {previewKelasOptions.map(k => (
                      <SelectItem key={k.id} value={k.id} className="text-xs">{k.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={simpanPermanen} disabled={isSavingPermanent || isSavingDraft} size="sm"
                  className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md">
                  {isSavingPermanent ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Simpan permanen
                </Button>
              </div>
            )}
          </div>

          {simulasiResult.length > 0 && isSavingDraft && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[10px] font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              Ada perubahan jurusan pilihan yang sedang tersimpan otomatis. Jalankan algoritma ulang sebelum simpan permanen.
            </div>
          )}

          <div className="flex-1 relative">
            {successMsg ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-emerald-50 dark:bg-emerald-950/50/60">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">Penjurusan berhasil!</p>
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
                  <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800/95 backdrop-blur-sm z-10">
                    <TableRow>
                      <TableHead className="text-xs h-8 pl-3">Nama siswa</TableHead>
                      <TableHead className="text-xs h-8 text-center w-20">Lama</TableHead>
                      <TableHead className="text-xs h-8 w-6"></TableHead>
                      <TableHead className="text-xs h-8 text-right pr-3">Tujuan (11)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSimulasiResult.map(r => (
                      <TableRow key={r.siswa_id} className="hover:bg-surface-2/50">
                        <TableCell className="pl-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 dark:text-slate-100">
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
                          <span className="text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded">{r.kelas_nama}</span>
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
