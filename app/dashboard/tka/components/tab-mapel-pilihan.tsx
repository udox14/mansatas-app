'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock3, Loader2, Search, Users, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
import { naturalSort } from '@/lib/natural-sort'
import {
  RENCANA_OPTIONS,
  findProdiByValue, findProdiValueByName, prodiValue,
} from '@/lib/pendidikan-lanjutan'
import { usePendidikanLanjutanData } from '@/lib/pendidikan-lanjutan-client'
import type { Prodi, RencanaKategori } from '@/lib/pendidikan-lanjutan'
import { MAPEL_PILIHAN_OPTIONS_SORTED } from '../constants'
import { batchSaveMapelPilihan, getSiswaByKelasForTka, searchSiswaKelas12ForTka } from '../actions'
import type { KelasItem, TkaMapelRow } from '../actions'

interface Props { tahunAjaranId: string; kelasList: KelasItem[] }
type LocalRow = TkaMapelRow & { _dirty?: boolean; _version?: number }

const kelasLabel = (k: KelasItem) => `${k.tingkat}-${k.nomor_kelas} ${k.kelompok}`

const toSavePayload = (row: LocalRow) => ({
  siswa_id: row.siswa_id,
  mapel_pilihan1: row.mapel_pilihan1,
  mapel_pilihan2: row.mapel_pilihan2,
  rencana_kategori: row.rencana_kategori ?? 'KULIAH' as const,
  rencana_catatan: row.rencana_catatan,
  pilihan1_kampus_id: row.pilihan1_kampus_id,
  pilihan1_prodi: row.pilihan1_prodi,
  pilihan2_kampus_id: row.pilihan2_kampus_id,
  pilihan2_prodi: row.pilihan2_prodi,
})

export function TabMapelPilihan({ tahunAjaranId, kelasList }: Props) {
  const { kampusList, kampusOptions, prodiByKampus } = usePendidikanLanjutanData()
  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [rows, setRows] = useState<LocalRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'waiting' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [mode, setMode] = useState<'idle' | 'kelas' | 'search'>('idle')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const sortedKelas = useMemo(() => naturalSort(kelasList, k => `${k.tingkat}|${k.nomor_kelas}|${k.kelompok}`), [kelasList])

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }, [])
  const setLoadedRows = useCallback((data: TkaMapelRow[]) => {
    setRows(naturalSort(data.map(row => ({ ...row, _dirty: false, _version: 0 })), row => row.nama_lengkap))
    setSaveState('idle')
    setSaveError('')
  }, [])

  const saveRows = useCallback(async (pendingRows: LocalRow[]) => {
    if (!pendingRows.length) return { success: true, saved: 0 }
    return batchSaveMapelPilihan(pendingRows.map(toSavePayload), tahunAjaranId)
  }, [tahunAjaranId])

  const flushBeforeChangingView = useCallback(async () => {
    const pendingRows = rows.filter(row => row._dirty)
    if (!pendingRows.length) return true
    setSaveState('saving')
    try {
      const result = await saveRows(pendingRows)
      if (!result.success) throw new Error(result.error || 'Gagal menyimpan')
      setSaveState('saved')
      return true
    } catch (error: any) {
      const message = error.message || 'Gagal menyimpan'
      setSaveState('error')
      setSaveError(message)
      showToast('error', `Perubahan belum tersimpan: ${message}`)
      return false
    }
  }, [rows, saveRows, showToast])

  const handleKelasChange = useCallback(async (kelasId: string) => {
    if (!await flushBeforeChangingView()) return
    setSelectedKelasId(kelasId); setSearchQuery(''); setRows([]); setMode(kelasId ? 'kelas' : 'idle')
    if (!kelasId) return
    setLoading(true)
    try { setLoadedRows(await getSiswaByKelasForTka(kelasId, tahunAjaranId)) }
    catch (error: any) { showToast('error', `Gagal memuat siswa: ${error.message}`) }
    finally { setLoading(false) }
  }, [flushBeforeChangingView, setLoadedRows, showToast, tahunAjaranId])

  const handleSearch = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || !searchQuery.trim()) return
    if (!await flushBeforeChangingView()) return
    setSelectedKelasId(''); setRows([]); setMode('search'); setLoading(true)
    try { setLoadedRows(await searchSiswaKelas12ForTka(searchQuery.trim(), tahunAjaranId)) }
    catch (error: any) { showToast('error', `Gagal mencari siswa: ${error.message}`) }
    finally { setLoading(false) }
  }

  const handleClearSearch = async () => {
    if (!await flushBeforeChangingView()) return
    setSearchQuery('')
    setRows([])
    setMode('idle')
    setSaveState('idle')
  }

  const patchRow = (siswaId: string, patch: Partial<LocalRow>) => setRows(current => current.map(row =>
    row.siswa_id === siswaId ? { ...row, ...patch, _dirty: true, _version: (row._version ?? 0) + 1 } : row
  ))
  const setRencana = (row: LocalRow, kategori: RencanaKategori) => {
    if (kategori !== 'KULIAH' && (row.pilihan1_kampus_id || row.pilihan2_kampus_id)
      && !window.confirm('Pilihan perguruan tinggi akan dihapus. Lanjutkan?')) return
    patchRow(row.siswa_id, {
      rencana_kategori: kategori,
      ...(kategori !== 'KULIAH' ? {
        pilihan1_kampus_id: null, pilihan1_kampus_nama: null, pilihan1_prodi: null,
        pilihan2_kampus_id: null, pilihan2_kampus_nama: null, pilihan2_prodi: null,
      } : {}),
    })
  }
  const setKampus = (row: LocalRow, slot: 1 | 2, kampusId: string) => {
    const kampus = kampusList.find(item => item.id === kampusId)
    patchRow(row.siswa_id, slot === 1 ? {
      rencana_kategori: 'KULIAH', rencana_catatan: null,
      pilihan1_kampus_id: kampusId || null, pilihan1_kampus_nama: kampus?.nama ?? null, pilihan1_prodi: null,
    } : {
      rencana_kategori: 'KULIAH', rencana_catatan: null,
      pilihan2_kampus_id: kampusId || null, pilihan2_kampus_nama: kampus?.nama ?? null, pilihan2_prodi: null,
    })
  }

  const dirtyRows = rows.filter(row => row._dirty)
  const dirtySignature = dirtyRows.map(row => `${row.siswa_id}:${row._version ?? 0}`).join('|')

  useEffect(() => {
    if (!dirtyRows.length) return
    const snapshot = dirtyRows.map(row => ({ ...row }))
    setSaveState('waiting')
    setSaveError('')
    let active = true
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(async () => {
      setSaveState('saving')
      try {
        const result = await saveRows(snapshot)
        if (!result.success) throw new Error(result.error || 'Gagal menyimpan')
        if (!active) return
        const versions = new Map(snapshot.map(row => [row.siswa_id, row._version ?? 0]))
        setRows(current => current.map(row =>
          versions.get(row.siswa_id) === (row._version ?? 0) ? { ...row, _dirty: false } : row
        ))
        setSaveState('saved')
      } catch (error: any) {
        if (!active) return
        setSaveState('error')
        setSaveError(error.message || 'Gagal menyimpan')
        retryTimer = setTimeout(() => setRetryKey(value => value + 1), 5000)
      }
    }, 1500)
    return () => {
      active = false
      clearTimeout(timer)
      if (retryTimer) clearTimeout(retryTimer)
    }
  // retryKey intentionally triggers an automatic retry after a failed request.
  }, [dirtySignature, retryKey, saveRows])

  useEffect(() => {
    if (!dirtyRows.length) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [dirtyRows.length])

  return <div className="space-y-4">
    {toast && <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm', toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400')}>
      {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {toast.msg}
    </div>}

    <div className="flex flex-col gap-2 sm:flex-row">
      <Combobox value={selectedKelasId} onValueChange={handleKelasChange} options={sortedKelas.map(k => ({ value: k.id, label: kelasLabel(k) }))} placeholder="Pilih Kelas 12..." searchPlaceholder="Cari kelas..." className="sm:w-56" clearable />
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={handleSearch} placeholder="Cari nama / NISN, Enter..." className="pl-8 pr-8" />
        {searchQuery && <button onClick={handleClearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"><X className="h-3.5 w-3.5" /></button>}
      </div>
      <SaveStatus state={saveState} dirtyCount={dirtyRows.length} error={saveError} />
    </div>

    {loading && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
    {!loading && !rows.length && <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-20 text-center dark:border-slate-800"><Users className="mb-3 h-10 w-10 text-slate-300" /><p className="text-sm font-medium text-slate-500">{mode === 'idle' ? 'Pilih kelas atau cari nama siswa' : 'Siswa tidak ditemukan'}</p></div>}

    {!loading && rows.length > 0 && <>
      <div className="hidden rounded-xl border border-slate-200 dark:border-slate-800 md:block">
        <table className="w-full table-fixed text-xs"><colgroup><col className="w-[3%]" /><col className="w-[14%]" /><col className="w-[11%]" /><col className="w-[11%]" /><col className="w-[15%]" /><col className="w-[23%]" /><col className="w-[23%]" /></colgroup><thead><tr className="border-b bg-slate-50 dark:bg-slate-800/50">
          {['#', 'Nama Siswa', 'Mapel 1', 'Mapel 2', 'Rencana Setelah Lulus', 'Pilihan Pendidikan 1', 'Pilihan Pendidikan 2'].map(label => <th key={label} className="px-1.5 py-2 text-left text-[10px] font-semibold leading-tight text-slate-500 lg:px-2">{label}</th>)}
        </tr></thead><tbody>{rows.map((row, index) => <tr key={row.siswa_id} className={cn('border-b border-slate-100 align-top dark:border-slate-800', row._dirty && 'bg-amber-50/60 dark:bg-amber-950/10')}>
          <td className="px-1.5 py-2 text-[10px] text-slate-400 lg:px-2">{index + 1}</td>
          <td className="px-1.5 py-2 lg:px-2"><p title={row.nama_lengkap} className="break-words font-medium leading-tight text-slate-800 dark:text-slate-200">{row.nama_lengkap}</p><p className="mt-0.5 break-all font-mono text-[9px] text-slate-400">{row.nisn}</p></td>
          <td className="px-1.5 py-2 lg:px-2"><MapelBox compact value={row.mapel_pilihan1} exclude={row.mapel_pilihan2} onChange={value => patchRow(row.siswa_id, { mapel_pilihan1: value })} /></td>
          <td className="px-1.5 py-2 lg:px-2"><MapelBox compact value={row.mapel_pilihan2} exclude={row.mapel_pilihan1} onChange={value => patchRow(row.siswa_id, { mapel_pilihan2: value })} /></td>
          <td className="px-1.5 py-2 lg:px-2"><RencanaBox compact row={row} onChange={value => setRencana(row, value)} onNote={value => patchRow(row.siswa_id, { rencana_catatan: value })} /></td>
          <td className="px-1.5 py-2 lg:px-2">{(row.rencana_kategori ?? 'KULIAH') === 'KULIAH' && <PendidikanBox compact row={row} slot={1} kampusOptions={kampusOptions} prodiByKampus={prodiByKampus} onKampus={id => setKampus(row, 1, id)} onProdi={value => patchRow(row.siswa_id, { pilihan1_prodi: value })} />}</td>
          <td className="px-1.5 py-2 lg:px-2">{(row.rencana_kategori ?? 'KULIAH') === 'KULIAH' && <PendidikanBox compact row={row} slot={2} kampusOptions={kampusOptions} prodiByKampus={prodiByKampus} onKampus={id => setKampus(row, 2, id)} onProdi={value => patchRow(row.siswa_id, { pilihan2_prodi: value })} />}</td>
        </tr>)}</tbody></table>
      </div>
      <div className="space-y-2 md:hidden">{rows.map((row, index) => <div key={row.siswa_id} className={cn('space-y-3 rounded-xl border p-3', row._dirty ? 'border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900')}>
        <div><p className="text-sm font-medium text-slate-800 dark:text-slate-200">{index + 1}. {row.nama_lengkap}</p><p className="font-mono text-[10px] text-slate-400">{row.nisn}</p></div>
        <Labeled label="Mapel Pilihan 1"><MapelBox value={row.mapel_pilihan1} exclude={row.mapel_pilihan2} onChange={value => patchRow(row.siswa_id, { mapel_pilihan1: value })} /></Labeled>
        <Labeled label="Mapel Pilihan 2"><MapelBox value={row.mapel_pilihan2} exclude={row.mapel_pilihan1} onChange={value => patchRow(row.siswa_id, { mapel_pilihan2: value })} /></Labeled>
        <Labeled label="Rencana Setelah Lulus"><RencanaBox row={row} onChange={value => setRencana(row, value)} onNote={value => patchRow(row.siswa_id, { rencana_catatan: value })} /></Labeled>
        {(row.rencana_kategori ?? 'KULIAH') === 'KULIAH' && <><Labeled label="Pilihan Pendidikan 1"><PendidikanBox row={row} slot={1} kampusOptions={kampusOptions} prodiByKampus={prodiByKampus} onKampus={id => setKampus(row, 1, id)} onProdi={value => patchRow(row.siswa_id, { pilihan1_prodi: value })} /></Labeled><Labeled label="Pilihan Pendidikan 2"><PendidikanBox row={row} slot={2} kampusOptions={kampusOptions} prodiByKampus={prodiByKampus} onKampus={id => setKampus(row, 2, id)} onProdi={value => patchRow(row.siswa_id, { pilihan2_prodi: value })} /></Labeled></>}
      </div>)}</div>
    </>}
  </div>
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) { return <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>{children}</div> }
function SaveStatus({ state, dirtyCount, error }: { state: 'idle' | 'waiting' | 'saving' | 'saved' | 'error'; dirtyCount: number; error: string }) {
  if (state === 'idle') return <span className="sm:ml-auto text-xs text-slate-400">Autosave aktif</span>
  const style = state === 'error' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400' : state === 'saved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-400'
  return <span title={error || undefined} className={cn('inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs sm:ml-auto', style)}>
    {state === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state === 'waiting' ? <Clock3 className="h-3.5 w-3.5" /> : state === 'saved' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
    {state === 'saving' ? 'Menyimpan...' : state === 'waiting' ? `Autosave (${dirtyCount})` : state === 'saved' ? 'Tersimpan' : 'Gagal, mencoba lagi...'}
  </span>
}
function MapelBox({ value, exclude, onChange, compact = false }: { value: string | null; exclude: string | null; onChange: (value: string | null) => void; compact?: boolean }) {
  return <Combobox value={value ?? ''} onValueChange={value => onChange(value || null)} options={MAPEL_PILIHAN_OPTIONS_SORTED.filter(item => item !== exclude).map(item => ({ value: item, label: item }))} placeholder="Belum ditentukan" searchPlaceholder="Cari mapel..." clearable triggerClassName={compact ? 'h-8 px-2 text-[11px]' : undefined} contentClassName={compact ? 'min-w-[260px]' : undefined} />
}
function RencanaBox({ row, onChange, onNote, compact = false }: { row: LocalRow; onChange: (value: RencanaKategori) => void; onNote: (value: string) => void; compact?: boolean }) {
  const kategori = row.rencana_kategori ?? 'KULIAH'
  return <div className={compact ? 'space-y-1' : 'space-y-1.5'}><Combobox value={kategori} onValueChange={value => onChange(value as RencanaKategori)} options={RENCANA_OPTIONS} searchPlaceholder="Cari rencana..." triggerClassName={compact ? 'h-8 px-2 text-[11px]' : undefined} contentClassName={compact ? 'min-w-[250px]' : undefined} />{kategori !== 'KULIAH' && <Input value={row.rencana_catatan ?? ''} onChange={event => onNote(event.target.value)} placeholder={kategori === 'LAINNYA' ? 'Catatan wajib...' : 'Catatan opsional...'} className={compact ? 'h-8 px-2 text-[11px]' : 'h-9 text-xs'} />}</div>
}
function PendidikanBox({ row, slot, kampusOptions, prodiByKampus, onKampus, onProdi, compact = false }: { row: LocalRow; slot: 1 | 2; kampusOptions: ComboboxOption[]; prodiByKampus: Record<string, Prodi[]>; onKampus: (value: string) => void; onProdi: (value: string | null) => void; compact?: boolean }) {
  const kampusId = slot === 1 ? row.pilihan1_kampus_id : row.pilihan2_kampus_id
  const prodiName = slot === 1 ? row.pilihan1_prodi : row.pilihan2_prodi
  const prodi = kampusId ? prodiByKampus[kampusId] ?? [] : []
  const triggerClassName = compact ? 'h-8 px-2 text-[11px]' : undefined
  const contentClassName = compact ? cn('min-w-[360px]', slot === 2 && 'left-auto right-0') : undefined
  return <div className={compact ? 'space-y-1' : 'space-y-1.5'}><Combobox value={kampusId ?? ''} onValueChange={onKampus} options={kampusOptions} placeholder="Pilih perguruan tinggi..." searchPlaceholder="Cari nama, singkatan, kota..." clearable maxResults={60} triggerClassName={triggerClassName} contentClassName={contentClassName} /><Combobox value={kampusId ? findProdiValueByName(prodiByKampus, kampusId, prodiName) : ''} onValueChange={value => onProdi(value && kampusId ? findProdiByValue(prodiByKampus, kampusId, value)?.nama ?? null : null)} options={prodi.map(item => ({ value: prodiValue(item), label: `${item.nama} (${item.jenjang})`, keywords: item.kode }))} placeholder={!kampusId ? 'Pilih kampus dahulu' : prodi.length ? 'Pilih program studi...' : 'Prodi tidak tersedia / tidak diperlukan'} searchPlaceholder="Cari program studi..." disabled={!kampusId || !prodi.length} clearable maxResults={80} triggerClassName={triggerClassName} contentClassName={contentClassName} /></div>
}
