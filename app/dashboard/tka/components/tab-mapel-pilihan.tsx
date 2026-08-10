'use client'

import { useCallback, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Save, Search, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
import { naturalSort } from '@/lib/natural-sort'
import {
  KAMPUS_LIST, PRODI_BY_KAMPUS, RENCANA_OPTIONS,
  getProdiByValue, getProdiValueByName, prodiValue,
} from '@/lib/pendidikan-lanjutan'
import type { RencanaKategori } from '@/lib/pendidikan-lanjutan'
import { MAPEL_PILIHAN_OPTIONS_SORTED } from '../constants'
import { batchSaveMapelPilihan, getSiswaByKelasForTka, searchSiswaKelas12ForTka } from '../actions'
import type { KelasItem, TkaMapelRow } from '../actions'

interface Props { tahunAjaranId: string; kelasList: KelasItem[] }
type LocalRow = TkaMapelRow & { _dirty?: boolean }

const kelasLabel = (k: KelasItem) => `${k.tingkat}-${k.nomor_kelas} ${k.kelompok}`
const KAMPUS_OPTIONS: ComboboxOption[] = KAMPUS_LIST.map(kampus => ({
  value: kampus.id,
  label: kampus.nama,
  keywords: `${kampus.singkatan} ${kampus.kota} ${kampus.provinsi} ${kampus.npsn ?? ''}`,
  description: [kampus.singkatan, kampus.kota, kampus.jenis].filter(Boolean).join(' · '),
}))

export function TabMapelPilihan({ tahunAjaranId, kelasList }: Props) {
  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [rows, setRows] = useState<LocalRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'idle' | 'kelas' | 'search'>('idle')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const sortedKelas = useMemo(() => naturalSort(kelasList, k => `${k.tingkat}|${k.nomor_kelas}|${k.kelompok}`), [kelasList])

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }
  const setLoadedRows = (data: TkaMapelRow[]) => setRows(naturalSort(data.map(row => ({ ...row, _dirty: false })), row => row.nama_lengkap))

  const handleKelasChange = useCallback(async (kelasId: string) => {
    setSelectedKelasId(kelasId); setSearchQuery(''); setRows([]); setMode(kelasId ? 'kelas' : 'idle')
    if (!kelasId) return
    setLoading(true)
    try { setLoadedRows(await getSiswaByKelasForTka(kelasId, tahunAjaranId)) }
    catch (error: any) { showToast('error', `Gagal memuat siswa: ${error.message}`) }
    finally { setLoading(false) }
  }, [tahunAjaranId])

  const handleSearch = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || !searchQuery.trim()) return
    setSelectedKelasId(''); setRows([]); setMode('search'); setLoading(true)
    try { setLoadedRows(await searchSiswaKelas12ForTka(searchQuery.trim(), tahunAjaranId)) }
    catch (error: any) { showToast('error', `Gagal mencari siswa: ${error.message}`) }
    finally { setLoading(false) }
  }

  const patchRow = (siswaId: string, patch: Partial<LocalRow>) => setRows(current => current.map(row =>
    row.siswa_id === siswaId ? { ...row, ...patch, _dirty: true } : row
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
    const kampus = KAMPUS_LIST.find(item => item.id === kampusId)
    patchRow(row.siswa_id, slot === 1 ? {
      rencana_kategori: 'KULIAH', rencana_catatan: null,
      pilihan1_kampus_id: kampusId || null, pilihan1_kampus_nama: kampus?.nama ?? null, pilihan1_prodi: null,
    } : {
      rencana_kategori: 'KULIAH', rencana_catatan: null,
      pilihan2_kampus_id: kampusId || null, pilihan2_kampus_nama: kampus?.nama ?? null, pilihan2_prodi: null,
    })
  }

  const dirtyRows = rows.filter(row => row._dirty)
  const handleSave = async () => {
    if (!dirtyRows.length) return
    setSaving(true)
    try {
      const result = await batchSaveMapelPilihan(dirtyRows.map(row => ({
        siswa_id: row.siswa_id,
        mapel_pilihan1: row.mapel_pilihan1,
        mapel_pilihan2: row.mapel_pilihan2,
        rencana_kategori: row.rencana_kategori ?? 'KULIAH',
        rencana_catatan: row.rencana_catatan,
        pilihan1_kampus_id: row.pilihan1_kampus_id,
        pilihan1_prodi: row.pilihan1_prodi,
        pilihan2_kampus_id: row.pilihan2_kampus_id,
        pilihan2_prodi: row.pilihan2_prodi,
      })), tahunAjaranId)
      if (!result.success) throw new Error(result.error || 'Gagal menyimpan')
      setRows(current => current.map(row => ({ ...row, _dirty: false })))
      showToast('success', `${result.saved} data berhasil disimpan`)
    } catch (error: any) { showToast('error', error.message || 'Gagal menyimpan') }
    finally { setSaving(false) }
  }

  return <div className="space-y-4">
    {toast && <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm', toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400')}>
      {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {toast.msg}
    </div>}

    <div className="flex flex-col gap-2 sm:flex-row">
      <Combobox value={selectedKelasId} onValueChange={handleKelasChange} options={sortedKelas.map(k => ({ value: k.id, label: kelasLabel(k) }))} placeholder="Pilih Kelas 12..." searchPlaceholder="Cari kelas..." className="sm:w-56" clearable />
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={handleSearch} placeholder="Cari nama / NISN, Enter..." className="pl-8 pr-8" />
        {searchQuery && <button onClick={() => { setSearchQuery(''); setRows([]); setMode('idle') }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"><X className="h-3.5 w-3.5" /></button>}
      </div>
      <Button onClick={handleSave} disabled={!dirtyRows.length || saving} size="sm" className="sm:ml-auto bg-sky-500 text-white hover:bg-sky-600">
        {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />} Simpan{dirtyRows.length ? ` (${dirtyRows.length})` : ''}
      </Button>
    </div>

    {dirtyRows.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">{dirtyRows.length} perubahan belum disimpan.</div>}
    {loading && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
    {!loading && !rows.length && <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-20 text-center dark:border-slate-800"><Users className="mb-3 h-10 w-10 text-slate-300" /><p className="text-sm font-medium text-slate-500">{mode === 'idle' ? 'Pilih kelas atau cari nama siswa' : 'Siswa tidak ditemukan'}</p></div>}

    {!loading && rows.length > 0 && <>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 md:block">
        <div className="overflow-x-auto"><table className="w-full min-w-[1450px] text-sm"><thead><tr className="border-b bg-slate-50 dark:bg-slate-800/50">
          {['#', 'Nama Siswa', 'Mapel Pilihan 1', 'Mapel Pilihan 2', 'Rencana Setelah Lulus', 'Pilihan Pendidikan 1', 'Pilihan Pendidikan 2'].map(label => <th key={label} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">{label}</th>)}
        </tr></thead><tbody>{rows.map((row, index) => <tr key={row.siswa_id} className={cn('border-b border-slate-100 align-top dark:border-slate-800', row._dirty && 'bg-amber-50/60 dark:bg-amber-950/10')}>
          <td className="px-3 py-3 text-xs text-slate-400">{index + 1}</td>
          <td className="min-w-[180px] px-3 py-3"><p className="font-medium text-slate-800 dark:text-slate-200">{row.nama_lengkap}</p><p className="font-mono text-[10px] text-slate-400">{row.nisn}</p></td>
          <td className="w-[190px] px-3 py-3"><MapelBox value={row.mapel_pilihan1} exclude={row.mapel_pilihan2} onChange={value => patchRow(row.siswa_id, { mapel_pilihan1: value })} /></td>
          <td className="w-[190px] px-3 py-3"><MapelBox value={row.mapel_pilihan2} exclude={row.mapel_pilihan1} onChange={value => patchRow(row.siswa_id, { mapel_pilihan2: value })} /></td>
          <td className="w-[220px] px-3 py-3"><RencanaBox row={row} onChange={value => setRencana(row, value)} onNote={value => patchRow(row.siswa_id, { rencana_catatan: value })} /></td>
          <td className="w-[280px] px-3 py-3">{(row.rencana_kategori ?? 'KULIAH') === 'KULIAH' && <PendidikanBox row={row} slot={1} onKampus={id => setKampus(row, 1, id)} onProdi={value => patchRow(row.siswa_id, { pilihan1_prodi: value })} />}</td>
          <td className="w-[280px] px-3 py-3">{(row.rencana_kategori ?? 'KULIAH') === 'KULIAH' && <PendidikanBox row={row} slot={2} onKampus={id => setKampus(row, 2, id)} onProdi={value => patchRow(row.siswa_id, { pilihan2_prodi: value })} />}</td>
        </tr>)}</tbody></table></div>
      </div>
      <div className="space-y-2 md:hidden">{rows.map((row, index) => <div key={row.siswa_id} className={cn('space-y-3 rounded-xl border p-3', row._dirty ? 'border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900')}>
        <div><p className="text-sm font-medium text-slate-800 dark:text-slate-200">{index + 1}. {row.nama_lengkap}</p><p className="font-mono text-[10px] text-slate-400">{row.nisn}</p></div>
        <Labeled label="Mapel Pilihan 1"><MapelBox value={row.mapel_pilihan1} exclude={row.mapel_pilihan2} onChange={value => patchRow(row.siswa_id, { mapel_pilihan1: value })} /></Labeled>
        <Labeled label="Mapel Pilihan 2"><MapelBox value={row.mapel_pilihan2} exclude={row.mapel_pilihan1} onChange={value => patchRow(row.siswa_id, { mapel_pilihan2: value })} /></Labeled>
        <Labeled label="Rencana Setelah Lulus"><RencanaBox row={row} onChange={value => setRencana(row, value)} onNote={value => patchRow(row.siswa_id, { rencana_catatan: value })} /></Labeled>
        {(row.rencana_kategori ?? 'KULIAH') === 'KULIAH' && <><Labeled label="Pilihan Pendidikan 1"><PendidikanBox row={row} slot={1} onKampus={id => setKampus(row, 1, id)} onProdi={value => patchRow(row.siswa_id, { pilihan1_prodi: value })} /></Labeled><Labeled label="Pilihan Pendidikan 2"><PendidikanBox row={row} slot={2} onKampus={id => setKampus(row, 2, id)} onProdi={value => patchRow(row.siswa_id, { pilihan2_prodi: value })} /></Labeled></>}
      </div>)}</div>
    </>}
  </div>
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) { return <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>{children}</div> }
function MapelBox({ value, exclude, onChange }: { value: string | null; exclude: string | null; onChange: (value: string | null) => void }) {
  return <Combobox value={value ?? ''} onValueChange={value => onChange(value || null)} options={MAPEL_PILIHAN_OPTIONS_SORTED.filter(item => item !== exclude).map(item => ({ value: item, label: item }))} placeholder="Belum ditentukan" searchPlaceholder="Cari mapel..." clearable />
}
function RencanaBox({ row, onChange, onNote }: { row: LocalRow; onChange: (value: RencanaKategori) => void; onNote: (value: string) => void }) {
  const kategori = row.rencana_kategori ?? 'KULIAH'
  return <div className="space-y-1.5"><Combobox value={kategori} onValueChange={value => onChange(value as RencanaKategori)} options={RENCANA_OPTIONS} searchPlaceholder="Cari rencana..." />{kategori !== 'KULIAH' && <Input value={row.rencana_catatan ?? ''} onChange={event => onNote(event.target.value)} placeholder={kategori === 'LAINNYA' ? 'Catatan wajib...' : 'Catatan opsional...'} className="h-9 text-xs" />}</div>
}
function PendidikanBox({ row, slot, onKampus, onProdi }: { row: LocalRow; slot: 1 | 2; onKampus: (value: string) => void; onProdi: (value: string | null) => void }) {
  const kampusId = slot === 1 ? row.pilihan1_kampus_id : row.pilihan2_kampus_id
  const prodiName = slot === 1 ? row.pilihan1_prodi : row.pilihan2_prodi
  const prodi = kampusId ? PRODI_BY_KAMPUS[kampusId] ?? [] : []
  return <div className="space-y-1.5"><Combobox value={kampusId ?? ''} onValueChange={onKampus} options={KAMPUS_OPTIONS} placeholder="Pilih perguruan tinggi..." searchPlaceholder="Cari nama, singkatan, kota..." clearable maxResults={60} /><Combobox value={kampusId ? getProdiValueByName(kampusId, prodiName) : ''} onValueChange={value => onProdi(value && kampusId ? getProdiByValue(kampusId, value)?.nama ?? null : null)} options={prodi.map(item => ({ value: prodiValue(item), label: `${item.nama} (${item.jenjang})`, keywords: item.kode }))} placeholder={!kampusId ? 'Pilih kampus dahulu' : prodi.length ? 'Pilih program studi...' : 'Prodi tidak tersedia / tidak diperlukan'} searchPlaceholder="Cari program studi..." disabled={!kampusId || !prodi.length} clearable maxResults={80} /></div>
}
