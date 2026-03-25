// Lokasi: app/dashboard/tka/components/tab-mapel-pilihan.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Save, Loader2, CheckCircle2, AlertCircle, Users, X } from 'lucide-react'
import {
  getSiswaByKelasForTka,
  searchSiswaKelas12ForTka,
  batchSaveMapelPilihan,
} from '../actions'
import type { KelasItem, TkaMapelRow } from '../actions'
import { MAPEL_PILIHAN_OPTIONS } from '../constants'
import { cn } from '@/lib/utils'

interface Props {
  tahunAjaranId: string
  kelasList: KelasItem[]
  userRole: string
}

type LocalRow = TkaMapelRow & { _dirty?: boolean }

const NONE_VALUE = '__none__'

// Urutkan kelas: nomor_kelas numerik ASC, lalu kelompok ASC
function sortKelasList(list: KelasItem[]): KelasItem[] {
  return [...list].sort((a, b) => {
    const na = parseInt(a.nomor_kelas, 10)
    const nb = parseInt(b.nomor_kelas, 10)
    if (na !== nb) return na - nb
    return a.kelompok.localeCompare(b.kelompok)
  })
}

export function TabMapelPilihan({ tahunAjaranId, kelasList, userRole }: Props) {
  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [searchQuery, setSearchQuery]         = useState('')
  const [rows, setRows]                       = useState<LocalRow[]>([])
  const [loading, setLoading]                 = useState(false)
  const [saving, setSaving]                   = useState(false)
  const [mode, setMode]                       = useState<'idle' | 'kelas' | 'search'>('idle')
  const [toast, setToast]                     = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const sortedKelas = sortKelasList(kelasList)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const handleKelasChange = useCallback(async (kelasId: string) => {
    setSelectedKelasId(kelasId)
    setSearchQuery('')
    setMode('kelas')
    setRows([])
    if (!kelasId) return
    setLoading(true)
    try {
      const data = await getSiswaByKelasForTka(kelasId, tahunAjaranId)
      setRows(data.map(r => ({ ...r, _dirty: false })))
    } catch (e: any) {
      showToast('error', `Gagal memuat siswa: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [tahunAjaranId])

  const handleSearch = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const q = searchQuery.trim()
    if (!q) return
    setSelectedKelasId('')
    setMode('search')
    setRows([])
    setLoading(true)
    try {
      const data = await searchSiswaKelas12ForTka(q, tahunAjaranId)
      setRows(data.map(r => ({ ...r, _dirty: false })))
    } catch (e: any) {
      showToast('error', `Gagal mencari siswa: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, tahunAjaranId])

  const handleClearSearch = () => {
    setSearchQuery('')
    setRows([])
    setMode('idle')
  }

  const updateRow = (siswaId: string, field: 'mapel_pilihan1' | 'mapel_pilihan2', value: string) => {
    setRows(prev => prev.map(r =>
      r.siswa_id === siswaId
        ? { ...r, [field]: value === NONE_VALUE ? null : value, _dirty: true }
        : r
    ))
  }

  const dirtyRows = rows.filter(r => r._dirty)

  const handleSave = async () => {
    if (!dirtyRows.length) return
    setSaving(true)
    try {
      const result = await batchSaveMapelPilihan(
        dirtyRows.map(r => ({
          siswa_id:       r.siswa_id,
          mapel_pilihan1: r.mapel_pilihan1 ?? null,
          mapel_pilihan2: r.mapel_pilihan2 ?? null,
        })),
        tahunAjaranId
      )
      if (result.success) {
        setRows(prev => prev.map(r => ({ ...r, _dirty: false })))
        showToast('success', `${result.saved} data berhasil disimpan`)
      } else {
        showToast('error', result.error ?? 'Gagal menyimpan')
      }
    } finally {
      setSaving(false)
    }
  }

  const kelasLabel = (k: KelasItem) => `${k.tingkat}-${k.nomor_kelas} ${k.kelompok}`

  return (
    <div className="space-y-4">

      {/* Toast */}
      {toast && (
        <div className={cn(
          'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border',
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400'
            : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400'
        )}>
          {toast.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Dropdown kelas — sorted by nomor_kelas numerik */}
        <Select value={selectedKelasId} onValueChange={handleKelasChange}>
          <SelectTrigger className="sm:w-56 text-sm bg-white dark:bg-slate-900">
            <SelectValue placeholder="Pilih Kelas 12..." />
          </SelectTrigger>
          <SelectContent>
            {sortedKelas.map(k => (
              <SelectItem key={k.id} value={k.id}>{kelasLabel(k)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <Input
            ref={searchRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Cari nama / NISN, Enter..."
            className="pl-8 pr-8 text-sm bg-white dark:bg-slate-900"
          />
          {searchQuery && (
            <button onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Tombol simpan — warna sky eksplisit agar tidak ikut --primary hitam */}
        <Button
          onClick={handleSave}
          disabled={dirtyRows.length === 0 || saving}
          size="sm"
          className="sm:ml-auto bg-sky-500 hover:bg-sky-600 text-white disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
        >
          {saving
            ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            : <Save className="h-3.5 w-3.5 mr-1.5" />}
          Simpan{dirtyRows.length > 0 ? ` (${dirtyRows.length})` : ''}
        </Button>
      </div>

      {/* Dirty hint */}
      {dirtyRows.length > 0 && (
        <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          {dirtyRows.length} perubahan belum disimpan — klik <strong>Simpan</strong>.
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <Users className="h-10 w-10 text-slate-300 mb-3" />
          {mode === 'idle' && (
            <><p className="text-slate-500 font-medium text-sm">Pilih kelas atau cari nama siswa</p></>
          )}
          {mode === 'kelas' && (
            <p className="text-slate-500 font-medium text-sm">Tidak ada siswa aktif di kelas ini</p>
          )}
          {mode === 'search' && (
            <p className="text-slate-500 font-medium text-sm">Siswa tidak ditemukan</p>
          )}
        </div>
      )}

      {/* ── DESKTOP: tabel (md ke atas) ── */}
      {!loading && rows.length > 0 && (
        <>
          <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5 w-10">#</th>
                    <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5">Nama Siswa</th>
                    <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5 w-[200px]">Mapel Pilihan 1</th>
                    <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-4 py-2.5 w-[200px]">Mapel Pilihan 2</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.siswa_id}
                      className={cn(
                        'border-b border-slate-100 dark:border-slate-800 transition-colors',
                        row._dirty
                          ? 'bg-amber-50/60 dark:bg-amber-950/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                      )}>
                      <td className="px-4 py-2 text-xs text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {row._dirty && <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />}
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm leading-tight">{row.nama_lengkap}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{row.nisn}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <MapelSelect
                          value={row.mapel_pilihan1 ?? NONE_VALUE}
                          onChange={val => updateRow(row.siswa_id, 'mapel_pilihan1', val)}
                          placeholder="Pilih Mapel 1..."
                          excludeValue={row.mapel_pilihan2 ?? undefined}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <MapelSelect
                          value={row.mapel_pilihan2 ?? NONE_VALUE}
                          onChange={val => updateRow(row.siswa_id, 'mapel_pilihan2', val)}
                          placeholder="Pilih Mapel 2..."
                          excludeValue={row.mapel_pilihan1 ?? undefined}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-400">
              <span>{rows.length} siswa</span>
              {dirtyRows.length > 0 && <span className="text-amber-500">{dirtyRows.length} belum disimpan</span>}
            </div>
          </div>

          {/* ── MOBILE: card list (di bawah md) ── */}
          <div className="md:hidden space-y-2">
            {rows.map((row, idx) => (
              <div key={row.siswa_id}
                className={cn(
                  'rounded-xl border p-3 transition-colors',
                  row._dirty
                    ? 'border-amber-200 bg-amber-50/60 dark:bg-amber-950/10 dark:border-amber-800'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                )}>
                {/* Header card */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-slate-400 w-5 shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {row._dirty && <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />}
                      <p className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">{row.nama_lengkap}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">{row.nisn}</p>
                  </div>
                </div>

                {/* Dropdown mapel — full width di mobile */}
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Mapel Pilihan 1</p>
                    <MapelSelect
                      value={row.mapel_pilihan1 ?? NONE_VALUE}
                      onChange={val => updateRow(row.siswa_id, 'mapel_pilihan1', val)}
                      placeholder="Pilih Mapel 1..."
                      excludeValue={row.mapel_pilihan2 ?? undefined}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1">Mapel Pilihan 2</p>
                    <MapelSelect
                      value={row.mapel_pilihan2 ?? NONE_VALUE}
                      onChange={val => updateRow(row.siswa_id, 'mapel_pilihan2', val)}
                      placeholder="Pilih Mapel 2..."
                      excludeValue={row.mapel_pilihan1 ?? undefined}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="text-xs text-slate-400 text-center py-1">
              {rows.length} siswa{dirtyRows.length > 0 ? ` · ${dirtyRows.length} belum disimpan` : ''}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── MapelSelect ───────────────────────────────────────────────────────

function MapelSelect({
  value, onChange, placeholder, excludeValue,
}: {
  value: string
  onChange: (val: string) => void
  placeholder: string
  excludeValue?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs w-full bg-white dark:bg-slate-900">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>
          <span className="text-slate-400 italic">— Belum ditentukan —</span>
        </SelectItem>
        {MAPEL_PILIHAN_OPTIONS
          .filter(m => m !== excludeValue)
          .map(m => (
            <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
          ))}
      </SelectContent>
    </Select>
  )
}
