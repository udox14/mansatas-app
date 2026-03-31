// app/dashboard/penerimaan-pt/components/penerimaan-pt-client.tsx
'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  GraduationCap, Search, Plus, Loader2, X, Trash2, Pencil,
  CalendarDays, AlertCircle, ChevronRight, CheckCircle2,
  BarChart3, Users, Building2, BookOpen,
  ChevronDown, ChevronUp, FileSpreadsheet, FileText as FilePdf,
  TrendingUp, Award, ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react'
import {
  getSiswaKelas12,                       // ✅ ditambahkan
  getSiswaKelas12Paginated,
  getTotalSiswaKelas12Filtered,
  getKelasUnik,
  getPenerimaanByJalur,
  getPenerimaanSiswa,
  getPenerimaanByKampus,
  getAnalitikPenerimaan,
  getSemuaPenerimaan,
  tambahPenerimaan,
  updatePenerimaan,
  hapusPenerimaan,
} from '../actions'
import type { JalurPT, StatusPenerimaan, PenerimaanRow } from '../types'
import { JALUR_LIST, STATUS_LIST } from '../types'
import kampusData from '@/data/kampus.json'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────
type Kampus = { id: string; nama: string; singkatan: string; kota: string; provinsi: string; jenis: string }
type SiswaRow = { id: string; nama_lengkap: string; nisn: string; foto_url: string | null; tingkat: number; nomor_kelas: string; kelas_kelompok: string; jumlah_diterima: number }

const KAMPUS_LIST = kampusData as Kampus[]

// ── Helpers dengan dynamic jalur ──────────────────────────────────────
function getJalurColor(jalur: string, jalurList: typeof JALUR_LIST) {
  return jalurList.find(j => j.value === jalur)?.color ?? 'bg-slate-100 text-slate-600 border-slate-200'
}
function getJalurLabel(jalur: string, jalurList: typeof JALUR_LIST) {
  return jalurList.find(j => j.value === jalur)?.label ?? jalur
}
function getStatusColor(status: string) {
  return STATUS_LIST.find(s => s.value === status)?.color ?? 'bg-slate-100 text-slate-600 border-slate-200'
}
function getStatusLabel(status: string) {
  return STATUS_LIST.find(s => s.value === status)?.label ?? status
}

function Badge({ label, colorClass, small }: { label: string; colorClass: string; small?: boolean }) {
  return (
    <span className={cn('font-semibold rounded border', small ? 'text-[9px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5', colorClass)}>
      {label}
    </span>
  )
}

function AvatarSiswa({ siswa, size = 'md' }: { siswa: Pick<SiswaRow, 'foto_url' | 'nama_lengkap'>; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-sm'
  return (
    <div className={cn('rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center shrink-0 overflow-hidden border border-indigo-100', cls)}>
      {siswa.foto_url
        ? <img src={siswa.foto_url} alt="" className="h-full w-full object-cover" />
        : <span className="font-bold text-indigo-600">{siswa.nama_lengkap.charAt(0)}</span>}
    </div>
  )
}

// ── KampusAutocomplete (tidak berubah) ─────────────────────────────────
function KampusAutocomplete({
  value, onChange, placeholder = 'Ketik nama atau singkatan kampus...'
}: {
  value: Kampus | null
  onChange: (kampus: Kampus | null) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState(value ? value.nama : '')
  const [open, setOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (value) setQuery(value.nama) }, [value])

  const filtered = useMemo(() => {
    if (query.trim().length < 2) return []
    const q = query.toLowerCase()
    return KAMPUS_LIST.filter(k =>
      k.nama.toLowerCase().includes(q) ||
      k.singkatan.toLowerCase().includes(q) ||
      k.kota.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [query])

  useEffect(() => {
    setHighlightIdx(0)
    setOpen(filtered.length > 0)
  }, [filtered])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (k: Kampus) => {
    onChange(k)
    setQuery(k.nama)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlightIdx]) handleSelect(filtered[highlightIdx]) }
    if (e.key === 'Escape') setOpen(false)
  }

  const JENIS_COLOR: Record<string, string> = {
    PTN: 'bg-blue-50 text-blue-700 border-blue-100',
    PTKIN: 'bg-violet-50 text-violet-700 border-violet-100',
    PTS: 'bg-amber-50 text-amber-700 border-amber-100',
    POLITEKNIK: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); if (!e.target.value) onChange(null) }}
          onFocus={() => { if (filtered.length > 0) setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-9 h-10 rounded-xl border-surface bg-surface-2 text-sm"
        />
        {value && (
          <button type="button" onClick={() => { onChange(null); setQuery('') }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface border border-surface rounded-xl shadow-xl z-50 overflow-hidden">
          {filtered.map((k, idx) => (
            <button key={k.id} type="button"
              onMouseDown={() => handleSelect(k)}
              className={cn('w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors',
                idx === highlightIdx ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-surface-2'
              )}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate">{k.nama}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{k.kota}, {k.provinsi}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', JENIS_COLOR[k.jenis] ?? 'bg-slate-100 text-slate-500 border-slate-200')}>{k.jenis}</span>
                <span className="text-[10px] font-semibold text-slate-500 bg-surface-3 border border-surface-2 px-1.5 py-0.5 rounded">{k.singkatan}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {value && (
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span className="font-medium text-slate-600 dark:text-slate-300">{value.kota} · {value.jenis}</span>
        </div>
      )}
    </div>
  )
}

// ── Form Tambah/Edit Penerimaan (menggunakan dynamicJalurList) ─────────
function FormPenerimaan({
  siswa, taId, jalurDefault, editData, onSaved, onClose,
  dynamicJalurList,
}: {
  siswa: Pick<SiswaRow, 'id' | 'nama_lengkap' | 'nisn' | 'foto_url' | 'tingkat' | 'nomor_kelas' | 'kelas_kelompok'>
  taId: string
  jalurDefault?: JalurPT
  editData?: PenerimaanRow
  onSaved: () => void
  onClose: () => void
  dynamicJalurList: typeof JALUR_LIST
}) {
  const [jalur, setJalur] = useState<JalurPT>(editData?.jalur ?? jalurDefault ?? 'SNBP')
  const [kampus, setKampus] = useState<Kampus | null>(
    editData ? KAMPUS_LIST.find(k => k.id === editData.kampus_id) ?? { id: editData.kampus_id, nama: editData.kampus_nama, singkatan: '', kota: '', provinsi: '', jenis: '' } : null
  )
  const [prodi, setProdi] = useState(editData?.program_studi ?? '')
  const [status, setStatus] = useState<StatusPenerimaan>(editData?.status ?? 'DITERIMA')
  const [catatan, setCatatan] = useState(editData?.catatan ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!kampus) { alert('Pilih kampus terlebih dahulu.'); return }
    setIsSaving(true)
    try {
      if (editData) {
        const res = await updatePenerimaan(editData.id, {
          kampus_id: kampus.id, kampus_nama: kampus.nama,
          program_studi: prodi, status, catatan,
        })
        if (res.error) { alert(res.error); return }
      } else {
        const res = await tambahPenerimaan({
          siswa_id: siswa.id, tahun_ajaran_id: taId,
          jalur, kampus_id: kampus.id, kampus_nama: kampus.nama,
          program_studi: prodi, status, catatan,
        })
        if (res.error) { alert(res.error); return }
      }
      onSaved()
    } finally { setIsSaving(false) }
  }

  return (
    <div className="space-y-4">
      {/* Info siswa */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50/60 border border-indigo-100">
        <AvatarSiswa siswa={siswa} />
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{siswa.nama_lengkap}</p>
          <p className="text-[11px] text-slate-400">{siswa.nisn} · Kelas {siswa.tingkat}-{siswa.nomor_kelas} {siswa.kelas_kelompok}</p>
        </div>
      </div>

      {/* Jalur */}
      {!editData && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Jalur Seleksi <span className="text-rose-500">*</span></label>
          <div className="flex flex-wrap gap-2">
            {dynamicJalurList.map(j => (
              <button key={j.value} type="button" onClick={() => setJalur(j.value as JalurPT)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                  jalur === j.value ? j.color : 'bg-surface-2 text-slate-500 border-surface hover:bg-surface-3')}>
                {j.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Kampus Autocomplete */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Perguruan Tinggi <span className="text-rose-500">*</span></label>
        <KampusAutocomplete value={kampus} onChange={setKampus} />
      </div>

      {/* Program Studi */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Program Studi <span className="text-slate-400 font-normal">(opsional)</span>
        </label>
        <Input value={prodi} onChange={e => setProdi(e.target.value)}
          placeholder="Contoh: Teknik Informatika, Pendidikan Matematika..."
          className="h-9 text-sm rounded-xl bg-surface-2 border-surface" />
      </div>

      {/* Status */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status <span className="text-rose-500">*</span></label>
        <div className="flex flex-wrap gap-2">
          {STATUS_LIST.map(s => (
            <button key={s.value} type="button" onClick={() => setStatus(s.value)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                status === s.value ? s.color : 'bg-surface-2 text-slate-500 border-surface hover:bg-surface-3')}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Catatan */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Catatan <span className="text-slate-400 font-normal">(opsional)</span>
        </label>
        <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2}
          className="w-full rounded-xl border border-surface bg-surface-2 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none"
          placeholder="Catatan tambahan..." />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onClose} className="flex-1 h-9 text-sm rounded-xl">Batal</Button>
        <Button onClick={handleSave} disabled={isSaving || !kampus}
          className="flex-1 h-9 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
          {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : editData ? 'Simpan Perubahan' : 'Simpan Data'}
        </Button>
      </div>
    </div>
  )
}

// ── Modal Input ─────────────────────────────────────────────────────────
function ModalInputPenerimaan({ siswa, taId, jalurDefault, editData, onSaved, onClose, dynamicJalurList }: {
  siswa: SiswaRow | null
  taId: string
  jalurDefault?: JalurPT
  editData?: PenerimaanRow
  onSaved: () => void
  onClose: () => void
  dynamicJalurList: typeof JALUR_LIST
}) {
  if (!siswa) return null
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-surface-2">
          <DialogTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <GraduationCap className="h-4 w-4 text-indigo-600" />
            {editData ? 'Edit Data Penerimaan' : 'Input Data Penerimaan PT'}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[80vh]">
          <div className="px-5 py-5">
            <FormPenerimaan
              siswa={siswa}
              taId={taId}
              jalurDefault={jalurDefault}
              editData={editData}
              onSaved={onSaved}
              onClose={onClose}
              dynamicJalurList={dynamicJalurList}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ── Tab 1: Input per Jalur (dengan pagination) ─────────────────────────
function TabInputJalur({ taId, dynamicJalurList, addJalur }: {
  taId: string
  dynamicJalurList: typeof JALUR_LIST
  addJalur: (value: string, label: string, color: string) => void
}) {
  const [activeJalur, setActiveJalur] = useState<JalurPT>('SNBP')
  const [siswaList, setSiswaList] = useState<SiswaRow[]>([])
  const [penerimaanList, setPenerimaanList] = useState<PenerimaanRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterKelas, setFilterKelas] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSiswa, setSelectedSiswa] = useState<SiswaRow | null>(null)
  const [editData, setEditData] = useState<PenerimaanRow | undefined>()
  const [showModal, setShowModal] = useState(false)
  const [expandedSiswa, setExpandedSiswa] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [kelasOptions, setKelasOptions] = useState<string[]>([])
  const [showAddJalurDialog, setShowAddJalurDialog] = useState(false)
  const [newJalurLabel, setNewJalurLabel] = useState('')
  const [newJalurColor, setNewJalurColor] = useState('bg-gray-100 text-gray-700 border-gray-200')
  const ITEMS_PER_PAGE = 10

  // Ambil daftar kelas unik
  useEffect(() => {
    getKelasUnik(taId).then(setKelasOptions)
  }, [taId])

  // Load data siswa (pagination) dan penerimaan (semua untuk jalur aktif)
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE
      const [siswa, total, penerimaan] = await Promise.all([
        getSiswaKelas12Paginated({
          tahun_ajaran_id: taId,
          limit: ITEMS_PER_PAGE,
          offset,
          kelas_filter: filterKelas || undefined,
          search: searchQuery.trim().length >= 2 ? searchQuery : undefined,
          jalur: activeJalur,
        }),
        getTotalSiswaKelas12Filtered({
          tahun_ajaran_id: taId,
          kelas_filter: filterKelas || undefined,
          search: searchQuery.trim().length >= 2 ? searchQuery : undefined,
        }),
        getPenerimaanByJalur(activeJalur, taId),
      ])
      setSiswaList(siswa)
      setTotalItems(total)
      setPenerimaanList(penerimaan)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [taId, activeJalur, currentPage, filterKelas, searchQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Reset halaman ketika filter/search berubah
  useEffect(() => {
    setCurrentPage(1)
  }, [filterKelas, searchQuery])

  const getJalurInfo = (jalur: string) => {
    return dynamicJalurList.find(j => j.value === jalur)!
  }

  const penerimaanBySiswa = useMemo(() => {
    const map = new Map<string, PenerimaanRow[]>()
    penerimaanList.forEach(p => {
      const list = map.get(p.siswa_id) ?? []
      list.push(p)
      map.set(p.siswa_id, list)
    })
    return map
  }, [penerimaanList])

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus data ini?')) return
    const res = await hapusPenerimaan(id)
    if (res.error) { alert(res.error); return }
    await loadData()
  }

  const toggleExpand = (id: string) => {
    setExpandedSiswa(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const jalurInfo = getJalurInfo(activeJalur)

  // Pagination controls
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
  const canPrev = currentPage > 1
  const canNext = currentPage < totalPages

  const handlePrev = () => canPrev && setCurrentPage(p => p - 1)
  const handleNext = () => canNext && setCurrentPage(p => p + 1)

  const handleAddJalur = () => {
    if (!newJalurLabel.trim()) return
    const newValue = newJalurLabel.toUpperCase().replace(/\s/g, '_')
    if (dynamicJalurList.some(j => j.value === newValue)) {
      alert('Jalur sudah ada')
      return
    }
    addJalur(newValue, newJalurLabel, newJalurColor)
    setShowAddJalurDialog(false)
    setNewJalurLabel('')
    setNewJalurColor('bg-gray-100 text-gray-700 border-gray-200')
  }

  return (
    <div className="space-y-3">
      {/* Pilih jalur + tombol tambah */}
      <div className="flex flex-wrap gap-2 items-center">
        {dynamicJalurList.map(j => (
          <button key={j.value} onClick={() => setActiveJalur(j.value as JalurPT)}
            className={cn('px-4 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm',
              activeJalur === j.value ? j.color + ' shadow-md scale-[1.02]' : 'bg-surface text-slate-500 border-surface hover:bg-surface-2')}>
            {j.label}
          </button>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddJalurDialog(true)}
          className="h-8 text-xs gap-1 border-dashed border-indigo-300 text-indigo-600"
        >
          <Plus className="h-3 w-3" /> Tambah Jalur
        </Button>
      </div>

      {/* Dialog tambah jalur */}
      <Dialog open={showAddJalurDialog} onOpenChange={setShowAddJalurDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Tambah Jalur Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-600">Nama Jalur</label>
              <Input
                value={newJalurLabel}
                onChange={e => setNewJalurLabel(e.target.value)}
                placeholder="Contoh: BEASISWA"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Warna (opsional)</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {['bg-emerald-50 text-emerald-700 border-emerald-200',
                  'bg-blue-50 text-blue-700 border-blue-200',
                  'bg-violet-50 text-violet-700 border-violet-200',
                  'bg-amber-50 text-amber-700 border-amber-200',
                  'bg-rose-50 text-rose-700 border-rose-200',
                  'bg-slate-100 text-slate-600 border-slate-200'].map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewJalurColor(color)}
                    className={cn('px-3 py-1 rounded-lg text-xs font-semibold border', color, newJalurColor === color && 'ring-2 ring-indigo-400')}
                  >
                    Contoh
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddJalurDialog(false)} className="flex-1">Batal</Button>
              <Button onClick={handleAddJalur} className="flex-1 bg-indigo-600">Tambah</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toolbar */}
      <div className="bg-surface border border-surface rounded-xl p-3 space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border shrink-0', jalurInfo.color)}>
            <BookOpen className="h-3.5 w-3.5" />
            {jalurInfo.label}
            <span className="bg-white/60 px-1.5 py-0.5 rounded font-black">{penerimaanList.filter(p => p.status === 'DITERIMA').length}</span>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">siswa diterima</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau NISN..." className="pl-9 h-9 text-xs rounded-xl border-surface bg-surface-2" />
          </div>
          {kelasOptions.length > 1 && (
            <Select value={filterKelas || 'all'} onValueChange={v => setFilterKelas(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-9 w-32 text-xs rounded-xl border-surface">
                <SelectValue placeholder="Semua kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Semua kelas</SelectItem>
                {kelasOptions.map(k => <SelectItem key={k} value={k} className="text-xs">Kelas {k}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Tabel siswa */}
      {isLoading ? (
        <div className="flex items-center justify-center py-14 gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Memuat data...</span>
        </div>
      ) : siswaList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-2 text-slate-400">
          <Users className="h-10 w-10 text-slate-200" />
          <p className="text-sm font-medium">Tidak ada siswa yang cocok</p>
        </div>
      ) : (
        <div className="space-y-2">
          {siswaList.map(siswa => {
            const entries = penerimaanBySiswa.get(siswa.id) ?? []
            const isExpanded = expandedSiswa.has(siswa.id)
            const diterima = entries.filter(e => e.status === 'DITERIMA')

            return (
              <div key={siswa.id} className="rounded-xl border border-surface bg-surface overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggleExpand(siswa.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <AvatarSiswa siswa={siswa} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{siswa.nama_lengkap}</p>
                      <p className="text-[10px] text-slate-400">{siswa.nisn} · {siswa.tingkat}-{siswa.nomor_kelas}</p>
                    </div>
                    {entries.length > 0 && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full shrink-0">
                        {diterima.length}/{entries.length}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                  </button>
                  <button onClick={() => { setSelectedSiswa(siswa); setEditData(undefined); setShowModal(true) }}
                    className="shrink-0 h-7 w-7 flex items-center justify-center rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-surface-2 bg-slate-50/50 dark:bg-slate-900/10 px-4 py-3 space-y-2">
                    {entries.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic text-center py-2">Belum ada data untuk jalur {jalurInfo.label}</p>
                    ) : entries.map(entry => (
                      <div key={entry.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-surface border border-surface-2 group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{entry.kampus_nama}</p>
                            <Badge label={getStatusLabel(entry.status)} colorClass={getStatusColor(entry.status)} small />
                          </div>
                          {entry.program_studi && <p className="text-[10px] text-slate-500 mt-0.5">{entry.program_studi}</p>}
                          {entry.catatan && <p className="text-[10px] text-slate-400 italic mt-0.5">{entry.catatan}</p>}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => { setSelectedSiswa(siswa); setEditData(entry); setShowModal(true) }}
                            className="p-1 rounded text-blue-500 hover:bg-blue-50">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => handleDelete(entry.id)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-50">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={!canPrev}
            className="h-8 w-8 p-0 rounded-lg"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-slate-500">
            Halaman {currentPage} dari {totalPages} ({totalItems} siswa)
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={!canNext}
            className="h-8 w-8 p-0 rounded-lg"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      )}

      {showModal && selectedSiswa && (
        <ModalInputPenerimaan
          siswa={selectedSiswa}
          taId={taId}
          jalurDefault={activeJalur}
          editData={editData}
          onSaved={async () => { setShowModal(false); await loadData() }}
          onClose={() => setShowModal(false)}
          dynamicJalurList={dynamicJalurList}
        />
      )}
    </div>
  )
}

// ── Tab 2: Per Siswa (menggunakan dynamicJalurList) ───────────────────
function TabPerSiswa({ taId, dynamicJalurList }: {
  taId: string
  dynamicJalurList: typeof JALUR_LIST
}) {
  const [siswaList, setSiswaList] = useState<SiswaRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSiswa, setSelectedSiswa] = useState<SiswaRow | null>(null)
  const [entries, setEntries] = useState<PenerimaanRow[]>([])
  const [isLoadingEntries, setIsLoadingEntries] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editData, setEditData] = useState<PenerimaanRow | undefined>()

  useEffect(() => {
    getSiswaKelas12(taId).then((data: SiswaRow[]) => {   // ✅ tipe ditambahkan
      setSiswaList(data)
      setIsLoading(false)
    })
  }, [taId])

  const handleSelectSiswa = async (siswa: SiswaRow) => {
    setSelectedSiswa(siswa)
    setIsLoadingEntries(true)
    const data = await getPenerimaanSiswa(siswa.id, taId)
    setEntries(data)
    setIsLoadingEntries(false)
  }

  const reload = async () => {
    if (!selectedSiswa) return
    const data = await getPenerimaanSiswa(selectedSiswa.id, taId)
    setEntries(data)
    const updatedList: SiswaRow[] = await getSiswaKelas12(taId)   // ✅ tipe ditambahkan
    setSiswaList(updatedList)
  }

  const filtered = useMemo(() => {
    if (searchQuery.trim().length < 2) return siswaList
    const q = searchQuery.toLowerCase()
    return siswaList.filter(s => s.nama_lengkap.toLowerCase().includes(q) || s.nisn.includes(q))
  }, [siswaList, searchQuery])

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 min-h-[500px]">
      {/* Sidebar siswa */}
      <div className="md:col-span-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari siswa..." className="pl-9 h-9 text-xs rounded-xl border-surface bg-surface-2" />
        </div>
        <div className="bg-surface border border-surface rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : (
            <div className="divide-y divide-surface-2 max-h-[560px] overflow-y-auto custom-scrollbar">
              {filtered.map(s => (
                <button key={s.id} onClick={() => handleSelectSiswa(s)}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    selectedSiswa?.id === s.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-surface-2')}>
                  <AvatarSiswa siswa={s} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{s.nama_lengkap}</p>
                    <p className="text-[10px] text-slate-400">{s.tingkat}-{s.nomor_kelas}</p>
                  </div>
                  {s.jumlah_diterima > 0 && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full shrink-0">
                      {s.jumlah_diterima}
                    </span>
                  )}
                  <ChevronRight className={cn('h-3.5 w-3.5 shrink-0', selectedSiswa?.id === s.id ? 'text-indigo-500' : 'text-slate-300')} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail siswa */}
      <div className="md:col-span-3">
        {!selectedSiswa ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 border border-dashed border-surface-2 rounded-xl py-16">
            <Users className="h-10 w-10 text-slate-200" />
            <p className="text-sm">Pilih siswa dari daftar</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/20 dark:to-transparent border border-indigo-100">
              <AvatarSiswa siswa={selectedSiswa} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedSiswa.nama_lengkap}</p>
                <p className="text-[11px] text-slate-400">{selectedSiswa.nisn} · Kelas {selectedSiswa.tingkat}-{selectedSiswa.nomor_kelas} {selectedSiswa.kelas_kelompok}</p>
              </div>
              <Button size="sm" onClick={() => { setEditData(undefined); setShowModal(true) }}
                className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shrink-0">
                <Plus className="h-3 w-3" /> Tambah
              </Button>
            </div>

            {isLoadingEntries ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : entries.length === 0 ? (
              <div className="text-center py-10 text-slate-400 border border-dashed border-surface-2 rounded-xl">
                <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Belum ada data penerimaan PT</p>
                <button onClick={() => { setEditData(undefined); setShowModal(true) }}
                  className="text-xs text-indigo-600 font-semibold mt-2 flex items-center gap-1 mx-auto">
                  <Plus className="h-3 w-3" /> Tambahkan
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {dynamicJalurList.map(j => {
                  const jalurEntries = entries.filter(e => e.jalur === j.value)
                  if (jalurEntries.length === 0) return null
                  return (
                    <div key={j.value} className="rounded-xl border border-surface bg-surface overflow-hidden">
                      <div className={cn('px-4 py-2 border-b border-surface-2 flex items-center gap-2', j.color.replace('text-', 'text-').replace('bg-', 'bg-opacity-60 bg-'))}>
                        <Badge label={j.label} colorClass={j.color} />
                        <span className="text-[11px] text-slate-500 font-medium">{jalurEntries.length} perguruan tinggi</span>
                      </div>
                      <div className="divide-y divide-surface-2">
                        {jalurEntries.map(entry => (
                          <div key={entry.id} className="flex items-start gap-3 px-4 py-3 group hover:bg-surface-2 transition-colors">
                            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                              <Building2 className="h-4 w-4 text-indigo-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight">{entry.kampus_nama}</p>
                              {entry.program_studi && <p className="text-[11px] text-indigo-600 font-medium mt-0.5">{entry.program_studi}</p>}
                              {entry.catatan && <p className="text-[11px] text-slate-400 italic mt-0.5">{entry.catatan}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <Badge label={getStatusLabel(entry.status)} colorClass={getStatusColor(entry.status)} />
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditData(entry); setShowModal(true) }} className="p-1 rounded text-blue-500 hover:bg-blue-50"><Pencil className="h-3 w-3" /></button>
                                <button onClick={async () => {
                                  if (!confirm('Hapus data ini?')) return
                                  await hapusPenerimaan(entry.id); await reload()
                                }} className="p-1 rounded text-rose-500 hover:bg-rose-50"><Trash2 className="h-3 w-3" /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && selectedSiswa && (
        <ModalInputPenerimaan
          siswa={selectedSiswa}
          taId={taId}
          editData={editData}
          onSaved={async () => { setShowModal(false); await reload() }}
          onClose={() => setShowModal(false)}
          dynamicJalurList={dynamicJalurList}
        />
      )}
    </div>
  )
}

// ── Tab 3: Per Kampus (menggunakan dynamicJalurList) ──────────────────
function TabPerKampus({ taId, dynamicJalurList }: {
  taId: string
  dynamicJalurList: typeof JALUR_LIST
}) {
  const [selectedKampus, setSelectedKampus] = useState<Kampus | null>(null)
  const [entries, setEntries] = useState<PenerimaanRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [filterJalur, setFilterJalur] = useState<JalurPT | ''>('')

  useEffect(() => {
    if (!selectedKampus) return
    setIsLoading(true)
    getPenerimaanByKampus(selectedKampus.id, taId)
      .then(data => { setEntries(data); setIsLoading(false) })
  }, [selectedKampus, taId])

  const filtered = filterJalur ? entries.filter(e => e.jalur === filterJalur) : entries
  const diterima = filtered.filter(e => e.status === 'DITERIMA')

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Cari Perguruan Tinggi</label>
        <KampusAutocomplete value={selectedKampus} onChange={k => { setSelectedKampus(k); setFilterJalur('') }} placeholder="Ketik nama kampus..." />
      </div>

      {selectedKampus && (
        <>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/20 dark:to-transparent border border-indigo-100">
            <div className="h-12 w-12 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-slate-800 dark:text-slate-100 truncate">{selectedKampus.nama}</p>
              <p className="text-xs text-slate-400">{selectedKampus.kota}, {selectedKampus.provinsi}</p>
            </div>
            <div className="shrink-0 text-center">
              <div className="text-xl font-black text-indigo-600">{diterima.length}</div>
              <div className="text-[10px] text-slate-400 font-medium">diterima</div>
            </div>
          </div>

          {entries.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilterJalur('')}
                className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                  filterJalur === '' ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-surface-2 text-slate-500 border-surface hover:bg-surface-3')}>
                Semua ({entries.length})
              </button>
              {dynamicJalurList.map(j => {
                const count = entries.filter(e => e.jalur === j.value).length
                if (!count) return null
                return (
                  <button key={j.value} onClick={() => setFilterJalur(j.value as JalurPT)}
                    className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                      filterJalur === j.value ? j.color : 'bg-surface-2 text-slate-500 border-surface hover:bg-surface-3')}>
                    {j.label} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 border border-dashed border-surface-2 rounded-xl">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Belum ada siswa tercatat di kampus ini</p>
            </div>
          ) : (
            <div className="bg-surface border border-surface rounded-xl overflow-hidden">
              <div className="hidden md:grid grid-cols-12 bg-surface-2 border-b border-surface-2 px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                <div className="col-span-4">Siswa</div>
                <div className="col-span-2">Kelas</div>
                <div className="col-span-2">Jalur</div>
                <div className="col-span-3">Program Studi</div>
                <div className="col-span-1">Status</div>
              </div>
              <div className="divide-y divide-surface-2">
                {filtered.map(entry => (
                  <div key={entry.id} className="flex md:grid md:grid-cols-12 items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors">
                    <div className="md:col-span-4 flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                        <span className="text-[10px] font-bold text-indigo-600">{entry.nama_lengkap?.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{entry.nama_lengkap}</p>
                        <p className="text-[10px] text-slate-400">{entry.nisn}</p>
                      </div>
                    </div>
                    <div className="md:col-span-2 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap hidden md:block">
                      {entry.tingkat}-{entry.nomor_kelas}
                    </div>
                    <div className="md:col-span-2 hidden md:block">
                      <Badge label={getJalurLabel(entry.jalur, dynamicJalurList)} colorClass={getJalurColor(entry.jalur, dynamicJalurList)} />
                    </div>
                    <div className="md:col-span-3 text-xs text-slate-500 dark:text-slate-400 hidden md:block truncate">
                      {entry.program_studi || '—'}
                    </div>
                    <div className="md:col-span-1 shrink-0 ml-auto md:ml-0">
                      <Badge label={getStatusLabel(entry.status)} colorClass={getStatusColor(entry.status)} small />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Tab 4: Analitik (menggunakan dynamicJalurList) ────────────────────
function TabAnalitik({ taId, dynamicJalurList }: {
  taId: string
  dynamicJalurList: typeof JALUR_LIST
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getAnalitikPenerimaan>> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getAnalitikPenerimaan(taId).then(d => { setData(d); setIsLoading(false) })
  }, [taId])

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 gap-2 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Memuat analitik...</span></div>
  }
  if (!data) return null

  const pct = data.totalSiswa > 0 ? Math.round((data.sudahData / data.totalSiswa) * 100) : 0

  const jalurSummary = dynamicJalurList.map(j => {
    const entries = data.perJalur.filter(p => p.jalur === j.value)
    const diterima = entries.find(e => e.status === 'DITERIMA')?.total ?? 0
    const tidakDiterima = entries.find(e => e.status === 'TIDAK_DITERIMA')?.total ?? 0
    return { ...j, diterima, tidakDiterima, total: diterima + tidakDiterima }
  }).filter(j => j.total > 0)

  const maxDiterima = Math.max(...jalurSummary.map(j => j.diterima), 1)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Siswa Kelas 12', value: data.totalSiswa, icon: Users, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
          { label: 'Sudah Terdata', value: data.sudahData, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Belum Terdata', value: data.totalSiswa - data.sudahData, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Persentase', value: `${pct}%`, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
        ].map(card => (
          <div key={card.label} className={cn('rounded-xl border p-4', card.bg)}>
            <card.icon className={cn('h-5 w-5 mb-2', card.color)} />
            <div className={cn('text-2xl font-black', card.color)}>{card.value}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-surface rounded-xl p-4 space-y-2">
        <div className="flex justify-between items-center">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Kelengkapan Data</p>
          <p className="text-sm font-black text-indigo-600">{pct}%</p>
        </div>
        <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-slate-400">{data.sudahData} dari {data.totalSiswa} siswa telah terdata</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-surface rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-2 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Distribusi per Jalur</p>
          </div>
          <div className="p-4 space-y-3">
            {jalurSummary.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Belum ada data</p>
            ) : jalurSummary.sort((a, b) => b.diterima - a.diterima).map(j => (
              <div key={j.value} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Badge label={j.label} colorClass={j.color} />
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{j.diterima} diterima</span>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(j.diterima / maxDiterima) * 100}%`,
                      background: j.color.includes('emerald') ? '#10b981' : j.color.includes('blue') ? '#3b82f6' : j.color.includes('violet') ? '#8b5cf6' : j.color.includes('purple') ? '#a855f7' : j.color.includes('amber') ? '#f59e0b' : j.color.includes('rose') ? '#f43f5e' : '#94a3b8'
                    }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-surface rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-2 flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Top Perguruan Tinggi</p>
          </div>
          <ScrollArea className="h-72">
            {data.topKampus.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">Belum ada data</p>
            ) : (
              <div className="p-4 space-y-2">
                {data.topKampus.map((k, idx) => {
                  const kampusInfo = KAMPUS_LIST.find(x => x.id === k.kampus_id)
                  return (
                    <div key={k.kampus_id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-2 transition-colors">
                      <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0',
                        idx === 0 ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                        idx === 1 ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                        idx === 2 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                        'bg-surface-2 text-slate-500 border border-surface-2')}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{k.kampus_nama}</p>
                        {kampusInfo && <p className="text-[10px] text-slate-400">{kampusInfo.kota} · {kampusInfo.jenis}</p>}
                      </div>
                      <span className="text-xs font-black text-indigo-600 shrink-0">{k.total}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

// ── Export Utilities ────────────────────────────────────────────────────
function exportCSV(rows: PenerimaanRow[], taName: string, dynamicJalurList: typeof JALUR_LIST) {
  const headers = ['Nama Lengkap', 'NISN', 'Kelas', 'Jalur', 'Perguruan Tinggi', 'Program Studi', 'Status', 'Catatan']
  const csvRows = rows.map(r => [
    r.nama_lengkap ?? '',
    r.nisn ?? '',
    `${r.tingkat ?? ''}-${r.nomor_kelas ?? ''} ${r.kelas_kelompok ?? ''}`.trim(),
    getJalurLabel(r.jalur, dynamicJalurList),
    r.kampus_nama,
    r.program_studi ?? '',
    getStatusLabel(r.status),
    r.catatan ?? '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

  const csv = [headers.join(','), ...csvRows].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `penerimaan-pt-${taName.replace(/\//g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function exportPDF(rows: PenerimaanRow[], taName: string, dynamicJalurList: typeof JALUR_LIST) {
  const grouped = dynamicJalurList.map(j => ({
    ...j, rows: rows.filter(r => r.jalur === j.value)
  })).filter(j => j.rows.length > 0)

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Data Penerimaan PT - ${taName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 24px; }
  h1 { font-size: 16px; font-weight: 800; margin-bottom: 2px; }
  .sub { font-size: 11px; color: #64748b; margin-bottom: 20px; }
  .section { margin-bottom: 24px; break-inside: avoid; }
  .section-title { font-size: 12px; font-weight: 700; padding: 6px 10px; border-radius: 6px; margin-bottom: 8px; display: inline-block; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #e2e8f0; }
  td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; border: 1px solid; }
  .diterima { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
  .tidak { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
  .mundur { background: #fef3c7; color: #92400e; border-color: #fde68a; }
  @media print { body { padding: 0; } }
</style>
</head><body>
<h1>Data Penerimaan Perguruan Tinggi</h1>
<div class="sub">MAN 1 Tasikmalaya · Tahun Ajaran ${taName} · Dicetak ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
${grouped.map(j => `
<div class="section">
  <div class="section-title" style="background:#ede9fe;color:#5b21b6;border:1px solid #ddd6fe">Jalur ${j.label} — ${j.rows.filter(r => r.status === 'DITERIMA').length} diterima</div>
   <table>
    <thead>
      <tr><th>No</th><th>Nama Lengkap</th><th>NISN</th><th>Kelas</th><th>Perguruan Tinggi</th><th>Program Studi</th><th>Status</th></tr>
    </thead>
    <tbody>
      ${j.rows.map((r, i) => `<tr>
          <td>${i + 1}</td>
          <td><strong>${r.nama_lengkap ?? ''}</strong></td>
          <td>${r.nisn ?? ''}</td>
          <td>${r.tingkat ?? ''}-${r.nomor_kelas ?? ''}</td>
          <td>${r.kampus_nama}</td>
          <td>${r.program_studi ?? '—'}</td>
          <td><span class="badge ${r.status === 'DITERIMA' ? 'diterima' : r.status === 'TIDAK_DITERIMA' ? 'tidak' : 'mundur'}">${getStatusLabel(r.status)}</span></td>
        </tr>`).join('')}
    </tbody>
   </table>
</div>`).join('')}
</body></html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 400)
}

// ── Modal Import Excel ─────────────────────────────────────────────────
function ImportExcelModal({
  open,
  onOpenChange,
  taId,
  dynamicJalurList,
  onImportSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  taId: string
  dynamicJalurList: typeof JALUR_LIST
  onImportSuccess: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [parsedData, setParsedData] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<{
    nisn: number | null
    nama: number | null
    jalur: number | null
    kampus: number | null
    prodi: number | null
    status: number | null
  }>({
    nisn: null,
    nama: null,
    jalur: null,
    kampus: null,
    prodi: null,
    status: null,
  })
  const [previewRows, setPreviewRows] = useState<any[]>([])
  const [kampusMapping, setKampusMapping] = useState<Record<number, string>>({}) // baris index -> kampus_id
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload')

  // Reset state saat modal ditutup
  useEffect(() => {
    if (!open) {
      setFile(null)
      setParsedData([])
      setHeaders([])
      setMapping({ nisn: null, nama: null, jalur: null, kampus: null, prodi: null, status: null })
      setPreviewRows([])
      setKampusMapping({})
      setStep('upload')
      setLoading(false)
    }
  }, [open])

  // Handler upload file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFile(file)
    setLoading(true)

    // Load SheetJS from CDN (zero npm install)
    const script = document.createElement('script')
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js'
    script.onload = () => {
      const reader = new FileReader()
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const workbook = (window as any).XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = (window as any).XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' })
        if (rows.length < 2) {
          alert('File kosong atau tidak memiliki data.')
          setLoading(false)
          return
        }
        const headerRow = rows[0] as string[]
        const dataRows = rows.slice(1) as any[][]
        setHeaders(headerRow)
        setParsedData(dataRows)
        setStep('map')
        setLoading(false)
      }
      reader.readAsArrayBuffer(file)
    }
    document.head.appendChild(script)
  }

  // Handle mapping selection
  const handleMappingChange = (field: keyof typeof mapping, colIndex: number) => {
    setMapping(prev => ({ ...prev, [field]: colIndex }))
  }

  // Generate preview setelah mapping selesai
  const generatePreview = () => {
    const required = ['nisn', 'jalur', 'kampus', 'status']
    for (const f of required) {
      if (mapping[f as keyof typeof mapping] === null) {
        alert(`Kolom ${f.toUpperCase()} harus dipilih.`)
        return
      }
    }

    const preview = parsedData.map((row, idx) => {
      const nisn = row[mapping.nisn!]?.toString().trim() || ''
      const nama = mapping.nama !== null ? row[mapping.nama!]?.toString().trim() || '' : ''
      const jalurRaw = row[mapping.jalur!]?.toString().trim() || ''
      const kampusRaw = row[mapping.kampus!]?.toString().trim() || ''
      const prodiRaw = mapping.prodi !== null ? row[mapping.prodi!]?.toString().trim() || '' : ''
      const statusRaw = row[mapping.status!]?.toString().trim() || ''

      // Cari jalur yang cocok
      const jalurMatch = dynamicJalurList.find(j => j.label.toLowerCase() === jalurRaw.toLowerCase() || j.value === jalurRaw)
      const jalurValue = jalurMatch ? jalurMatch.value : jalurRaw

      // Cari status
      const statusMatch = STATUS_LIST.find(s => s.label.toLowerCase() === statusRaw.toLowerCase() || s.value === statusRaw)
      const statusValue = statusMatch ? statusMatch.value : statusRaw

      // Cari kampus (fuzzy)
      let kampusId = ''
      let kampusNama = ''
      if (kampusRaw) {
        const found = KAMPUS_LIST.find(k => 
          k.nama.toLowerCase().includes(kampusRaw.toLowerCase()) ||
          kampusRaw.toLowerCase().includes(k.nama.toLowerCase())
        )
        if (found) {
          kampusId = found.id
          kampusNama = found.nama
        }
      }

      return {
        index: idx,
        nisn,
        nama,
        jalurRaw,
        jalurValue,
        kampusRaw,
        kampusId,
        kampusNama,
        prodiRaw,
        statusRaw,
        statusValue,
        valid: !!nisn && !!kampusRaw && !!jalurValue && !!statusValue,
      }
    })

    setPreviewRows(preview)
    // Inisialisasi kampusMapping untuk baris yang belum punya kampusId
    const initialKampusMapping: Record<number, string> = {}
    preview.forEach((row, i) => {
      if (row.kampusId) initialKampusMapping[i] = row.kampusId
    })
    setKampusMapping(initialKampusMapping)
    setStep('preview')
  }

  // Handle perubahan pilihan kampus di preview
  const handleKampusChange = (rowIndex: number, kampusId: string) => {
    setKampusMapping(prev => ({ ...prev, [rowIndex]: kampusId }))
    // Update previewRows untuk menampilkan nama kampus yang dipilih
    setPreviewRows(prevRows =>
      prevRows.map(row =>
        row.index === rowIndex
          ? {
              ...row,
              kampusId,
              kampusNama: KAMPUS_LIST.find(k => k.id === kampusId)?.nama || '',
            }
          : row
      )
    )
  }

  // Kirim data ke server
  const handleImport = async () => {
    const dataToImport = previewRows
      .filter(row => row.valid && kampusMapping[row.index])
      .map(row => ({
        nisn: row.nisn,
        jalur: row.jalurValue as JalurPT,
        kampus_nama: KAMPUS_LIST.find(k => k.id === kampusMapping[row.index])?.nama || row.kampusRaw,
        program_studi: row.prodiRaw || undefined,
        status: row.statusValue as StatusPenerimaan,
      }))

    if (dataToImport.length === 0) {
      alert('Tidak ada data valid untuk diimport.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/import-penerimaan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataToImport, taId }),
      })
      const result = await res.json()
      if (result.success !== undefined) {
        alert(`Import berhasil: ${result.success} data, gagal: ${result.failed}\n${result.errors.join('\n')}`)
        onImportSuccess()
        onOpenChange(false)
      } else {
        alert(`Import gagal: ${result.error}`)
      }
    } catch (err) {
      alert('Terjadi kesalahan saat import.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-surface-2">
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
            Import Data Penerimaan PT
          </DialogTitle>
        </DialogHeader>

        <div className="p-5">
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-surface-2 rounded-xl p-8 text-center">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="excel-upload"
                />
                <label
                  htmlFor="excel-upload"
                  className="cursor-pointer flex flex-col items-center gap-2 text-slate-500 hover:text-indigo-600"
                >
                  <FileSpreadsheet className="h-12 w-12" />
                  <span className="text-sm font-medium">Klik untuk upload file Excel atau CSV</span>
                  <span className="text-xs">Format harus memiliki baris header</span>
                </label>
              </div>
              <p className="text-xs text-slate-400">
                Template yang diharapkan: kolom NISN, Nama (opsional), Jalur, Kampus, Program Studi (opsional), Status.
                Status: DITERIMA / TIDAK_DITERIMA / MENGUNDURKAN_DIRI.
              </p>
            </div>
          )}

          {step === 'map' && headers.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Pemetaan Kolom</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(mapping).map(([field, value]) => (
                  <div key={field}>
                    <label className="text-xs font-medium text-slate-600 capitalize">{field}</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-surface bg-surface-2 px-3 py-2 text-sm"
                      value={value ?? ''}
                      onChange={(e) => handleMappingChange(field as keyof typeof mapping, parseInt(e.target.value))}
                    >
                      <option value="">-- Pilih kolom --</option>
                      {headers.map((h, idx) => (
                        <option key={idx} value={idx}>
                          {h} (kolom {idx + 1})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Kembali
                </Button>
                <Button onClick={generatePreview} className="bg-indigo-600">
                  Lanjut ke Preview
                </Button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Preview Data (5 baris pertama)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs border border-surface">
                  <thead className="bg-surface-2">
                    <tr>
                      <th className="p-2 border">NISN</th>
                      <th className="p-2 border">Nama</th>
                      <th className="p-2 border">Jalur</th>
                      <th className="p-2 border">Kampus (pilih)</th>
                      <th className="p-2 border">Program Studi</th>
                      <th className="p-2 border">Status</th>
                      <th className="p-2 border">Valid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className={row.valid ? '' : 'bg-red-50'}>
                        <td className="p-2 border">{row.nisn}</td>
                        <td className="p-2 border">{row.nama}</td>
                        <td className="p-2 border">
                          {row.jalurRaw}
                          {!dynamicJalurList.find(j => j.value === row.jalurValue) && (
                            <span className="ml-1 text-rose-500">(tidak dikenal)</span>
                          )}
                        </td>
                        <td className="p-2 border">
                          <select
                            value={kampusMapping[row.index] || ''}
                            onChange={(e) => handleKampusChange(row.index, e.target.value)}
                            className="w-full rounded border bg-surface-2 p-1 text-xs"
                          >
                            <option value="">Pilih kampus</option>
                            {KAMPUS_LIST.map(k => (
                              <option key={k.id} value={k.id}>{k.nama}</option>
                            ))}
                          </select>
                          {row.kampusRaw && (
                            <div className="text-[10px] text-slate-400 mt-1">Asli: {row.kampusRaw}</div>
                          )}
                        </td>
                        <td className="p-2 border">{row.prodiRaw}</td>
                        <td className="p-2 border">
                          {row.statusRaw}
                          {!STATUS_LIST.find(s => s.value === row.statusValue) && (
                            <span className="ml-1 text-rose-500">(tidak dikenal)</span>
                          )}
                        </td>
                        <td className="p-2 border text-center">
                          {row.valid && kampusMapping[row.index] ? '✓' : '✗'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setStep('map')}>
                  Kembali ke Pemetaan
                </Button>
                <Button onClick={handleImport} disabled={loading} className="bg-indigo-600">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Import {previewRows.filter(r => r.valid && kampusMapping[r.index]).length} Data
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Client ────────────────────────────────────────────────────────
export function PenerimaanPTClient({
  taAktif, userRole,
}: {
  taAktif: { id: string; nama: string; semester: number } | null
  userRole: string
}) {
  const [dynamicJalurList, setDynamicJalurList] = useState(JALUR_LIST)
  const [isExporting, setIsExporting] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  const addJalur = (value: string, label: string, color: string) => {
    setDynamicJalurList(prev => [...prev, { value: value as JalurPT, label, color }])
  }

  const handleExportCSV = async () => {
    if (!taAktif) return
    setIsExporting(true)
    const rows = await getSemuaPenerimaan(taAktif.id)
    exportCSV(rows, taAktif.nama, dynamicJalurList)
    setIsExporting(false)
  }

  const handleExportPDF = async () => {
    if (!taAktif) return
    setIsExporting(true)
    const rows = await getSemuaPenerimaan(taAktif.id)
    exportPDF(rows, taAktif.nama, dynamicJalurList)
    setIsExporting(false)
  }

  if (!taAktif) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="h-8 w-8 text-amber-400" />
        <p className="text-sm font-medium text-amber-600">Tahun Ajaran aktif belum diatur.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-surface text-xs text-slate-500 flex-1">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>TA {taAktif.nama} · Semester {taAktif.semester === 1 ? 'Ganjil' : 'Genap'}</span>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}
            className="h-8 text-xs gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-lg">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Import Excel</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={isExporting}
            className="h-8 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg">
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}
            className="h-8 text-xs gap-1.5 border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg">
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePdf className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="input" className="space-y-4">
        <TabsList className="bg-surface border border-surface p-0.5 grid grid-cols-2 md:grid-cols-4 h-auto rounded-xl">
          <TabsTrigger value="input"
            className="py-2.5 rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs font-semibold flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Input Jalur</span>
          </TabsTrigger>
          <TabsTrigger value="siswa"
            className="py-2.5 rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs font-semibold flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>Per Siswa</span>
          </TabsTrigger>
          <TabsTrigger value="kampus"
            className="py-2.5 rounded-lg data-[state=active]:bg-violet-600 data-[state=active]:text-white text-xs font-semibold flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            <span>Per Kampus</span>
          </TabsTrigger>
          <TabsTrigger value="analitik"
            className="py-2.5 rounded-lg data-[state=active]:bg-amber-500 data-[state=active]:text-white text-xs font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Analitik</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="input" className="m-0">
          <TabInputJalur taId={taAktif.id} dynamicJalurList={dynamicJalurList} addJalur={addJalur} />
        </TabsContent>
        <TabsContent value="siswa" className="m-0">
          <TabPerSiswa taId={taAktif.id} dynamicJalurList={dynamicJalurList} />
        </TabsContent>
        <TabsContent value="kampus" className="m-0">
          <TabPerKampus taId={taAktif.id} dynamicJalurList={dynamicJalurList} />
        </TabsContent>
        <TabsContent value="analitik" className="m-0">
          <TabAnalitik taId={taAktif.id} dynamicJalurList={dynamicJalurList} />
        </TabsContent>
      </Tabs>

      <ImportExcelModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        taId={taAktif.id}
        dynamicJalurList={dynamicJalurList}
        onImportSuccess={() => window.location.reload()}
      />
    </div>
  )
}