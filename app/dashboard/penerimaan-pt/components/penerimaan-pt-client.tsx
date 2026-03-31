// Lokasi: app/dashboard/penerimaan-pt/components/penerimaan-pt-client.tsx
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
  Download, Printer, BarChart3, Users, Building2, BookOpen,
  ChevronDown, ChevronUp, FileSpreadsheet, FileText as FilePdf,
  TrendingUp, Award, Filter
} from 'lucide-react'
import {
  getSiswaKelas12, getPenerimaanByJalur, getPenerimaanSiswa,
  getPenerimaanByKampus, getAnalitikPenerimaan, getSemuaPenerimaan,
  tambahPenerimaan, updatePenerimaan, hapusPenerimaan,
  JALUR_LIST, STATUS_LIST,
} from '../actions'
import type { JalurPT, StatusPenerimaan, PenerimaanRow } from '../actions'
import kampusData from '@/data/kampus.json'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────
type Kampus = { id: string; nama: string; singkatan: string; kota: string; provinsi: string; jenis: string }
type SiswaRow = { id: string; nama_lengkap: string; nisn: string; foto_url: string | null; tingkat: number; nomor_kelas: string; kelas_kelompok: string; jumlah_diterima: number }

const KAMPUS_LIST = kampusData as Kampus[]

// ── Helpers ────────────────────────────────────────────────────────────
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

function getJalurColor(jalur: string) {
  return JALUR_LIST.find(j => j.value === jalur)?.color ?? 'bg-slate-100 text-slate-600 border-slate-200'
}
function getJalurLabel(jalur: string) {
  return JALUR_LIST.find(j => j.value === jalur)?.label ?? jalur
}
function getStatusColor(status: string) {
  return STATUS_LIST.find(s => s.value === status)?.color ?? 'bg-slate-100 text-slate-600 border-slate-200'
}
function getStatusLabel(status: string) {
  return STATUS_LIST.find(s => s.value === status)?.label ?? status
}

// ── KampusAutocomplete ────────────────────────────────────────────────
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

  // Close on outside click
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

// ── Form Tambah/Edit Penerimaan ────────────────────────────────────────
function FormPenerimaan({
  siswa, taId, jalurDefault, editData, onSaved, onClose,
}: {
  siswa: Pick<SiswaRow, 'id' | 'nama_lengkap' | 'nisn' | 'foto_url' | 'tingkat' | 'nomor_kelas' | 'kelas_kelompok'>
  taId: string
  jalurDefault?: JalurPT
  editData?: PenerimaanRow
  onSaved: () => void
  onClose: () => void
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
            {JALUR_LIST.map(j => (
              <button key={j.value} type="button" onClick={() => setJalur(j.value)}
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
function ModalInputPenerimaan({ siswa, taId, jalurDefault, editData, onSaved, onClose }: {
  siswa: SiswaRow | null
  taId: string
  jalurDefault?: JalurPT
  editData?: PenerimaanRow
  onSaved: () => void
  onClose: () => void
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
            <FormPenerimaan siswa={siswa} taId={taId} jalurDefault={jalurDefault}
              editData={editData} onSaved={onSaved} onClose={onClose} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ── Tab 1: Input per Jalur ─────────────────────────────────────────────
function TabInputJalur({ taId }: { taId: string }) {
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

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const [siswa, penerimaan] = await Promise.all([
      getSiswaKelas12(taId),
      getPenerimaanByJalur(activeJalur, taId),
    ])
    setSiswaList(siswa)
    setPenerimaanList(penerimaan)
    setIsLoading(false)
  }, [taId, activeJalur])

  useEffect(() => { loadData() }, [loadData])

  // Kelas unik untuk filter
  const kelasUnik = useMemo(() => {
    const set = new Set(siswaList.map(s => `${s.tingkat}-${s.nomor_kelas}`))
    return Array.from(set).sort()
  }, [siswaList])

  const siswaFiltered = useMemo(() => {
    return siswaList.filter(s => {
      const kelasStr = `${s.tingkat}-${s.nomor_kelas}`
      if (filterKelas && kelasStr !== filterKelas) return false
      if (searchQuery.trim().length >= 2) {
        const q = searchQuery.toLowerCase()
        if (!s.nama_lengkap.toLowerCase().includes(q) && !s.nisn.includes(q)) return false
      }
      return true
    })
  }, [siswaList, filterKelas, searchQuery])

  // Group penerimaan by siswa_id
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

  const jalurInfo = JALUR_LIST.find(j => j.value === activeJalur)!

  return (
    <div className="space-y-3">
      {/* Pilih jalur */}
      <div className="flex flex-wrap gap-2">
        {JALUR_LIST.map(j => (
          <button key={j.value} onClick={() => setActiveJalur(j.value)}
            className={cn('px-4 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm',
              activeJalur === j.value ? j.color + ' shadow-md scale-[1.02]' : 'bg-surface text-slate-500 border-surface hover:bg-surface-2')}>
            {j.label}
          </button>
        ))}
      </div>

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
          {kelasUnik.length > 1 && (
            <Select value={filterKelas || 'all'} onValueChange={v => setFilterKelas(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-9 w-32 text-xs rounded-xl border-surface">
                <SelectValue placeholder="Semua kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Semua kelas</SelectItem>
                {kelasUnik.map(k => <SelectItem key={k} value={k} className="text-xs">Kelas {k}</SelectItem>)}
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
      ) : siswaFiltered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-2 text-slate-400">
          <Users className="h-10 w-10 text-slate-200" />
          <p className="text-sm font-medium">Belum ada siswa kelas 12 aktif</p>
        </div>
      ) : (
        <div className="space-y-2">
          {siswaFiltered.map(siswa => {
            const entries = penerimaanBySiswa.get(siswa.id) ?? []
            const isExpanded = expandedSiswa.has(siswa.id)
            const diterima = entries.filter(e => e.status === 'DITERIMA')

            return (
              <div key={siswa.id} className="rounded-xl border border-surface bg-surface overflow-hidden">
                {/* Header row */}
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

                {/* Expanded entries */}
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

      {showModal && selectedSiswa && (
        <ModalInputPenerimaan siswa={selectedSiswa} taId={taId} jalurDefault={activeJalur}
          editData={editData}
          onSaved={async () => { setShowModal(false); await loadData() }}
          onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}

// ── Tab 2: Per Siswa ───────────────────────────────────────────────────
function TabPerSiswa({ taId }: { taId: string }) {
  const [siswaList, setSiswaList] = useState<SiswaRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSiswa, setSelectedSiswa] = useState<SiswaRow | null>(null)
  const [entries, setEntries] = useState<PenerimaanRow[]>([])
  const [isLoadingEntries, setIsLoadingEntries] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editData, setEditData] = useState<PenerimaanRow | undefined>()

  useEffect(() => {
    getSiswaKelas12(taId).then(data => { setSiswaList(data); setIsLoading(false) })
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
    const updatedList = await getSiswaKelas12(taId)
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
            {/* Header */}
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
                {JALUR_LIST.map(j => {
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
        <ModalInputPenerimaan siswa={selectedSiswa} taId={taId} editData={editData}
          onSaved={async () => { setShowModal(false); await reload() }}
          onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}

// ── Tab 3: Per Kampus ──────────────────────────────────────────────────
function TabPerKampus({ taId }: { taId: string }) {
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
          {/* Header kampus */}
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

          {/* Filter jalur */}
          {entries.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilterJalur('')}
                className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                  filterJalur === '' ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-surface-2 text-slate-500 border-surface hover:bg-surface-3')}>
                Semua ({entries.length})
              </button>
              {JALUR_LIST.map(j => {
                const count = entries.filter(e => e.jalur === j.value).length
                if (!count) return null
                return (
                  <button key={j.value} onClick={() => setFilterJalur(j.value)}
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
                      <Badge label={getJalurLabel(entry.jalur)} colorClass={getJalurColor(entry.jalur)} />
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

// ── Tab 4: Analitik ────────────────────────────────────────────────────
function TabAnalitik({ taId }: { taId: string }) {
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

  // Ringkasan per jalur
  const jalurSummary = JALUR_LIST.map(j => {
    const entries = data.perJalur.filter(p => p.jalur === j.value)
    const diterima = entries.find(e => e.status === 'DITERIMA')?.total ?? 0
    const tidakDiterima = entries.find(e => e.status === 'TIDAK_DITERIMA')?.total ?? 0
    return { ...j, diterima, tidakDiterima, total: diterima + tidakDiterima }
  }).filter(j => j.total > 0)

  const maxDiterima = Math.max(...jalurSummary.map(j => j.diterima), 1)

  return (
    <div className="space-y-6">
      {/* Overview cards */}
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

      {/* Progress bar */}
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
        {/* Distribusi per jalur */}
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

        {/* Top Kampus */}
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
function exportCSV(rows: PenerimaanRow[], taName: string) {
  const headers = ['Nama Lengkap', 'NISN', 'Kelas', 'Jalur', 'Perguruan Tinggi', 'Program Studi', 'Status', 'Catatan']
  const csvRows = rows.map(r => [
    r.nama_lengkap ?? '',
    r.nisn ?? '',
    `${r.tingkat ?? ''}-${r.nomor_kelas ?? ''} ${r.kelas_kelompok ?? ''}`.trim(),
    getJalurLabel(r.jalur),
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

function exportPDF(rows: PenerimaanRow[], taName: string) {
  const grouped = JALUR_LIST.map(j => ({
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
    <thead><tr><th>No</th><th>Nama Lengkap</th><th>NISN</th><th>Kelas</th><th>Perguruan Tinggi</th><th>Program Studi</th><th>Status</th></tr></thead>
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

// ── Main Client ────────────────────────────────────────────────────────
export function PenerimaanPTClient({
  taAktif, userRole,
}: {
  taAktif: { id: string; nama: string; semester: number } | null
  userRole: string
}) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExportCSV = async () => {
    if (!taAktif) return
    setIsExporting(true)
    const rows = await getSemuaPenerimaan(taAktif.id)
    exportCSV(rows, taAktif.nama)
    setIsExporting(false)
  }

  const handleExportPDF = async () => {
    if (!taAktif) return
    setIsExporting(true)
    const rows = await getSemuaPenerimaan(taAktif.id)
    exportPDF(rows, taAktif.nama)
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
      {/* TA strip + export */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-surface text-xs text-slate-500 flex-1">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>TA {taAktif.nama} · Semester {taAktif.semester === 1 ? 'Ganjil' : 'Genap'}</span>
        </div>
        <div className="flex gap-1.5">
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
          <TabInputJalur taId={taAktif.id} />
        </TabsContent>
        <TabsContent value="siswa" className="m-0">
          <TabPerSiswa taId={taAktif.id} />
        </TabsContent>
        <TabsContent value="kampus" className="m-0">
          <TabPerKampus taId={taAktif.id} />
        </TabsContent>
        <TabsContent value="analitik" className="m-0">
          <TabAnalitik taId={taAktif.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}