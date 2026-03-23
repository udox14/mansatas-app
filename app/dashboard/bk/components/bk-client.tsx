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
  searchSiswaBinaan, getRekamanSiswa, getListSiswaBerrekaman,
  tambahRekamanBK, editRekamanBK, hapusRekamanBK,
  tambahSesiPenanganan, hapusSesiPenanganan,
  tambahTopikBK, editTopikBK, hapusTopikBK,
  sinkronKelasBinaanDariPenugasan, getKelasBinaanPerGuru,
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

// ── Sub: RekamanItem (extracted untuk avoid hooks-in-map) ────────────
function RekamanItem({ rekaman, canEdit, topikAll, guruBkId, taId, onChanged, onDeleted }: {
  rekaman: Rekaman
  canEdit: boolean
  topikAll: Topik[]
  guruBkId: string
  taId: string
  onChanged: () => void
  onDeleted: () => void
}) {
  const [sesiList, setSesiList] = useState<SesiPenanganan[]>(rekaman.penanganan)
  const [isEditing, setIsEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-surface bg-surface overflow-hidden">
      {/* Header — klik untuk expand/collapse */}
      <button
        type="button"
        onClick={() => { if (!isEditing) setExpanded(e => !e) }}
        className="w-full px-3 py-2.5 hover:bg-surface-2 transition-colors text-left"
      >
        {/* Baris atas: badge bidang + topik + chevron */}
        <div className="flex items-center gap-2">
          <Badge label={rekaman.bidang} colorClass={BIDANG_COLORS[rekaman.bidang]} />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate flex-1 min-w-0">
            {rekaman.topik_nama || <span className="text-slate-400 dark:text-slate-500 italic font-normal">Tanpa topik</span>}
          </span>
          <span className="shrink-0 text-slate-400 dark:text-slate-500 ml-1">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        </div>
        {/* Baris bawah: tanggal + tindak lanjut */}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {new Date(rekaman.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <Badge
            label={TINDAK_LANJUT_OPTIONS.find(t => t.value === rekaman.tindak_lanjut)?.label ?? rekaman.tindak_lanjut}
            colorClass={TINDAK_LANJUT_COLORS[rekaman.tindak_lanjut]}
          />
        </div>
      </button>

      {/* Body — hanya tampil saat expanded */}
      {expanded && (
      <div className="border-t border-surface-2 px-3 py-3 space-y-3">
        {isEditing ? (
          <FormRekaman
            siswa={{ id: '', nisn: '', nama_lengkap: '', foto_url: null, tingkat: 0, nomor_kelas: '', kelas_kelompok: '' }}
            taId={taId}
            guruBkId={guruBkId}
            topikAll={topikAll}
            editData={rekaman}
            onSaved={updated => {
              setIsEditing(false)
              onChanged()
            }}
            onClose={() => setIsEditing(false)}
          />
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              <Clock className="h-3 w-3 shrink-0" />
              Dicatat oleh {rekaman.guru_nama?.split(',')[0]} · Diperbarui {new Date(rekaman.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>

            {rekaman.deskripsi ? (
              <div className="rounded-lg bg-surface-2 px-3 py-2.5">
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Deskripsi</p>
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{rekaman.deskripsi}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">Tidak ada deskripsi.</p>
            )}

            <div className="space-y-1.5">
              <SesiPenangananPanel
                rekamanId={rekaman.id}
                sesiList={sesiList}
                canEdit={canEdit}
                onChanged={newList => { setSesiList(newList); onChanged() }}
              />
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-surface-2">
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Tindak Lanjut:</p>
              <Badge
                label={TINDAK_LANJUT_OPTIONS.find(t => t.value === rekaman.tindak_lanjut)?.label ?? rekaman.tindak_lanjut}
                colorClass={TINDAK_LANJUT_COLORS[rekaman.tindak_lanjut]}
              />
            </div>

            {canEdit && (
              <div className="flex gap-3 pt-1 border-t border-surface-2">
                <button onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium">
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button onClick={async () => {
                  if (!confirm('Hapus rekaman ini?')) return
                  const res = await hapusRekamanBK(rekaman.id)
                  if (res.error) { alert(res.error); return }
                  onDeleted()
                }} className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 font-medium ml-auto">
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

// ── Sub: Modal Detail Rekaman Siswa ──────────────────────────────────
function ModalDetailSiswa({
  siswa, taId, guruBkId, userRole, topikAll, onClose, onDataChanged,
}: {
  siswa: { id: string; nama_lengkap: string; nisn: string; foto_url: string | null; tingkat: number; nomor_kelas: string; kelas_kelompok: string }
  taId: string
  guruBkId: string
  userRole: string
  topikAll: Topik[]
  onClose: () => void
  onDataChanged: () => void
}) {
  const [rekamanList, setRekamanList] = useState<Rekaman[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [bidangFilter, setBidangFilter] = useState<BidangBK | 'Semua'>('Semua')
  const canEdit = userRole === 'guru_bk' || userRole === 'super_admin'

  useEffect(() => {
    getRekamanSiswa(siswa.id, taId).then(data => {
      setRekamanList(data as Rekaman[])
      setIsLoading(false)
    })
  }, [siswa.id, taId])

  const rekamanFiltered = bidangFilter === 'Semua'
    ? rekamanList
    : rekamanList.filter(r => r.bidang === bidangFilter)

  const TIPE_COLOR: Record<TipePenanganan, string> = {
    KONSELING:          'bg-blue-50 text-blue-700 border-blue-200',
    KONSELING_KELOMPOK: 'bg-violet-50 text-violet-700 border-violet-200',
    HOME_VISIT:         'bg-amber-50 text-amber-700 border-amber-200',
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl rounded-xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-surface-2 shrink-0 space-y-0">
          {/* Baris 1: info siswa + tombol close (bawaan Dialog) */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
              {siswa.foto_url
                ? <img src={siswa.foto_url} alt="" className="h-full w-full object-cover" />
                : <span className="text-sm font-bold text-slate-500">{siswa.nama_lengkap.charAt(0)}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">{siswa.nama_lengkap}</DialogTitle>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">Kelas {siswa.tingkat}-{siswa.nomor_kelas} {siswa.kelas_kelompok}</p>
            </div>
          </div>
          {/* Baris 2: tombol rekaman baru (full width di mobile) */}
          {canEdit && (
            <div className="pt-2">
              <Button size="sm" onClick={() => setShowForm(true)}
                className="w-full sm:w-auto h-8 text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg">
                <Plus className="h-3.5 w-3.5" /> Rekaman Baru
              </Button>
            </div>
          )}
        </DialogHeader>

        {/* Filter bidang */}
        {rekamanList.length > 0 && (
          <div className="px-4 py-2 border-b border-surface-2 flex gap-1.5 flex-wrap shrink-0">
            <button onClick={() => setBidangFilter('Semua')}
              className={cn('px-2.5 py-1 rounded-md text-xs font-semibold border transition-all',
                bidangFilter === 'Semua' ? 'bg-slate-900 text-white border-slate-900' : 'bg-surface-2 text-slate-500 dark:text-slate-400 border-surface hover:bg-surface-3')}>
              Semua ({rekamanList.length})
            </button>
            {BIDANG_LIST.map(b => {
              const count = rekamanList.filter(r => r.bidang === b).length
              if (!count) return null
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

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-3 space-y-3">
            {isLoading && (
              <div className="flex items-center justify-center py-10 gap-2 text-slate-400 dark:text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Memuat riwayat...</span>
              </div>
            )}

            {!isLoading && rekamanFiltered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400 dark:text-slate-500">
                <FileText className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                <p className="text-sm">Belum ada rekaman BK untuk siswa ini</p>
              </div>
            )}

            {!isLoading && rekamanFiltered.map(r => (
              <RekamanItem
                key={r.id}
                rekaman={r}
                canEdit={canEdit}
                topikAll={topikAll}
                guruBkId={guruBkId}
                taId={taId}
                onChanged={() => onDataChanged()}
                onDeleted={() => {
                  setRekamanList(prev => prev.filter(x => x.id !== r.id))
                  onDataChanged()
                }}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Form tambah rekaman baru */}
        {showForm && (
          <div className="border-t border-surface-2 px-4 py-3 shrink-0 bg-surface">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Rekaman Baru</p>
              <button onClick={() => setShowForm(false)}
                className="p-1 rounded text-slate-400 dark:text-slate-500 hover:bg-surface-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <FormRekaman
              siswa={siswa as any}
              taId={taId}
              guruBkId={guruBkId}
              topikAll={topikAll}
              onSaved={() => {}}
              onClose={async () => {
                setShowForm(false)
                const data = await getRekamanSiswa(siswa.id, taId)
                setRekamanList(data as Rekaman[])
                onDataChanged()
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Sub: Tab Rekaman BK (tabel + modal) ───────────────────────────────
function TabRekaman({ currentUserId, userRole, taAktif, topikAll, isAdmin, kelasBinaan }: {
  currentUserId: string
  userRole: string
  taAktif: { id: string; nama: string; semester: number } | null
  topikAll: Topik[]
  isAdmin: boolean
  kelasBinaan: KelasInfo[]
}) {
  // Filter state
  const [filterBidang, setFilterBidang] = useState<BidangBK | ''>('')
  const [filterTindakLanjut, setFilterTindakLanjut] = useState<TindakLanjut | ''>('')
  const [filterKelas, setFilterKelas] = useState('')
  const [page, setPage] = useState(1)

  // Data state
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSiswa, setSelectedSiswa] = useState<any | null>(null)

  // Search tambah siswa baru
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SiswaResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const PAGE_SIZE = 10
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const canEdit = userRole === 'guru_bk' || userRole === 'super_admin'

  const loadData = useCallback(async (p: number = 1) => {
    if (!taAktif) return
    setIsLoading(true)
    const res = await getListSiswaBerrekaman(
      currentUserId, taAktif.id, isAdmin,
      { bidang: filterBidang, tindak_lanjut: filterTindakLanjut, kelas_id: filterKelas },
      p, PAGE_SIZE
    )
    setRows(res.rows)
    setTotal(res.total)
    setPage(p)
    setIsLoading(false)
  }, [currentUserId, taAktif, isAdmin, filterBidang, filterTindakLanjut, filterKelas])

  // Auto-load saat mount dan saat filter berubah
  useEffect(() => { loadData(1) }, [filterBidang, filterTindakLanjut, filterKelas, taAktif])

  // Lazy search siswa baru
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
      {/* TOOLBAR: Filter + Search */}
      <div className="bg-surface border border-surface rounded-xl p-3 space-y-2">
        {/* Baris 1: filter */}
        <div className="flex flex-wrap gap-2">
          <Select value={filterBidang || "all"} onValueChange={v => setFilterBidang(v === "all" ? "" : v as any)}>
            <SelectTrigger className="h-8 w-36 text-xs rounded-lg border-surface">
              <SelectValue placeholder="Semua bidang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Semua bidang</SelectItem>
              {BIDANG_LIST.map(b => <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterTindakLanjut || "all"} onValueChange={v => setFilterTindakLanjut(v === "all" ? "" : v as any)}>
            <SelectTrigger className="h-8 w-44 text-xs rounded-lg border-surface">
              <SelectValue placeholder="Semua tindak lanjut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Semua tindak lanjut</SelectItem>
              {TINDAK_LANJUT_OPTIONS.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {isAdmin && kelasBinaan.length > 0 && (
            <Select value={filterKelas || "all"} onValueChange={v => setFilterKelas(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 w-36 text-xs rounded-lg border-surface">
                <SelectValue placeholder="Semua kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Semua kelas</SelectItem>
                {kelasBinaan.map(k => (
                  <SelectItem key={k.id} value={k.id} className="text-xs">
                    {k.tingkat}-{k.nomor_kelas} {k.kelompok}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <button onClick={() => { setFilterBidang(''); setFilterTindakLanjut(''); setFilterKelas('') }}
            className="h-8 px-3 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 hover:bg-surface-2 rounded-lg border border-surface transition-colors">
            Reset filter
          </button>
        </div>

        {/* Baris 2: search tambah rekaman baru */}
        {canEdit && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500 animate-spin" />}
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari siswa untuk buat rekaman baru..."
              className="pl-9 h-9 rounded-lg border-surface bg-surface-2 text-xs"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-surface rounded-xl shadow-lg z-20 overflow-hidden">
                {searchResults.map(s => (
                  <div key={s.id} onClick={() => { setSelectedSiswa(s); setSearchQuery(''); setSearchResults([]) }}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-surface-2 cursor-pointer transition-colors">
                    <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {s.foto_url
                        ? <img src={s.foto_url} alt="" className="h-full w-full object-cover" />
                        : <span className="text-[10px] font-bold text-slate-500">{s.nama_lengkap.charAt(0)}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{s.nama_lengkap}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{s.nisn} · {s.tingkat}-{s.nomor_kelas}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                  </div>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-surface rounded-xl shadow-lg z-20 px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
                Siswa tidak ditemukan di kelas binaan
              </div>
            )}
          </div>
        )}
      </div>

      {/* TABEL SISWA */}
      <div className="bg-surface border border-surface rounded-xl overflow-hidden">
        {/* Header info */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-2">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {isLoading ? 'Memuat...' : `${total} siswa terrekam`}
          </p>
          <button onClick={() => loadData(page)}
            className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-600 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400 dark:text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Memuat data...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400 dark:text-slate-500">
            <HeartHandshake className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada rekaman BK</p>
            {canEdit && <p className="text-xs">Cari siswa di atas untuk membuat rekaman baru</p>}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-2 border-b border-surface-2">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">Siswa</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">Kelas</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">Bidang</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">Rekaman</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">Terakhir</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-2">
                  {rows.map((row: any) => (
                    <tr key={row.siswa_id}
                      onClick={() => setSelectedSiswa(row)}
                      className="hover:bg-surface-2 cursor-pointer transition-colors group">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                            {row.foto_url
                              ? <img src={row.foto_url} alt="" className="h-full w-full object-cover" />
                              : <span className="text-[10px] font-bold text-slate-500">{row.nama_lengkap?.charAt(0)}</span>}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate text-xs">{row.nama_lengkap}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{row.nisn}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {row.tingkat}-{row.nomor_kelas} <span className="text-slate-400 dark:text-slate-500">{row.kelas_kelompok}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(row.bidang_list || '').split(',').filter(Boolean).map((b: string) => (
                            <Badge key={b} label={b.trim()} colorClass={BIDANG_COLORS[b.trim() as BidangBK] ?? 'bg-surface-3 text-slate-500 border-surface'} />
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{row.jumlah_rekaman}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {new Date(row.rekaman_terakhir).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.belum_count > 0 ? (
                          <Badge label={`${row.belum_count} belum`} colorClass="bg-amber-50 text-amber-700 border-amber-200" />
                        ) : (
                          <Badge label="Selesai" colorClass="bg-emerald-50 text-emerald-700 border-emerald-200" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-surface-2">
              {rows.map((row: any) => (
                <div key={row.siswa_id}
                  onClick={() => setSelectedSiswa(row)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 cursor-pointer transition-colors">
                  <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {row.foto_url
                      ? <img src={row.foto_url} alt="" className="h-full w-full object-cover" />
                      : <span className="text-xs font-bold text-slate-500">{row.nama_lengkap?.charAt(0)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{row.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {row.tingkat}-{row.nomor_kelas} · {row.jumlah_rekaman} rekaman
                    </p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(row.bidang_list || '').split(',').filter(Boolean).map((b: string) => (
                        <Badge key={b} label={b.trim()} colorClass={BIDANG_COLORS[b.trim() as BidangBK] ?? 'bg-surface-3 text-slate-500 border-surface'} />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {row.belum_count > 0
                      ? <Badge label={`${row.belum_count} belum`} colorClass="bg-amber-50 text-amber-700 border-amber-200" />
                      : <Badge label="Selesai" colorClass="bg-emerald-50 text-emerald-700 border-emerald-200" />}
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-2">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Hal. {page} dari {totalPages} ({total} siswa)
                </span>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => loadData(page - 1)}
                    className="h-7 px-3 text-xs rounded-lg">← Prev</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => loadData(page + 1)}
                    className="h-7 px-3 text-xs rounded-lg">Next →</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal detail siswa */}
      {selectedSiswa && (
        <ModalDetailSiswa
          siswa={{
            id: selectedSiswa.siswa_id || selectedSiswa.id,
            nama_lengkap: selectedSiswa.nama_lengkap,
            nisn: selectedSiswa.nisn,
            foto_url: selectedSiswa.foto_url,
            tingkat: selectedSiswa.tingkat,
            nomor_kelas: selectedSiswa.nomor_kelas,
            kelas_kelompok: selectedSiswa.kelas_kelompok,
          }}
          taId={taAktif.id}
          guruBkId={currentUserId}
          userRole={userRole}
          topikAll={topikAll}
          onClose={() => setSelectedSiswa(null)}
          onDataChanged={() => loadData(page)}
        />
      )}
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
function TabKelasBinaan({ kelasBinaan, isAdmin, currentUserId, taAktif }: {
  kelasBinaan: KelasInfo[]
  isAdmin: boolean
  currentUserId: string
  taAktif: { id: string; nama: string; semester: number } | null
}) {
  const [viewMode, setViewMode] = useState<'kelas' | 'guru'>('guru')
  const [perGuruData, setPerGuruData] = useState<{ guru_id: string; guru_nama: string; kelas_list: any[] }[]>([])
  const [isLoadingGuru, setIsLoadingGuru] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [expandedGuru, setExpandedGuru] = useState<Set<string>>(new Set())

  // Load data per guru saat tab guru dipilih (lazy)
  const loadPerGuru = async () => {
    if (!taAktif) return
    setIsLoadingGuru(true)
    const data = await getKelasBinaanPerGuru(taAktif.id)
    setPerGuruData(data)
    // Auto-expand semua guru supaya langsung kelihatan
    setExpandedGuru(new Set(data.map(g => g.guru_id)))
    setIsLoadingGuru(false)
  }

  const handleSinkron = async () => {
    if (!confirm('Sinkronisasi akan mengganti semua data kelas binaan dengan data dari penugasan mengajar semester aktif. Lanjutkan?')) return
    setIsSyncing(true)
    const res = await sinkronKelasBinaanDariPenugasan()
    if (res.error) alert(res.error)
    else {
      alert(res.success)
      // Refresh
      if (viewMode === 'guru') loadPerGuru()
    }
    setIsSyncing(false)
  }

  const toggleGuru = (id: string) => {
    setExpandedGuru(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && (
          <>
            {/* Toggle view */}
            <div className="flex rounded-lg border border-surface overflow-hidden shrink-0">
              <button
                onClick={() => setViewMode('kelas')}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'kelas' ? 'bg-slate-900 text-white' : 'bg-surface text-slate-500 dark:text-slate-400 hover:bg-surface-2')}>
                Per Kelas
              </button>
              <button
                onClick={() => { setViewMode('guru'); if (perGuruData.length === 0) loadPerGuru() }}
                className={cn('px-3 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'guru' ? 'bg-slate-900 text-white' : 'bg-surface text-slate-500 dark:text-slate-400 hover:bg-surface-2')}>
                Per Guru BK
              </button>
            </div>
            {/* Tombol sinkronisasi */}
            <Button size="sm" variant="outline" onClick={handleSinkron} disabled={isSyncing}
              className="h-8 text-xs gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg ml-auto">
              {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
              Sinkron dari Penugasan
            </Button>
          </>
        )}
      </div>

      {/* Info sinkronisasi */}
      {isAdmin && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <span>Klik <strong>Sinkron dari Penugasan</strong> untuk otomatis mengisi kelas binaan berdasarkan data mengajar guru BK di semester aktif.</span>
            {taAktif && (
              <span className="block mt-1 font-semibold text-blue-600">
                TA aktif: {taAktif.nama} · Smt {taAktif.semester === 1 ? 'Ganjil' : 'Genap'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* VIEW: Per Kelas */}
      {(!isAdmin || viewMode === 'kelas') && (
        kelasBinaan.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400 dark:text-slate-500">
            <Users className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada kelas binaan</p>
            {isAdmin
              ? <p className="text-xs">Klik "Sinkron dari Penugasan" untuk mengisi otomatis</p>
              : <p className="text-xs">Hubungi Super Admin untuk mengatur kelas binaan Anda</p>}
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
                      <span className="ml-1.5 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">{k.kelompok}</span>
                    </p>
                    {k.guru_bk_nama && (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">{k.guru_bk_nama}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* VIEW: Per Guru BK */}
      {isAdmin && viewMode === 'guru' && (
        isLoadingGuru ? (
          <div className="flex items-center justify-center py-10 gap-2 text-slate-400 dark:text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Memuat data...</span>
          </div>
        ) : perGuruData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400 dark:text-slate-500">
            <Users className="h-6 w-6 text-slate-300 dark:text-slate-600" />
            <p className="text-sm">Belum ada data kelas binaan</p>
          </div>
        ) : (
          <div className="space-y-2">
            {perGuruData.map(g => (
              <div key={g.guru_id} className="rounded-xl border border-surface bg-surface overflow-hidden">
                {/* Header guru */}
                <button
                  onClick={() => toggleGuru(g.guru_id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left"
                >
                  <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold shrink-0">
                    {g.guru_nama.charAt(0)}
                  </div>
                  <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{g.guru_nama.split(',')[0]}</span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{g.kelas_list.length} kelas</span>
                  {expandedGuru.has(g.guru_id)
                    ? <ChevronUp className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    : <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />}
                </button>
                {/* Kelas binaan */}
                {expandedGuru.has(g.guru_id) && (
                  <div className="border-t border-surface-2 px-4 py-2 flex flex-wrap gap-1.5">
                    {g.kelas_list.map(k => (
                      <span key={k.id}
                        className="text-xs font-semibold px-2 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-700">
                        {k.tingkat}-{k.nomor_kelas} <span className="font-normal text-blue-500">{k.kelompok}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
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
            kelasBinaan={kelasBinaan}
          />
        </TabsContent>

        <TabsContent value="topik" className="m-0">
          <TabTopik currentUserId={currentUserId} topikAll={topikAll} />
        </TabsContent>

        <TabsContent value="kelas" className="m-0">
          <TabKelasBinaan kelasBinaan={kelasBinaan} isAdmin={isAdmin} currentUserId={currentUserId} taAktif={taAktif} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
