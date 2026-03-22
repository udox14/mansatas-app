// Lokasi: app/dashboard/bk/components/bk-client.tsx
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search, Plus, Loader2, X, ChevronRight, HeartHandshake,
  BookOpen, Users, Pencil, Trash2, CheckCircle2, AlertCircle,
  CalendarDays, Clock, FileText, Tag, ChevronDown, ChevronUp
} from 'lucide-react'
import {
  searchSiswaBinaan, getRekamanSiswa, tambahRekamanBK, editRekamanBK,
  hapusRekamanBK, tambahSesiPenanganan, hapusSesiPenanganan,
  tambahTopikBK, editTopikBK, hapusTopikBK,
} from '../actions'
import type { BidangBK, TipePenanganan, TindakLanjut, SesiPenanganan } from '../actions'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────
type Topik = { id: string; bidang: BidangBK; nama: string }
type KelasInfo = { id: string; tingkat: number; nomor_kelas: string; kelompok: string; guru_bk_nama?: string }
type SiswaResult = { id: string; nisn: string; nama_lengkap: string; foto_url: string | null; tingkat: number; nomor_kelas: string; kelas_kelompok: string }
type Rekaman = {
  id: string; bidang: BidangBK; deskripsi: string
  penanganan: SesiPenanganan[]; tindak_lanjut: TindakLanjut
  topik_nama: string | null; guru_nama: string; created_at: string; updated_at: string
}

// ── Konstanta ──────────────────────────────────────────────────────────
const BIDANG_LIST: BidangBK[] = ['Pribadi', 'Karir', 'Sosial', 'Akademik']
const BIDANG_COLORS: Record<BidangBK, string> = {
  Pribadi:  'bg-rose-50 text-rose-700 border-rose-200',
  Karir:    'bg-amber-50 text-amber-700 border-amber-200',
  Sosial:   'bg-blue-50 text-blue-700 border-blue-200',
  Akademik: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}
const TIPE_PENANGANAN: { value: TipePenanganan; label: string }[] = [
  { value: 'KONSELING',          label: 'Konseling' },
  { value: 'KONSELING_KELOMPOK', label: 'Konseling Kelompok' },
  { value: 'HOME_VISIT',         label: 'Home Visit' },
]
const TINDAK_LANJUT_OPTIONS: { value: TindakLanjut; label: string }[] = [
  { value: 'BELUM',                label: 'Belum' },
  { value: 'SUDAH',                label: 'Sudah' },
  { value: 'KOLABORASI_ORANG_TUA', label: 'Kolaborasi dengan Orang Tua' },
  { value: 'PEMANGGILAN_ORANG_TUA',label: 'Pemanggilan Orang Tua' },
]
const TINDAK_LANJUT_COLORS: Record<TindakLanjut, string> = {
  BELUM:                 'bg-slate-100 text-slate-500 border-slate-200',
  SUDAH:                 'bg-emerald-100 text-emerald-700 border-emerald-200',
  KOLABORASI_ORANG_TUA:  'bg-blue-100 text-blue-700 border-blue-200',
  PEMANGGILAN_ORANG_TUA: 'bg-amber-100 text-amber-700 border-amber-200',
}

// ── Sub: Badge ─────────────────────────────────────────────────────────
function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', colorClass)}>
      {label}
    </span>
  )
}

// ── Sub: Form Tambah/Edit Rekaman ──────────────────────────────────────
function FormRekaman({
  siswa, taId, guruBkId, topikAll, onSaved, onClose,
  editData,
}: {
  siswa: SiswaResult
  taId: string
  guruBkId: string
  topikAll: Topik[]
  onSaved: (rekaman: Rekaman) => void
  onClose: () => void
  editData?: Rekaman
}) {
  const [bidang, setBidang] = useState<BidangBK>(editData?.bidang ?? 'Pribadi')
  const [topikId, setTopikId] = useState(editData?.topik_nama ? '' : '')
  const [deskripsi, setDeskripsi] = useState(editData?.deskripsi ?? '')
  const [tindakLanjut, setTindakLanjut] = useState<TindakLanjut>(editData?.tindak_lanjut ?? 'BELUM')
  const [isSaving, setIsSaving] = useState(false)

  const topikFiltered = topikAll.filter(t => t.bidang === bidang)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      if (editData) {
        const res = await editRekamanBK(editData.id, {
          topik_id: topikId || null,
          deskripsi,
          tindak_lanjut: tindakLanjut,
        })
        if (res.error) { alert(res.error); return }
        onSaved({ ...editData, deskripsi, tindak_lanjut: tindakLanjut })
      } else {
        const res = await tambahRekamanBK({
          siswa_id: siswa.id,
          guru_bk_id: guruBkId,
          tahun_ajaran_id: taId,
          bidang,
          topik_id: topikId || null,
          deskripsi,
          tindak_lanjut: tindakLanjut,
        })
        if (res.error) { alert(res.error); return }
        alert(res.success)
        onClose()
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Bidang layanan */}
      {!editData && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Bidang Layanan <span className="text-rose-500">*</span></label>
          <div className="flex flex-wrap gap-2">
            {BIDANG_LIST.map(b => (
              <button key={b} type="button" onClick={() => { setBidang(b); setTopikId('') }}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all', bidang === b ? BIDANG_COLORS[b] : 'bg-surface-2 text-slate-500 dark:text-slate-400 border-surface hover:bg-surface-3')}
              >{b}</button>
            ))}
          </div>
        </div>
      )}

      {/* Topik */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Topik Permasalahan</label>
        <Select value={topikId} onValueChange={setTopikId}>
          <SelectTrigger className="h-9 text-sm rounded-lg bg-surface-2 border-surface">
            <SelectValue placeholder="Pilih topik (opsional)..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs text-slate-400 dark:text-slate-500 italic">— Tidak dipilih —</SelectItem>
            {topikFiltered.map(t => (
              <SelectItem key={t.id} value={t.id} className="text-sm">{t.nama}</SelectItem>
            ))}
            {topikFiltered.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 italic">Belum ada topik untuk bidang ini</div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Deskripsi */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Deskripsi / Catatan</label>
        <textarea
          value={deskripsi}
          onChange={e => setDeskripsi(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-surface bg-surface-2 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-600 resize-none"
          placeholder="Tuliskan deskripsi masalah secara bebas..."
        />
      </div>

      {/* Tindak Lanjut */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tindak Lanjut</label>
        <div className="flex flex-wrap gap-2">
          {TINDAK_LANJUT_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => setTindakLanjut(opt.value)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                tindakLanjut === opt.value ? TINDAK_LANJUT_COLORS[opt.value] : 'bg-surface-2 text-slate-500 dark:text-slate-400 border-surface hover:bg-surface-3'
              )}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={isSaving}
        className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white text-sm rounded-lg">
        {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : editData ? 'Simpan Perubahan' : 'Simpan Rekaman'}
      </Button>
    </div>
  )
}

// ── Sub: Sesi Penanganan ───────────────────────────────────────────────
function SesiPenangananPanel({ rekamanId, sesiList, canEdit, onChanged }: {
  rekamanId: string
  sesiList: SesiPenanganan[]
  canEdit: boolean
  onChanged: (newList: SesiPenanganan[]) => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [tipe, setTipe] = useState<TipePenanganan>('KONSELING')
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0])
  const [catatan, setCatatan] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleTambah = async () => {
    if (!tanggal) { alert('Tanggal wajib diisi.'); return }
    setIsSaving(true)
    const res = await tambahSesiPenanganan(rekamanId, tipe, tanggal, catatan)
    if (res.error) { alert(res.error); setIsSaving(false); return }
    // Optimistic: tambahkan ke list lokal
    const newSesi: SesiPenanganan = {
      id: Date.now().toString(),
      tipe, tanggal, catatan
    }
    onChanged([...sesiList, newSesi])
    setIsAdding(false)
    setCatatan('')
    setIsSaving(false)
  }

  const handleHapus = async (sesiId: string) => {
    if (!confirm('Hapus sesi penanganan ini?')) return
    const res = await hapusSesiPenanganan(rekamanId, sesiId)
    if (res.error) { alert(res.error); return }
    onChanged(sesiList.filter(s => s.id !== sesiId))
  }

  const TIPE_COLOR: Record<TipePenanganan, string> = {
    KONSELING:          'bg-blue-50 text-blue-700 border-blue-200',
    KONSELING_KELOMPOK: 'bg-violet-50 text-violet-700 border-violet-200',
    HOME_VISIT:         'bg-amber-50 text-amber-700 border-amber-200',
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Penanganan ({sesiList.length})
        </p>
        {canEdit && !isAdding && (
          <button onClick={() => setIsAdding(true)}
            className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
            <Plus className="h-3 w-3" /> Tambah Sesi
          </button>
        )}
      </div>

      {/* Form tambah sesi */}
      {isAdding && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Jenis</label>
              <Select value={tipe} onValueChange={v => setTipe(v as TipePenanganan)}>
                <SelectTrigger className="h-8 text-xs rounded bg-surface border-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPE_PENANGANAN.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Tanggal</label>
              <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                className="h-8 text-xs rounded bg-surface border-surface" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Catatan (opsional)</label>
            <Input value={catatan} onChange={e => setCatatan(e.target.value)}
              placeholder="Catatan singkat sesi ini..."
              className="h-8 text-xs rounded bg-surface border-surface" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleTambah} disabled={isSaving}
              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Simpan'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}
              className="h-7 text-xs rounded">Batal</Button>
          </div>
        </div>
      )}

      {/* List sesi */}
      {sesiList.length === 0 ? (
        <div className="text-[11px] text-slate-400 dark:text-slate-500 italic py-1">
          Belum ada sesi penanganan.
        </div>
      ) : (
        <div className="space-y-1.5">
          {sesiList.map(sesi => (
            <div key={sesi.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-surface-2 group transition-colors">
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 mt-0.5', TIPE_COLOR[sesi.tipe])}>
                {TIPE_PENANGANAN.find(t => t.value === sesi.tipe)?.label ?? sesi.tipe}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                  {new Date(sesi.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                {sesi.catatan && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{sesi.catatan}</p>}
              </div>
              {canEdit && (
                <button onClick={() => handleHapus(sesi.id)}
                  className="p-0.5 rounded text-slate-300 dark:text-slate-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sub: Card Rekaman ──────────────────────────────────────────────────
function CardRekaman({ rekaman, canEdit, topikAll, onDeleted, onUpdated }: {
  rekaman: Rekaman
  canEdit: boolean
  topikAll: Topik[]
  onDeleted: (id: string) => void
  onUpdated: (updated: Rekaman) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [sesiList, setSesiList] = useState<SesiPenanganan[]>(rekaman.penanganan)

  const handleDelete = async () => {
    if (!confirm('Hapus rekaman BK ini beserta semua sesi penanganannya?')) return
    const res = await hapusRekamanBK(rekaman.id)
    if (res.error) { alert(res.error); return }
    onDeleted(rekaman.id)
  }

  return (
    <div className="rounded-xl border border-surface bg-surface overflow-hidden">
      {/* Header card */}
      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-surface-2 transition-colors"
        onClick={() => setIsExpanded(e => !e)}>
        <Badge label={rekaman.bidang} colorClass={BIDANG_COLORS[rekaman.bidang]} />
        <div className="flex-1 min-w-0">
          {rekaman.topik_nama && (
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{rekaman.topik_nama}</p>
          )}
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            {new Date(rekaman.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}{rekaman.guru_nama?.split(',')[0]}
          </p>
        </div>
        <Badge label={TINDAK_LANJUT_OPTIONS.find(t => t.value === rekaman.tindak_lanjut)?.label ?? rekaman.tindak_lanjut}
          colorClass={TINDAK_LANJUT_COLORS[rekaman.tindak_lanjut]} />
        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{sesiList.length} sesi</span>
        {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />}
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="border-t border-surface-2 px-3 py-3 space-y-3">
          {isEditing ? (
            <FormRekaman
              siswa={{ id: '', nisn: '', nama_lengkap: '', foto_url: null, tingkat: 0, nomor_kelas: '', kelas_kelompok: '' }}
              taId=""
              guruBkId=""
              topikAll={topikAll}
              editData={rekaman}
              onSaved={updated => { onUpdated(updated); setIsEditing(false) }}
              onClose={() => setIsEditing(false)}
            />
          ) : (
            <>
              {rekaman.deskripsi && (
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {rekaman.deskripsi}
                </p>
              )}
              <SesiPenangananPanel
                rekamanId={rekaman.id}
                sesiList={sesiList}
                canEdit={canEdit}
                onChanged={setSesiList}
              />
              {canEdit && (
                <div className="flex gap-2 pt-1 border-t border-surface-2">
                  <button onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button onClick={handleDelete}
                    className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 font-medium ml-auto">
                    <Trash2 className="h-3 w-3" /> Hapus
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub: Tab Rekaman BK ────────────────────────────────────────────────
function TabRekaman({ currentUserId, userRole, taAktif, topikAll, isAdmin }: {
  currentUserId: string
  userRole: string
  taAktif: { id: string; nama: string; semester: number } | null
  topikAll: Topik[]
  isAdmin: boolean
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SiswaResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedSiswa, setSelectedSiswa] = useState<SiswaResult | null>(null)
  const [rekamanList, setRekamanList] = useState<Rekaman[]>([])
  const [isLoadingRekaman, setIsLoadingRekaman] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [bidangFilter, setBidangFilter] = useState<BidangBK | 'Semua'>('Semua')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const canEdit = userRole === 'guru_bk' || userRole === 'super_admin'

  // Lazy search dengan debounce
  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); return }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      if (!taAktif) return
      setIsSearching(true)
      const res = await searchSiswaBinaan(currentUserId, searchQuery, taAktif.id)
      setSearchResults(res as SiswaResult[])
      setIsSearching(false)
    }, 400)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [searchQuery, currentUserId, taAktif])

  const handleSelectSiswa = async (siswa: SiswaResult) => {
    setSelectedSiswa(siswa)
    setSearchQuery('')
    setSearchResults([])
    if (!taAktif) return
    setIsLoadingRekaman(true)
    const data = await getRekamanSiswa(siswa.id, taAktif.id)
    setRekamanList(data as Rekaman[])
    setIsLoadingRekaman(false)
  }

  const rekamanFiltered = bidangFilter === 'Semua'
    ? rekamanList
    : rekamanList.filter(r => r.bidang === bidangFilter)

  if (!taAktif) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
        <AlertCircle className="h-8 w-8 text-amber-400" />
        <p className="text-sm font-medium text-amber-600">Tahun Ajaran aktif belum diatur.</p>
        <p className="text-xs">Silakan atur di menu Pengaturan terlebih dahulu.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
        {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 animate-spin" />}
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Cari nama siswa atau NISN..."
          className="pl-9 h-10 rounded-xl border-surface bg-surface text-sm"
        />
        {/* Dropdown hasil search */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-surface rounded-xl shadow-lg z-20 overflow-hidden">
            {searchResults.map(s => (
              <div key={s.id} onClick={() => handleSelectSiswa(s)}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 cursor-pointer transition-colors">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {s.foto_url
                    ? <img src={s.foto_url} alt="" className="h-full w-full object-cover" />
                    : <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{s.nama_lengkap.charAt(0)}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{s.nama_lengkap}</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{s.nisn} · {s.tingkat}-{s.nomor_kelas} {s.kelas_kelompok}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
              </div>
            ))}
          </div>
        )}
        {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-surface rounded-xl shadow-lg z-20 px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
            Siswa tidak ditemukan
          </div>
        )}
      </div>

      {/* Area rekaman siswa */}
      {!selectedSiswa ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
          <div className="p-4 rounded-full bg-surface-2 border border-surface">
            <HeartHandshake className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          </div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cari siswa untuk melihat riwayat</p>
          <p className="text-xs">Ketik minimal 2 karakter nama atau NISN</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Header siswa terpilih */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-surface">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
              {selectedSiswa.foto_url
                ? <img src={selectedSiswa.foto_url} alt="" className="h-full w-full object-cover" />
                : <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{selectedSiswa.nama_lengkap.charAt(0)}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedSiswa.nama_lengkap}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {selectedSiswa.nisn} · Kelas {selectedSiswa.tingkat}-{selectedSiswa.nomor_kelas} {selectedSiswa.kelas_kelompok}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button size="sm" onClick={() => setShowForm(true)}
                  className="h-8 text-xs gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg">
                  <Plus className="h-3.5 w-3.5" /> Rekaman Baru
                </Button>
              )}
              <button onClick={() => { setSelectedSiswa(null); setRekamanList([]) }}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-surface-2 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filter bidang */}
          {rekamanList.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setBidangFilter('Semua')}
                className={cn('px-2.5 py-1 rounded-md text-xs font-semibold border transition-all',
                  bidangFilter === 'Semua' ? 'bg-slate-900 text-white border-slate-900' : 'bg-surface-2 text-slate-500 dark:text-slate-400 border-surface hover:bg-surface-3')}>
                Semua ({rekamanList.length})
              </button>
              {BIDANG_LIST.map(b => {
                const count = rekamanList.filter(r => r.bidang === b).length
                if (count === 0) return null
                return (
                  <button key={b} onClick={() => setBidangFilter(b)}
                    className={cn('px-2.5 py-1 rounded-md text-xs font-semibold border transition-all',
                      bidangFilter === b ? BIDANG_COLORS[b] : 'bg-surface-2 text-slate-500 dark:text-slate-400 border-surface hover:bg-surface-3')}>
                    {b} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {/* Loading */}
          {isLoadingRekaman && (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-400 dark:text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Memuat riwayat...</span>
            </div>
          )}

          {/* Empty rekaman */}
          {!isLoadingRekaman && rekamanFiltered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400 dark:text-slate-500">
              <FileText className="h-6 w-6 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada rekaman BK</p>
              {canEdit && <p className="text-xs">Klik "Rekaman Baru" untuk mulai mencatat</p>}
            </div>
          )}

          {/* List rekaman */}
          {!isLoadingRekaman && rekamanFiltered.length > 0 && (
            <div className="space-y-2">
              {rekamanFiltered.map(r => (
                <CardRekaman
                  key={r.id}
                  rekaman={r}
                  canEdit={canEdit}
                  topikAll={topikAll}
                  onDeleted={id => setRekamanList(prev => prev.filter(x => x.id !== id))}
                  onUpdated={updated => setRekamanList(prev => prev.map(x => x.id === updated.id ? updated : x))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialog form tambah rekaman */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg rounded-xl">
          <DialogHeader className="border-b border-surface-2 pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-rose-500" />
              Rekaman BK Baru — {selectedSiswa?.nama_lengkap.split(' ').slice(0, 2).join(' ')}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-1">
            <div className="py-2 px-1">
              {selectedSiswa && taAktif && (
                <FormRekaman
                  siswa={selectedSiswa}
                  taId={taAktif.id}
                  guruBkId={currentUserId}
                  topikAll={topikAll}
                  onSaved={() => {}}
                  onClose={async () => {
                    setShowForm(false)
                    // Refresh rekaman
                    if (taAktif) {
                      const data = await getRekamanSiswa(selectedSiswa.id, taAktif.id)
                      setRekamanList(data as Rekaman[])
                    }
                  }}
                />
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Sub: Tab Master Topik ──────────────────────────────────────────────
function TabTopik({ currentUserId, topikAll: initialTopik }: {
  currentUserId: string
  topikAll: Topik[]
}) {
  const [topikAll, setTopikAll] = useState<Topik[]>(initialTopik)
  const [activeBidang, setActiveBidang] = useState<BidangBK>('Pribadi')
  const [newNama, setNewNama] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNama, setEditNama] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const topikFiltered = topikAll.filter(t => t.bidang === activeBidang)

  const handleTambah = async () => {
    if (!newNama.trim()) return
    setIsSaving(true)
    const res = await tambahTopikBK(activeBidang, newNama, currentUserId)
    if (res.error) { alert(res.error); setIsSaving(false); return }
    // Optimistic update
    setTopikAll(prev => [...prev, {
      id: Date.now().toString(),
      bidang: activeBidang,
      nama: newNama.trim()
    }])
    setNewNama('')
    setIsSaving(false)
  }

  const handleEdit = async (id: string) => {
    if (!editNama.trim()) return
    setIsSaving(true)
    const res = await editTopikBK(id, editNama)
    if (res.error) { alert(res.error); setIsSaving(false); return }
    setTopikAll(prev => prev.map(t => t.id === id ? { ...t, nama: editNama.trim() } : t))
    setEditingId(null)
    setIsSaving(false)
  }

  const handleHapus = async (id: string, nama: string) => {
    if (!confirm(`Hapus topik "${nama}"?`)) return
    const res = await hapusTopikBK(id)
    if (res.error) { alert(res.error); return }
    setTopikAll(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="space-y-3">
      {/* Tab bidang */}
      <div className="flex gap-1.5 flex-wrap">
        {BIDANG_LIST.map(b => (
          <button key={b} onClick={() => setActiveBidang(b)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
              activeBidang === b ? BIDANG_COLORS[b] : 'bg-surface-2 text-slate-500 dark:text-slate-400 border-surface hover:bg-surface-3')}>
            {b} ({topikAll.filter(t => t.bidang === b).length})
          </button>
        ))}
      </div>

      {/* Form tambah */}
      <div className="flex gap-2">
        <Input
          value={newNama}
          onChange={e => setNewNama(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleTambah() }}
          placeholder={`Topik baru untuk bidang ${activeBidang}...`}
          className="flex-1 h-9 text-sm rounded-lg border-surface bg-surface"
        />
        <Button size="sm" onClick={handleTambah} disabled={isSaving || !newNama.trim()}
          className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" /> Tambah
        </Button>
      </div>

      {/* List topik */}
      <div className="rounded-xl border border-surface bg-surface overflow-hidden">
        {topikFiltered.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
            Belum ada topik untuk bidang {activeBidang}.
          </div>
        ) : (
          <div className="divide-y divide-surface-2">
            {topikFiltered.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 group hover:bg-surface-2 transition-colors">
                {editingId === t.id ? (
                  <>
                    <Input value={editNama} onChange={e => setEditNama(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEdit(t.id) }}
                      autoFocus className="flex-1 h-7 text-sm rounded border-surface" />
                    <button onClick={() => handleEdit(t.id)} disabled={isSaving}
                      className="p-1 rounded text-emerald-600 hover:bg-emerald-50">
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="p-1 rounded text-slate-400 dark:text-slate-500 hover:bg-surface-3">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <Tag className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{t.nama}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingId(t.id); setEditNama(t.nama) }}
                        className="p-1.5 rounded text-blue-500 hover:bg-blue-50">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleHapus(t.id, t.nama)}
                        className="p-1.5 rounded text-rose-500 hover:bg-rose-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub: Tab Kelas Binaan (info only) ─────────────────────────────────
function TabKelasBinaan({ kelasBinaan, isAdmin }: {
  kelasBinaan: KelasInfo[]
  isAdmin: boolean
}) {
  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Assign kelas binaan guru BK dilakukan di <strong>Manajemen Kelas</strong> oleh Super Admin.</span>
        </div>
      )}

      {kelasBinaan.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400 dark:text-slate-500">
          <Users className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada kelas binaan</p>
          <p className="text-xs">Hubungi Super Admin untuk mengatur kelas binaan Anda</p>
        </div>
      ) : (
        <div className="rounded-xl border border-surface bg-surface overflow-hidden">
          <div className="divide-y divide-surface-2">
            {kelasBinaan.map(k => (
              <div key={k.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors">
                <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                  {k.tingkat}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Kelas {k.tingkat}-{k.nomor_kelas}
                    <span className="ml-1.5 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                      {k.kelompok}
                    </span>
                  </p>
                  {isAdmin && k.guru_bk_nama && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{k.guru_bk_nama}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── MAIN ────────────────────────────────────────────────────────────────
export function BKClient({
  currentUserId, userRole, taAktif, topikAll, kelasBinaan, isAdmin,
}: {
  currentUserId: string
  userRole: string
  taAktif: { id: string; nama: string; semester: number } | null
  topikAll: Topik[]
  kelasBinaan: KelasInfo[]
  isAdmin: boolean
}) {
  return (
    <div className="space-y-3">
      {/* TA info strip */}
      {taAktif && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-surface text-xs text-slate-500 dark:text-slate-400">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>TA {taAktif.nama} · Semester {taAktif.semester === 1 ? 'Ganjil' : 'Genap'}</span>
        </div>
      )}

      <Tabs defaultValue="rekaman" className="space-y-3">
        <TabsList className="bg-surface border border-surface p-0.5 grid grid-cols-3 h-auto rounded-lg">
          <TabsTrigger value="rekaman"
            className="py-2 rounded-md data-[state=active]:bg-rose-600 data-[state=active]:text-white text-xs font-medium flex items-center gap-1.5">
            <HeartHandshake className="h-3.5 w-3.5" /> Rekaman BK
          </TabsTrigger>
          <TabsTrigger value="topik"
            className="py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs font-medium flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Master Topik
          </TabsTrigger>
          <TabsTrigger value="kelas"
            className="py-2 rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs font-medium flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Kelas Binaan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rekaman" className="m-0">
          <TabRekaman
            currentUserId={currentUserId}
            userRole={userRole}
            taAktif={taAktif}
            topikAll={topikAll}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="topik" className="m-0">
          <TabTopik currentUserId={currentUserId} topikAll={topikAll} />
        </TabsContent>

        <TabsContent value="kelas" className="m-0">
          <TabKelasBinaan kelasBinaan={kelasBinaan} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
