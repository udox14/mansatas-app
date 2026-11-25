// Lokasi: app/dashboard/tka/components/tab-rekap.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Combobox } from '@/components/ui/combobox'
import { DataPagination, usePagination } from '@/components/ui/data-pagination'
import {
  Loader2, RefreshCw, Users, BookMarked, Hash, Printer, Search, X, Table2, BarChart3,
} from 'lucide-react'
import {
  getRekapMapelPilihan,
  getSiswaRekapTka,
  getRekapRencanaPascaLulus,
} from '../actions'
import type { KelasItem, TkaRekapItem, TkaSiswaRekapRow, RekapFilter, RencanaRekapItem } from '../actions'
import { MAPEL_PILIHAN_OPTIONS_SORTED } from '../constants'
import { naturalSort } from '@/lib/natural-sort'
import { cn } from '@/lib/utils'
import { CetakRekapModal, type CetakMode } from './cetak-rekap-modal'
import { RENCANA_LABEL, RENCANA_OPTIONS } from '@/lib/pendidikan-lanjutan'
import { usePendidikanLanjutanData } from '@/lib/pendidikan-lanjutan-client'
import type { RencanaKategori } from '@/lib/pendidikan-lanjutan'

interface Props {
  tahunAjaranId: string
  tahunAjaranLabel: string
  kelasList: KelasItem[]
}

type View = 'jumlah' | 'kelas' | 'mapel' | 'rencana'

const PAGE_SIZE_OPTIONS = [50, 100] as const

const kelasLabel = (k: KelasItem) => `${k.tingkat}-${k.nomor_kelas} ${k.kelompok}`
const rowKelasLabel = (r: { tingkat: number | null; nomor_kelas: string | null; kelompok: string | null }) =>
  r.tingkat ? `${r.tingkat}-${r.nomor_kelas} ${r.kelompok}` : '-'

const VIEW_BUTTONS: { key: View; label: string; icon: React.ReactNode }[] = [
  { key: 'jumlah', label: 'Jumlah per Mapel', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { key: 'kelas', label: 'Per Kelas', icon: <Users className="h-3.5 w-3.5" /> },
  { key: 'mapel', label: 'Per Mapel', icon: <Table2 className="h-3.5 w-3.5" /> },
  { key: 'rencana', label: 'Rencana Lulusan', icon: <BookMarked className="h-3.5 w-3.5" /> },
]

export function TabRekap({ tahunAjaranId, tahunAjaranLabel, kelasList }: Props) {
  const { kampusList, prodiByKampus } = usePendidikanLanjutanData()
  const [view, setView] = useState<View>('jumlah')
  const [kelasFilter, setKelasFilter] = useState('')
  const [mapelFilter, setMapelFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [rencanaFilter, setRencanaFilter] = useState('')
  const [kampusFilter, setKampusFilter] = useState('')
  const [prodiFilter, setProdiFilter] = useState('')

  const [jumlah, setJumlah] = useState<TkaRekapItem[] | null>(null)
  const [rencanaJumlah, setRencanaJumlah] = useState<RencanaRekapItem[]>([])
  const [rows, setRows] = useState<TkaSiswaRekapRow[]>([])
  const [loading, setLoading] = useState(false)

  // Print
  const [printOpen, setPrintOpen] = useState(false)
  const [printMode, setPrintMode] = useState<CetakMode>('jumlah')
  const [printSession, setPrintSession] = useState(0)

  // Detail dialog (klik baris jumlah)
  const [detail, setDetail] = useState<{ mapel: string } | null>(null)

  // Pagination
  const pg = usePagination(50)

  const sortedKelas = useMemo(() => naturalSort(kelasList, k => `${k.tingkat}|${k.nomor_kelas}|${k.kelompok}`), [kelasList])

  // ============================================================
  // Load rekap jumlah (lazy: saat tab rekap aktif pertama kali)
  // ============================================================
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([getRekapMapelPilihan(tahunAjaranId), getRekapRencanaPascaLulus(tahunAjaranId)])
      .then(([data, rencana]) => { if (!cancelled) { setJumlah(data); setRencanaJumlah(rencana) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tahunAjaranId])

  // ============================================================
  // Load daftar siswa per filter (lazy, otomatis saat filter berubah)
  // ============================================================
  useEffect(() => {
    if (view === 'jumlah') return
    let cancelled = false
    setLoading(true)
    const filter: RekapFilter = {}
    if (view === 'kelas' && kelasFilter) filter.kelas_id = kelasFilter
    if (view === 'mapel') {
      if (mapelFilter) filter.mapel = mapelFilter
    }
    if (view === 'rencana') {
      if (rencanaFilter) filter.rencana = rencanaFilter as RencanaKategori
      if (kampusFilter) filter.kampus_id = kampusFilter
      if (prodiFilter) filter.prodi = prodiFilter
    }
    if (search) filter.search = search
    getSiswaRekapTka(tahunAjaranId, filter)
      .then(data => {
        if (cancelled) return
        setRows(data)
        pg.reset()
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, kelasFilter, mapelFilter, rencanaFilter, kampusFilter, prodiFilter, search, tahunAjaranId])

  const applySearch = () => {
    setSearch(searchInput.trim())
  }

  const resetFilters = () => {
    setKelasFilter('')
    setMapelFilter('')
    setSearchInput('')
    setSearch('')
    setRencanaFilter(''); setKampusFilter(''); setProdiFilter('')
  }

  const openPrint = (mode: CetakMode) => {
    setPrintMode(mode)
    setPrintSession(s => s + 1)
    setPrintOpen(true)
  }

  // ============================================================
  // Data turunan
  // ============================================================
  const jumlahRows = useMemo(() => {
    if (!jumlah) return []
    return naturalSort(jumlah, item => item.mapel)
  }, [jumlah])

  const totalSelections = useMemo(() => jumlahRows.reduce((sum, row) => sum + Number(row.jumlah || 0), 0), [jumlahRows])

  const sortedRows = useMemo(() => {
    return naturalSort(rows, r => r.nama_lengkap)
  }, [rows])

  const paginatedRows = useMemo(() => {
    if (pg.pageSize === 'semua') return sortedRows
    const start = (pg.page - 1) * (pg.pageSize as number)
    return sortedRows.slice(start, start + (pg.pageSize as number))
  }, [sortedRows, pg.page, pg.pageSize])

  const pageStart = pg.pageSize === 'semua' ? 0 : (pg.page - 1) * (pg.pageSize as number)

  return (
    <div className="space-y-4">
      {/* View switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-0.5 overflow-x-auto">
          {VIEW_BUTTONS.map(b => (
            <button
              key={b.key}
              onClick={() => setView(b.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                view === b.key
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              {b.icon}
              {b.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => openPrint(view === 'rencana' ? 'kelas' : view)}>
            <Printer className="h-3.5 w-3.5 text-violet-500" />
            Cetak
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8"
            disabled={loading}
            onClick={() => {
              setLoading(true)
              if (view === 'jumlah') {
                getRekapMapelPilihan(tahunAjaranId)
                  .then(setJumlah)
                  .finally(() => setLoading(false))
              } else {
                const filter: RekapFilter = {}
                if (view === 'kelas' && kelasFilter) filter.kelas_id = kelasFilter
                if (view === 'mapel') {
                  if (mapelFilter) filter.mapel = mapelFilter
                }
                if (view === 'rencana') {
                  if (rencanaFilter) filter.rencana = rencanaFilter as RencanaKategori
                  if (kampusFilter) filter.kampus_id = kampusFilter
                  if (prodiFilter) filter.prodi = prodiFilter
                }
                if (search) filter.search = search
                getSiswaRekapTka(tahunAjaranId, filter)
                  .then(setRows)
                  .finally(() => setLoading(false))
              }
            }}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      {view !== 'jumlah' && (
        <div className="flex flex-col sm:flex-row gap-2">
          {view === 'kelas' && (
            <Combobox value={kelasFilter} onValueChange={setKelasFilter} options={sortedKelas.map(k => ({ value: k.id, label: kelasLabel(k) }))} placeholder="Semua Kelas" searchPlaceholder="Cari kelas..." className="sm:w-52" clearable />
          )}

          {view === 'mapel' && (
            <Combobox value={mapelFilter} onValueChange={setMapelFilter} options={MAPEL_PILIHAN_OPTIONS_SORTED.map(m => ({ value: m, label: m }))} placeholder="Semua Mapel" searchPlaceholder="Cari mapel..." className="sm:w-56" clearable />
          )}

          {view === 'rencana' && <>
            <Combobox value={rencanaFilter} onValueChange={setRencanaFilter} options={RENCANA_OPTIONS} placeholder="Semua Rencana" searchPlaceholder="Cari rencana..." className="sm:w-56" clearable />
            <Combobox value={kampusFilter} onValueChange={value => { setKampusFilter(value); setProdiFilter('') }} options={kampusList.map(k => ({ value: k.id, label: k.nama, keywords: `${k.singkatan} ${k.kota}`, description: k.kota }))} placeholder="Semua Perguruan Tinggi" searchPlaceholder="Cari perguruan tinggi..." className="sm:w-64" maxResults={60} clearable />
            <Combobox value={prodiFilter} onValueChange={setProdiFilter} options={(kampusFilter ? prodiByKampus[kampusFilter] ?? [] : []).map(p => ({ value: p.nama, label: `${p.nama} (${p.jenjang})` }))} placeholder={kampusFilter ? 'Semua Prodi' : 'Pilih kampus dahulu'} searchPlaceholder="Cari prodi..." className="sm:w-56" disabled={!kampusFilter} clearable />
          </>}

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <Input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applySearch() }}
              placeholder="Cari nama / NISN..."
              className="pl-8 pr-8 h-8 text-xs bg-white dark:bg-slate-900"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearch('') }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {(kelasFilter || mapelFilter || rencanaFilter || kampusFilter || prodiFilter || search) && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-500" onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      )}

      {/* Info singkat */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        {view === 'jumlah' && jumlah && (
          <span>
            <Hash className="inline h-3 w-3 text-violet-500 mr-1" />
            {totalSelections} total pemilihan mapel dari {jumlahRows.length} mata pelajaran
          </span>
        )}
        {view !== 'jumlah' && (
          <span>
            <Users className="inline h-3 w-3 text-violet-500 mr-1" />
            {rows.length} siswa
          </span>
        )}
      </div>

      {view === 'rencana' && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{RENCANA_OPTIONS.map(option => {
        const count = rencanaJumlah.find(item => item.kategori === option.value)?.jumlah ?? 0
        return <button key={option.value} onClick={() => setRencanaFilter(rencanaFilter === option.value ? '' : option.value)} className={cn('rounded-lg border p-2 text-left', rencanaFilter === option.value ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900')}><p className="text-[10px] text-slate-500">{option.label}</p><p className="text-lg font-bold text-slate-800 dark:text-slate-200">{count}</p></button>
      })}</div>}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      )}

      {/* ============================================================
          VIEW: JUMLAH PER MAPEL
      ============================================================ */}
      {!loading && view === 'jumlah' && (
        jumlahRows.length === 0 ? (
          <EmptyState text="Belum ada data pemilihan mapel siswa" />
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5 w-10">#</th>
                    <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Mata Pelajaran</th>
                    <th className="text-right text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Jumlah Siswa</th>
                  </tr>
                </thead>
                <tbody>
                  {jumlahRows.map((r, idx) => (
                    <tr
                      key={r.mapel}
                      onClick={() => setDetail({ mapel: r.mapel })}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-violet-50/40 dark:hover:bg-violet-950/20 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2 text-xs text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{r.mapel}</td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-800 dark:text-slate-200">{r.jumlah}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400">
              Klik baris untuk melihat detail siswa per mapel
            </div>
          </div>
        )
      )}

      {/* ============================================================
          VIEW: PER KELAS
      ============================================================ */}
      {!loading && view === 'kelas' && (
        rows.length === 0 ? (
          <EmptyState text="Belum ada siswa yang memilih mapel" />
        ) : (
          <div className="space-y-3">
            <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5 w-10">#</th>
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">NISN</th>
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Nama Siswa</th>
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">JK</th>
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Kelas</th>
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Mapel TKA</th>
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Rencana</th>
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Pilihan Pendidikan 1</th>
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Pilihan Pendidikan 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((r, idx) => (
                      <tr key={r.siswa_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2 text-xs text-slate-400">{pageStart + idx + 1}</td>
                        <td className="px-4 py-2 text-xs font-mono text-slate-500 dark:text-slate-400">{r.nisn}</td>
                        <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{r.nama_lengkap}</td>
                        <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{r.jenis_kelamin}</td>
                        <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{rowKelasLabel(r)}</td>
                        <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300"><p>{r.mapel_pilihan1 || '-'}</p><p>{r.mapel_pilihan2 || '-'}</p></td>
                        <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">{RENCANA_LABEL[r.rencana_kategori ?? 'KULIAH']}</td>
                        <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">{r.pilihan1_kampus_nama || '-'}{r.pilihan1_prodi ? ` · ${r.pilihan1_prodi}` : ''}</td>
                        <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">{r.pilihan2_kampus_nama || '-'}{r.pilihan2_prodi ? ` · ${r.pilihan2_prodi}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DataPagination
                total={sortedRows.length}
                page={pg.page}
                pageSize={pg.pageSize}
                onPageChange={pg.setPage}
                onPageSizeChange={pg.setPageSize}
                entityLabel="siswa"
                pageSizeOptions={PAGE_SIZE_OPTIONS}
              />
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {paginatedRows.map((r, idx) => (
                <div key={r.siswa_id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200 text-sm leading-tight">{r.nama_lengkap}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{r.nisn}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">{rowKelasLabel(r)}</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/50">
                    <p className="text-[10px] font-semibold uppercase text-slate-400">Mapel TKA</p>
                    <p className="mt-0.5 text-slate-700 dark:text-slate-200">{[r.mapel_pilihan1, r.mapel_pilihan2].filter(Boolean).join(' · ') || '-'}</p>
                  </div>
                </div>
              ))}
            </div>

            {sortedRows.length > (pg.pageSize === 'semua' ? Infinity : (pg.pageSize as number)) && (
              <div className="md:hidden">
                <DataPagination
                  total={sortedRows.length}
                  page={pg.page}
                  pageSize={pg.pageSize}
                  onPageChange={pg.setPage}
                  onPageSizeChange={pg.setPageSize}
                  entityLabel="siswa"
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                />
              </div>
            )}
          </div>
        )
      )}

      {/* ============================================================
          VIEW: PER MAPEL
      ============================================================ */}
      {!loading && view === 'mapel' && (
        rows.length === 0 ? (
          <EmptyState text={mapelFilter ? `Belum ada siswa untuk mapel ${mapelFilter}` : 'Belum ada siswa yang memilih mapel TKA'} />
        ) : (
          <div className="space-y-3">
            <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[680px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5 w-10">#</th>
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Mapel</th>
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">NISN</th>
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Nama Siswa</th>
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">JK</th>
                      <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Kelas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((r, idx) => {
                      const mapelVal = mapelFilter || [r.mapel_pilihan1, r.mapel_pilihan2].filter(Boolean).join(' · ')
                      return (
                        <tr key={r.siswa_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-2 text-xs text-slate-400">{pageStart + idx + 1}</td>
                          <td className="px-4 py-2 text-xs font-medium text-violet-600 dark:text-violet-400">{mapelVal}</td>
                          <td className="px-4 py-2 text-xs font-mono text-slate-500 dark:text-slate-400">{r.nisn}</td>
                          <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{r.nama_lengkap}</td>
                          <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{r.jenis_kelamin}</td>
                          <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{rowKelasLabel(r)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <DataPagination
                total={sortedRows.length}
                page={pg.page}
                pageSize={pg.pageSize}
                onPageChange={pg.setPage}
                onPageSizeChange={pg.setPageSize}
                entityLabel="siswa"
                pageSizeOptions={PAGE_SIZE_OPTIONS}
              />
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {paginatedRows.map((r, idx) => {
                const mapelVal = mapelFilter || [r.mapel_pilihan1, r.mapel_pilihan2].filter(Boolean).join(' · ')
                return (
                  <div key={r.siswa_id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm leading-tight">{r.nama_lengkap}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{r.nisn}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">{rowKelasLabel(r)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800 line-clamp-1">
                        {mapelVal}
                      </span>
                      <span className="text-[10px] text-slate-400">JK {r.jenis_kelamin}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {sortedRows.length > (pg.pageSize === 'semua' ? Infinity : (pg.pageSize as number)) && (
              <div className="md:hidden">
                <DataPagination
                  total={sortedRows.length}
                  page={pg.page}
                  pageSize={pg.pageSize}
                  onPageChange={pg.setPage}
                  onPageSizeChange={pg.setPageSize}
                  entityLabel="siswa"
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                />
              </div>
            )}
          </div>
        )
      )}

      {!loading && view === 'rencana' && (
        rows.length === 0 ? <EmptyState text="Belum ada data rencana setelah lulus" /> : <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-sm"><thead><tr className="border-b bg-slate-50 dark:bg-slate-800/50">
              {['#', 'NISN', 'Nama Siswa', 'Kelas', 'Rencana', 'Pilihan Pendidikan 1', 'Pilihan Pendidikan 2', 'Catatan'].map(label => <th key={label} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">{label}</th>)}
            </tr></thead><tbody>{paginatedRows.map((row, index) => <tr key={row.siswa_id} className="border-b border-slate-100 align-top dark:border-slate-800">
              <td className="px-3 py-2 text-xs text-slate-400">{pageStart + index + 1}</td><td className="px-3 py-2 font-mono text-xs text-slate-500">{row.nisn}</td><td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{row.nama_lengkap}</td><td className="px-3 py-2 text-xs text-slate-500">{rowKelasLabel(row)}</td>
              <td className="px-3 py-2 text-xs">{RENCANA_LABEL[row.rencana_kategori ?? 'KULIAH']}</td>
              <td className="px-3 py-2 text-xs"><p className="font-medium">{row.pilihan1_kampus_nama || '-'}</p><p className="text-slate-500">{row.pilihan1_prodi || ''}</p></td>
              <td className="px-3 py-2 text-xs"><p className="font-medium">{row.pilihan2_kampus_nama || '-'}</p><p className="text-slate-500">{row.pilihan2_prodi || ''}</p></td>
              <td className="max-w-[220px] px-3 py-2 text-xs text-slate-500">{row.rencana_catatan || '-'}</td>
            </tr>)}</tbody></table></div>
            <DataPagination total={sortedRows.length} page={pg.page} pageSize={pg.pageSize} onPageChange={pg.setPage} onPageSizeChange={pg.setPageSize} entityLabel="siswa" pageSizeOptions={PAGE_SIZE_OPTIONS} />
          </div>
        </div>
      )}

      {/* Modal detail siswa per mapel */}
      <DetailDialog
        tahunAjaranId={tahunAjaranId}
        detail={detail}
        onClose={() => setDetail(null)}
      />

      {/* Modal cetak */}
      <CetakRekapModal
        key={printSession}
        open={printOpen}
        onOpenChange={setPrintOpen}
        initialMode={printMode}
        tahunAjaranId={tahunAjaranId}
        tahunAjaranLabel={tahunAjaranLabel}
        initialKelas={view === 'kelas' ? kelasFilter : ''}
      />
    </div>
  )
}

// ============================================================
// Empty state
// ============================================================
function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
      <BookMarked className="h-10 w-10 text-slate-300 mb-3" />
      <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">{text}</p>
    </div>
  )
}

// ============================================================
// Detail dialog: daftar siswa pemilih mapel
// ============================================================
function DetailDialog({
  tahunAjaranId,
  detail,
  onClose,
}: {
  tahunAjaranId: string
  detail: { mapel: string } | null
  onClose: () => void
}) {
  const [rows, setRows] = useState<TkaSiswaRekapRow[]>([])
  const [loading, setLoading] = useState(false)
  const pg = usePagination(50)

  useEffect(() => {
    if (!detail) return
    let cancelled = false
    setLoading(true)
    setRows([])
    pg.reset()
    getSiswaRekapTka(tahunAjaranId, { mapel: detail.mapel })
      .then(data => { if (!cancelled) setRows(data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, tahunAjaranId])

  const sortedRows = useMemo(() => naturalSort(rows, r => r.nama_lengkap), [rows])

  const paginated = useMemo(() => {
    if (pg.pageSize === 'semua') return sortedRows
    const start = (pg.page - 1) * (pg.pageSize as number)
    return sortedRows.slice(start, start + (pg.pageSize as number))
  }, [sortedRows, pg.page, pg.pageSize])

  const pageStart = pg.pageSize === 'semua' ? 0 : (pg.page - 1) * (pg.pageSize as number)

  return (
    <Dialog open={!!detail} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Siswa Pemilih: {detail?.mapel}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : sortedRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Belum ada siswa</p>
        ) : (
          <>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{sortedRows.length} siswa</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left py-1.5 pr-2">#</th>
                    <th className="text-left py-1.5 pr-2">NISN</th>
                    <th className="text-left py-1.5 pr-2">Nama</th>
                    <th className="text-left py-1.5 pr-2">JK</th>
                    <th className="text-left py-1.5">Kelas</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r, i) => (
                    <tr key={r.siswa_id} className="border-b border-slate-50 dark:border-slate-800">
                      <td className="py-1.5 pr-2 text-xs text-slate-400">{pageStart + i + 1}</td>
                      <td className="py-1.5 pr-2 text-xs font-mono text-slate-500 dark:text-slate-400">{r.nisn}</td>
                      <td className="py-1.5 pr-2 font-medium text-slate-800 dark:text-slate-200">{r.nama_lengkap}</td>
                      <td className="py-1.5 pr-2 text-xs text-slate-500 dark:text-slate-400">{r.jenis_kelamin}</td>
                      <td className="py-1.5 text-xs text-slate-500 dark:text-slate-400">{rowKelasLabel(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DataPagination
              total={sortedRows.length}
              page={pg.page}
              pageSize={pg.pageSize}
              onPageChange={pg.setPage}
              onPageSizeChange={pg.setPageSize}
              entityLabel="siswa"
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
