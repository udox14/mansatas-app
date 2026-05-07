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
  CalendarDays, Clock, FileText, Tag, ChevronDown, ChevronUp,
  UserSearch, ClipboardList, History
} from 'lucide-react'
import {
  searchSiswaBinaan, getRekamanSiswa, getListSiswaBerrekaman,
  tambahRekamanBK, editRekamanBK, hapusRekamanBK,
  tambahSesiPenanganan, hapusSesiPenanganan,
  tambahTopikBK, editTopikBK, hapusTopikBK,
  sinkronKelasBinaanDariPenugasan, getKelasBinaanPerGuru,
} from '../actions'
import type { BidangBK, TipePenanganan, SesiPenanganan } from '../actions'
import { cn, formatNamaKelas } from '@/lib/utils'
import { todayWIB } from '@/lib/time'

// ── Types ──────────────────────────────────────────────────────────────
type Topik = { id: string; bidang: BidangBK; nama: string }
type KelasInfo = { id: string; tingkat: number; nomor_kelas: string; kelompok: string; guru_bk_nama?: string }
type SiswaResult = { id: string; nisn: string; nama_lengkap: string; foto_url: string | null; tingkat: number; nomor_kelas: string; kelas_kelompok: string }
type Rekaman = {
  id: string; bidang: BidangBK; deskripsi: string
  penanganan: SesiPenanganan[]; tindak_lanjut: string; catatan_tindak_lanjut?: string
  topik_nama: string | null; guru_nama: string; created_at: string; updated_at: string
}
type SesiLokal = { _key: string; tipe: TipePenanganan; tanggal: string; catatan: string }

// ── Konstanta ──────────────────────────────────────────────────────────
const BIDANG_LIST: BidangBK[] = ['Pribadi', 'Karir', 'Sosial', 'Akademik']
const BIDANG_COLORS: Record<BidangBK, string> = {
  Pribadi:  'bg-rose-50 text-rose-700 border-rose-200',
  Karir:    'bg-amber-50 text-amber-700 border-amber-200',
  Sosial:   'bg-blue-50 text-blue-700 border-blue-200',
  Akademik: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
}
const TIPE_PENANGANAN: { value: TipePenanganan; label: string }[] = [
  { value: 'KONSELING',          label: 'Konseling' },
  { value: 'KONSELING_KELOMPOK', label: 'Konseling Kelompok' },
  { value: 'HOME_VISIT',         label: 'Home Visit' },
]
const TIPE_COLOR: Record<TipePenanganan, string> = {
  KONSELING:          'bg-blue-50 text-blue-700 border-blue-200',
  KONSELING_KELOMPOK: 'bg-violet-50 text-violet-700 border-violet-200',
  HOME_VISIT:         'bg-amber-50 text-amber-700 border-amber-200',
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', colorClass)}>{label}</span>
}

function AvatarSiswa({ siswa, size = 'md' }: { siswa: Pick<SiswaResult, 'foto_url' | 'nama_lengkap'>; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-sm'
  return (
    <div className={cn('rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center shrink-0 overflow-hidden', cls)}>
      {siswa.foto_url
        ? <img src={siswa.foto_url} alt="" className="h-full w-full object-cover" />
        : <span className="font-bold text-slate-500 dark:text-slate-400">{siswa.nama_lengkap.charAt(0)}</span>}
    </div>
  )
}

// ── Sesi Lokal (belum tersimpan ke DB, untuk form tambah rekaman baru) ─
function SesiLokalPanel({ sesiList, onChange }: { sesiList: SesiLokal[]; onChange: (list: SesiLokal[]) => void }) {
  const [isAdding, setIsAdding] = useState(false)
  const [tipe, setTipe] = useState<TipePenanganan>('KONSELING')
  const [tanggal, setTanggal] = useState(todayWIB())
  const [catatan, setCatatan] = useState('')

  const handleTambah = () => {
    if (!tanggal) { alert('Tanggal wajib diisi.'); return }
    onChange([...sesiList, { _key: Date.now().toString(), tipe, tanggal, catatan }])
    setIsAdding(false); setCatatan('')
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-blue-500" />
          Penanganan
          {sesiList.length > 0 && (
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-blue-200">{sesiList.length}</span>
          )}
        </label>
        {!isAdding && (
          <button type="button" onClick={() => setIsAdding(true)}
            className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold">
            <Plus className="h-3 w-3" /> Tambah Sesi
          </button>
        )}
      </div>

      {isAdding && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Jenis</label>
              <Select value={tipe} onValueChange={v => setTipe(v as TipePenanganan)}>
                <SelectTrigger className="h-8 text-xs rounded-lg bg-surface border-surface"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPE_PENANGANAN.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tanggal</label>
              <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="h-8 text-xs rounded-lg bg-surface border-surface" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Catatan Sesi (opsional)</label>
            <Input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan singkat..." className="h-8 text-xs rounded-lg bg-surface border-surface" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="button" onClick={handleTambah} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg"><Plus className="h-3 w-3 mr-1" /> Tambahkan</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setIsAdding(false)} className="h-7 text-xs rounded-lg">Batal</Button>
          </div>
        </div>
      )}

      {sesiList.length === 0 && !isAdding ? (
        <div className="rounded-lg border border-dashed border-surface-2 py-3 text-center">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Belum ada sesi — klik "+ Tambah Sesi"</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sesiList.map(sesi => (
            <div key={sesi._key} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-surface-2 border border-surface group">
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 mt-0.5', TIPE_COLOR[sesi.tipe])}>
                {TIPE_PENANGANAN.find(t => t.value === sesi.tipe)?.label}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">
                  {new Date(sesi.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                {sesi.catatan && <p className="text-[10px] text-slate-400 truncate italic">{sesi.catatan}</p>}
              </div>
              <button type="button" onClick={() => onChange(sesiList.filter(s => s._key !== sesi._key))}
                className="p-0.5 rounded text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sesi Penanganan DB ─────────────────────────────────────────────────
function SesiPenangananPanel({ rekamanId, sesiList, canEdit, onChanged }: {
  rekamanId: string; sesiList: SesiPenanganan[]; canEdit: boolean; onChanged: (l: SesiPenanganan[]) => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [tipe, setTipe] = useState<TipePenanganan>('KONSELING')
  const [tanggal, setTanggal] = useState(todayWIB())
  const [catatan, setCatatan] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleTambah = async () => {
    if (!tanggal) { alert('Tanggal wajib diisi.'); return }
    setIsSaving(true)
    const res = await tambahSesiPenanganan(rekamanId, tipe, tanggal, catatan)
    if (res.error) { alert(res.error); setIsSaving(false); return }
    onChanged([...sesiList, { id: Date.now().toString(), tipe, tanggal, catatan }])
    setIsAdding(false); setCatatan(''); setIsSaving(false)
  }

  const handleHapus = async (sesiId: string) => {
    if (!confirm('Hapus sesi penanganan ini?')) return
    const res = await hapusSesiPenanganan(rekamanId, sesiId)
    if (res.error) { alert(res.error); return }
    onChanged(sesiList.filter(s => s.id !== sesiId))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Penanganan ({sesiList.length})</p>
        {canEdit && !isAdding && (
          <button onClick={() => setIsAdding(true)} className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold">
            <Plus className="h-3 w-3" /> Tambah Sesi
          </button>
        )}
      </div>
      {isAdding && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Jenis</label>
              <Select value={tipe} onValueChange={v => setTipe(v as TipePenanganan)}>
                <SelectTrigger className="h-8 text-xs rounded bg-surface border-surface"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPE_PENANGANAN.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tanggal</label>
              <Input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="h-8 text-xs rounded bg-surface border-surface" />
            </div>
          </div>
          <Input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan singkat sesi..." className="h-8 text-xs rounded bg-surface border-surface" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleTambah} disabled={isSaving} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Simpan'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="h-7 text-xs rounded">Batal</Button>
          </div>
        </div>
      )}
      {sesiList.length === 0
        ? <p className="text-[11px] text-slate-400 dark:text-slate-500 italic py-1">Belum ada sesi penanganan.</p>
        : (
          <div className="space-y-1.5">
            {sesiList.map(sesi => (
              <div key={sesi.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-surface-2 group transition-colors">
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 mt-0.5', TIPE_COLOR[sesi.tipe])}>
                  {TIPE_PENANGANAN.find(t => t.value === sesi.tipe)?.label ?? sesi.tipe}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 dark:text-slate-300 font-medium">
                    {new Date(sesi.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  {sesi.catatan && <p className="text-[10px] text-slate-400 truncate">{sesi.catatan}</p>}
                </div>
                {canEdit && (
                  <button onClick={() => handleHapus(sesi.id)}
                    className="p-0.5 rounded text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all shrink-0">
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

// ── Form Tambah/Edit Rekaman ───────────────────────────────────────────
function FormRekaman({ siswa, taId, guruBkId, topikAll, onSaved, onClose, editData }: {
  siswa: SiswaResult; taId: string; guruBkId: string; topikAll: Topik[]
  onSaved: (r: Rekaman) => void; onClose: () => void; editData?: Rekaman
}) {
  const [bidang, setBidang] = useState<BidangBK>(editData?.bidang ?? 'Pribadi')
  const [topikId, setTopikId] = useState('')
  const [deskripsi, setDeskripsi] = useState(editData?.deskripsi ?? '')
  const [tindakLanjut, setTindakLanjut] = useState(editData?.tindak_lanjut ?? '')
  const [catatanTL, setCatatanTL] = useState(editData?.catatan_tindak_lanjut ?? '')
  const [sesiLokal, setSesiLokal] = useState<SesiLokal[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const topikFiltered = topikAll.filter(t => t.bidang === bidang)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      if (editData) {
        const res = await editRekamanBK(editData.id, { topik_id: topikId || null, deskripsi, tindak_lanjut: tindakLanjut, catatan_tindak_lanjut: catatanTL })
        if (res.error) { alert(res.error); return }
        onSaved({ ...editData, deskripsi, tindak_lanjut: tindakLanjut, catatan_tindak_lanjut: catatanTL })
      } else {
        const res = await tambahRekamanBK({ siswa_id: siswa.id, guru_bk_id: guruBkId, tahun_ajaran_id: taId, bidang, topik_id: topikId || null, deskripsi, tindak_lanjut: tindakLanjut, catatan_tindak_lanjut: catatanTL })
        if (res.error) { alert(res.error); return }
        if (res.id && sesiLokal.length > 0) {
          for (const s of sesiLokal) await tambahSesiPenanganan(res.id, s.tipe, s.tanggal, s.catatan)
        }
        onClose()
      }
    } finally { setIsSaving(false) }
  }

  return (
    <div className="space-y-4">
      {!editData && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Bidang Layanan <span className="text-rose-500">*</span></label>
          <div className="flex flex-wrap gap-2">
            {BIDANG_LIST.map(b => (
              <button key={b} type="button" onClick={() => { setBidang(b); setTopikId('') }}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                  bidang === b ? BIDANG_COLORS[b] : 'bg-surface-2 text-slate-500 dark:text-slate-400 border-surface hover:bg-surface-3')}>
                {b}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Topik Permasalahan</label>
        <Select value={topikId} onValueChange={setTopikId}>
          <SelectTrigger className="h-9 text-sm rounded-lg bg-surface-2 border-surface"><SelectValue placeholder="Pilih topik (opsional)..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-xs italic text-slate-400">— Tidak dipilih —</SelectItem>
            {topikFiltered.map(t => <SelectItem key={t.id} value={t.id} className="text-sm">{t.nama}</SelectItem>)}
            {topikFiltered.length === 0 && <div className="px-3 py-2 text-xs text-slate-400 italic">Belum ada topik untuk bidang ini</div>}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Deskripsi</label>
        <textarea value={deskripsi} onChange={e => setDeskripsi(e.target.value)} rows={3}
          className="w-full rounded-lg border border-surface bg-surface-2 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 resize-none"
          placeholder="Tuliskan deskripsi masalah secara bebas..." />
      </div>

      {!editData && (
        <div className="rounded-xl border border-surface-2 bg-slate-50 dark:bg-slate-800/50 dark:bg-slate-900/20 p-3">
          <SesiLokalPanel sesiList={sesiLokal} onChange={setSesiLokal} />
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Tindak Lanjut</label>
        <Input value={tindakLanjut} onChange={e => setTindakLanjut(e.target.value)}
          placeholder="Contoh: Konseling lanjutan, Panggil wali murid, Monitoring 2 minggu..."
          className="h-9 text-sm rounded-lg bg-surface-2 border-surface" />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">
          Catatan Tindak Lanjut <span className="text-slate-400 font-normal">(opsional)</span>
        </label>
        <textarea value={catatanTL} onChange={e => setCatatanTL(e.target.value)} rows={2}
          className="w-full rounded-lg border border-surface bg-surface-2 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 resize-none"
          placeholder="Catatan tambahan terkait tindak lanjut..." />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" type="button" onClick={onClose} className="flex-1 h-9 text-sm rounded-lg">Batal</Button>
        <Button onClick={handleSave} disabled={isSaving} className="flex-1 h-9 text-sm rounded-lg bg-rose-600 hover:bg-rose-700 text-white">
          {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : editData ? 'Simpan Perubahan' : 'Simpan Rekaman'}
        </Button>
      </div>
    </div>
  )
}

// ── Rekaman Item (untuk tab Riwayat) ───────────────────────────────────
function RekamanItem({ rekaman, canEdit, topikAll, guruBkId, taId, onChanged, onDeleted, defaultOpen = false }: {
  rekaman: Rekaman; canEdit: boolean; topikAll: Topik[]; guruBkId: string; taId: string
  onChanged: () => void; onDeleted: () => void; defaultOpen?: boolean
}) {
  const [sesiList, setSesiList] = useState<SesiPenanganan[]>(rekaman.penanganan)
  const [isEditing, setIsEditing] = useState(false)
  const [expanded, setExpanded] = useState(defaultOpen)

  return (
    <div className="rounded-xl border border-surface bg-surface overflow-hidden shadow-sm">
      <button type="button" onClick={() => { if (!isEditing) setExpanded(e => !e) }}
        className="w-full px-4 py-3 hover:bg-surface-2 transition-colors text-left">
        <div className="flex items-center gap-2">
          <Badge label={rekaman.bidang} colorClass={BIDANG_COLORS[rekaman.bidang]} />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 dark:text-slate-200 truncate flex-1 min-w-0">
            {rekaman.topik_nama || <span className="text-slate-400 italic font-normal">Tanpa topik</span>}
          </span>
          {sesiList.length > 0 && (
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full shrink-0">{sesiList.length} sesi</span>
          )}
          <span className="shrink-0 text-slate-400">{expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-[10px] text-slate-400">{new Date(rekaman.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {rekaman.tindak_lanjut && (
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-surface-3 border border-surface-2 px-2 py-0.5 rounded-full">{rekaman.tindak_lanjut}</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-surface-2 px-4 py-4 space-y-4 bg-slate-50 dark:bg-slate-800/50 dark:bg-slate-900/20">
          {isEditing ? (
            <FormRekaman
              siswa={{ id: '', nisn: '', nama_lengkap: '', foto_url: null, tingkat: 0, nomor_kelas: '', kelas_kelompok: '' }}
              taId={taId} guruBkId={guruBkId} topikAll={topikAll} editData={rekaman}
              onSaved={() => { setIsEditing(false); onChanged() }}
              onClose={() => setIsEditing(false)}
            />
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Clock className="h-3 w-3 shrink-0" />
                Dicatat oleh {rekaman.guru_nama?.split(',')[0]} · {new Date(rekaman.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>

              {rekaman.deskripsi ? (
                <div className="rounded-lg bg-surface border border-surface-2 px-4 py-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Deskripsi</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{rekaman.deskripsi}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Tidak ada deskripsi.</p>
              )}

              <div className="rounded-xl border border-surface bg-surface px-3 py-3">
                <SesiPenangananPanel rekamanId={rekaman.id} sesiList={sesiList} canEdit={canEdit}
                  onChanged={newList => { setSesiList(newList); onChanged() }} />
              </div>

              {(rekaman.tindak_lanjut || rekaman.catatan_tindak_lanjut) && (
                <div className="rounded-lg bg-amber-50/60 border border-amber-100 px-4 py-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Tindak Lanjut</p>
                  {rekaman.tindak_lanjut && <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 dark:text-slate-200">{rekaman.tindak_lanjut}</p>}
                  {rekaman.catatan_tindak_lanjut && <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-300 italic leading-relaxed">{rekaman.catatan_tindak_lanjut}</p>}
                </div>
              )}

              {canEdit && (
                <div className="flex gap-3 pt-1 border-t border-surface-2">
                  <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-semibold">
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button onClick={async () => {
                    if (!confirm('Hapus rekaman ini?')) return
                    const res = await hapusRekamanBK(rekaman.id)
                    if (res.error) { alert(res.error); return }
                    onDeleted()
                  }} className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 font-semibold ml-auto">
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

// ── Modal Cari Siswa (untuk input baru) ───────────────────────────────
function ModalCariSiswa({ isOpen, taId, currentUserId, onSelect, onClose }: {
  isOpen: boolean; taId: string; currentUserId: string
  onSelect: (s: SiswaResult) => void; onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SiswaResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) { setQuery(''); setResults([]); setTimeout(() => inputRef.current?.focus(), 100) }
  }, [isOpen])

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = setTimeout(async () => {
      setIsSearching(true)
      const res = await searchSiswaBinaan(currentUserId, query, taId)
      setResults(res as SiswaResult[])
      setIsSearching(false)
    }, 350)
    return () => { if (timeout.current) clearTimeout(timeout.current) }
  }, [query, currentUserId, taId])

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b border-surface-2">
          <DialogTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200 dark:text-slate-100">
            <UserSearch className="h-4 w-4 text-rose-600" />
            Cari Siswa untuk Bimbingan
          </DialogTitle>
          <p className="text-[11px] text-slate-400 mt-0.5">Cari dari siswa kelas binaan Anda</p>
        </DialogHeader>

        <div className="p-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />}
            <Input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Ketik nama atau NISN siswa..."
              className="pl-10 h-10 rounded-xl border-surface bg-surface-2 text-sm" />
          </div>

          {results.length > 0 ? (
            <div className="rounded-xl border border-surface overflow-hidden">
              <div className="divide-y divide-surface-2 max-h-72 overflow-y-auto">
                {results.map(s => (
                  <button key={s.id} type="button" onClick={() => { onSelect(s); onClose() }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left group">
                    <AvatarSiswa siswa={s} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 truncate">{s.nama_lengkap}</p>
                      <p className="text-[11px] text-slate-400">{s.nisn} · Kelas {formatNamaKelas(s.tingkat, s.nomor_kelas, s.kelas_kelompok)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-rose-400 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : query.length >= 2 && !isSearching ? (
            <div className="text-center py-8 text-slate-400">
              <UserSearch className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Siswa tidak ditemukan di kelas binaan</p>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Ketik minimal 2 karakter untuk mencari</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Modal Detail Siswa (2 tab) ─────────────────────────────────────────
function ModalDetailSiswa({ siswa, taId, guruBkId, userRole, topikAll, onClose, onDataChanged }: {
  siswa: SiswaResult; taId: string; guruBkId: string; userRole: string
  topikAll: Topik[]; onClose: () => void; onDataChanged: () => void
}) {
  const [rekamanList, setRekamanList] = useState<Rekaman[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'input' | 'riwayat'>('input')
  const [bidangFilter, setBidangFilter] = useState<BidangBK | 'Semua'>('Semua')
  const canEdit = userRole === 'guru_bk' || userRole === 'super_admin'

  useEffect(() => {
    getRekamanSiswa(siswa.id, taId).then(data => {
      const list = data as Rekaman[]
      setRekamanList(list)
      setIsLoading(false)
      if (list.length > 0) setActiveTab('riwayat')
    })
  }, [siswa.id, taId])

  const refreshRekaman = async () => {
    const data = await getRekamanSiswa(siswa.id, taId)
    setRekamanList(data as Rekaman[])
    onDataChanged()
  }

  const rekamanFiltered = bidangFilter === 'Semua' ? rekamanList : rekamanList.filter(r => r.bidang === bidangFilter)

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl h-[92dvh] max-h-[92dvh] min-h-0 rounded-2xl flex flex-col p-0 gap-0 overflow-hidden">

        {/* Header profil */}
        <div className="px-5 pt-5 pb-4 border-b border-surface-2 shrink-0 bg-gradient-to-r from-rose-50/60 to-white dark:from-rose-950/20 dark:to-transparent">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <AvatarSiswa siswa={siswa} size="md" />
              <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-900" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100 truncate leading-tight">{siswa.nama_lengkap}</DialogTitle>
              <p className="text-[11px] text-slate-400 mt-0.5">NISN {siswa.nisn} · Kelas {formatNamaKelas(siswa.tingkat, siswa.nomor_kelas, siswa.kelas_kelompok)}</p>
            </div>
            {!isLoading && rekamanList.length > 0 && (
              <div className="shrink-0 text-center bg-rose-50 border border-rose-100 rounded-xl px-3 py-1.5">
                <div className="text-lg font-black text-rose-600">{rekamanList.length}</div>
                <div className="text-[10px] text-rose-400 font-medium">rekaman</div>
              </div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex shrink-0 border-b border-surface-2 bg-surface">
          <button onClick={() => setActiveTab('input')}
            className={cn('flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold border-b-2 transition-all',
              activeTab === 'input'
                ? 'border-rose-600 text-rose-600 bg-rose-50/50 dark:bg-rose-900/10'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-surface-2')}>
            <ClipboardList className="h-3.5 w-3.5" />
            Input Rekaman Baru
          </button>
          <button onClick={() => setActiveTab('riwayat')}
            className={cn('flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold border-b-2 transition-all',
              activeTab === 'riwayat'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-surface-2')}>
            <History className="h-3.5 w-3.5" />
            Riwayat BK
            {!isLoading && rekamanList.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-indigo-200">{rekamanList.length}</span>
            )}
          </button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 min-h-0">
          {activeTab === 'input' && (
            <div className="px-5 py-5 min-h-0">
              {canEdit ? (
                <>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="h-8 w-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                      <ClipboardList className="h-4 w-4 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100">Rekaman Bimbingan Baru</p>
                      <p className="text-[11px] text-slate-400">Isi detail bimbingan untuk {siswa.nama_lengkap.split(' ')[0]}</p>
                    </div>
                  </div>
                  <FormRekaman siswa={siswa} taId={taId} guruBkId={guruBkId} topikAll={topikAll}
                    onSaved={() => {}}
                    onClose={async () => { await refreshRekaman(); setActiveTab('riwayat') }} />
                </>
              ) : (
                <div className="text-center py-10 text-slate-400">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Anda tidak memiliki akses untuk menambah rekaman.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'riwayat' && (
            <div className="px-5 py-4 space-y-3 min-h-0">
              {isLoading && (
                <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Memuat riwayat...</span>
                </div>
              )}

              {!isLoading && rekamanList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                  <FileText className="h-10 w-10 text-slate-200 dark:text-slate-700" />
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada rekaman BK</p>
                  <button onClick={() => setActiveTab('input')} className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Buat rekaman pertama
                  </button>
                </div>
              )}

              {!isLoading && rekamanList.length > 0 && (
                <div className="flex gap-1.5 flex-wrap pb-1">
                  <button onClick={() => setBidangFilter('Semua')}
                    className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                      bidangFilter === 'Semua' ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-surface-2 text-slate-500 dark:text-slate-400 border-surface hover:bg-surface-3')}>
                    Semua ({rekamanList.length})
                  </button>
                  {BIDANG_LIST.map(b => {
                    const count = rekamanList.filter(r => r.bidang === b).length
                    if (!count) return null
                    return (
                      <button key={b} onClick={() => setBidangFilter(b)}
                        className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                          bidangFilter === b ? BIDANG_COLORS[b] : 'bg-surface-2 text-slate-500 dark:text-slate-400 border-surface hover:bg-surface-3')}>
                        {b} ({count})
                      </button>
                    )
                  })}
                </div>
              )}

              {!isLoading && rekamanFiltered.map((r, idx) => (
                <RekamanItem key={r.id} rekaman={r} canEdit={canEdit} topikAll={topikAll}
                  guruBkId={guruBkId} taId={taId} defaultOpen={idx === 0}
                  onChanged={() => onDataChanged()}
                  onDeleted={() => { setRekamanList(prev => prev.filter(x => x.id !== r.id)); onDataChanged() }}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-surface-2 shrink-0 flex items-center justify-between bg-surface">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <HeartHandshake className="h-3.5 w-3.5" /> Bimbingan Konseling
          </div>
          {activeTab === 'riwayat' && canEdit && (
            <Button size="sm" onClick={() => setActiveTab('input')}
              className="h-7 text-xs gap-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg">
              <Plus className="h-3 w-3" /> Tambah Rekaman
            </Button>
          )}
          {activeTab === 'input' && rekamanList.length > 0 && (
            <button onClick={() => setActiveTab('riwayat')} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
              <History className="h-3.5 w-3.5" /> Lihat Riwayat
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Tab Bimbingan Konseling ────────────────────────────────────────────
function TabBimbinganKonseling({ currentUserId, userRole, taAktif, topikAll, isAdmin, kelasBinaan }: {
  currentUserId: string; userRole: string
  taAktif: { id: string; nama: string; semester: number } | null
  topikAll: Topik[]; isAdmin: boolean; kelasBinaan: KelasInfo[]
}) {
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [filterBidang, setFilterBidang] = useState<BidangBK | ''>('')
  const [filterKelas, setFilterKelas] = useState('')
  const [searchTercatat, setSearchTercatat] = useState('')
  const [page, setPage] = useState(1)
  const [showCariSiswa, setShowCariSiswa] = useState(false)
  const [selectedSiswa, setSelectedSiswa] = useState<SiswaResult | null>(null)

  const PAGE_SIZE = 10
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const canEdit = userRole === 'guru_bk' || userRole === 'super_admin'

  const loadData = useCallback(async (p: number = 1) => {
    if (!taAktif) return
    setIsLoading(true)
    const res = await getListSiswaBerrekaman(currentUserId, taAktif.id, isAdmin,
      { bidang: filterBidang, tindak_lanjut: '', kelas_id: filterKelas }, p, PAGE_SIZE)
    setRows(res.rows); setTotal(res.total); setPage(p); setIsLoading(false)
  }, [currentUserId, taAktif, isAdmin, filterBidang, filterKelas])

  useEffect(() => { loadData(1) }, [filterBidang, filterKelas, taAktif])

  const rowsFiltered = searchTercatat.trim().length >= 2
    ? rows.filter(r => r.nama_lengkap?.toLowerCase().includes(searchTercatat.toLowerCase()) || r.nisn?.includes(searchTercatat))
    : rows

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
      {/* Toolbar */}
      <div className="bg-surface border border-surface rounded-xl p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button onClick={() => setShowCariSiswa(true)}
              className="h-9 text-sm gap-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shrink-0 shadow-sm">
              <Plus className="h-4 w-4" /> Input Bimbingan Baru
            </Button>
          )}
          <Select value={filterBidang || 'all'} onValueChange={v => setFilterBidang(v === 'all' ? '' : v as any)}>
            <SelectTrigger className="h-9 w-36 text-xs rounded-xl border-surface"><SelectValue placeholder="Semua bidang" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Semua bidang</SelectItem>
              {BIDANG_LIST.map(b => <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>)}
            </SelectContent>
          </Select>
          {isAdmin && kelasBinaan.length > 0 && (
            <Select value={filterKelas || 'all'} onValueChange={v => setFilterKelas(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-9 w-36 text-xs rounded-xl border-surface"><SelectValue placeholder="Semua kelas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Semua kelas</SelectItem>
                {kelasBinaan.map(k => <SelectItem key={k.id} value={k.id} className="text-xs">{formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok)}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {(filterBidang || filterKelas) && (
            <button onClick={() => { setFilterBidang(''); setFilterKelas('') }}
              className="h-9 px-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-surface-2 rounded-xl border border-surface transition-colors">
              Reset
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input value={searchTercatat} onChange={e => setSearchTercatat(e.target.value)}
            placeholder="Cari siswa yang sudah tercatat..."
            className="pl-9 h-9 rounded-xl border-surface bg-surface-2 text-xs" />
          {searchTercatat && (
            <button onClick={() => setSearchTercatat('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-400">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-surface border border-surface rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-2">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">{isLoading ? 'Memuat...' : `${total} siswa tercatat`}</p>
          <button onClick={() => loadData(page)} className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-400 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Memuat data...</span>
          </div>
        ) : rowsFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-slate-400">
            <HeartHandshake className="h-10 w-10 text-slate-200 dark:text-slate-700" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{searchTercatat ? 'Siswa tidak ditemukan' : 'Belum ada rekaman BK'}</p>
            {canEdit && !searchTercatat && (
              <button onClick={() => setShowCariSiswa(true)} className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1">
                <Plus className="h-3 w-3" /> Mulai input bimbingan pertama
              </button>
            )}
          </div>
        ) : (
          <>
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
                  {rowsFiltered.map((row: any) => (
                    <tr key={row.siswa_id}
                      onClick={() => setSelectedSiswa({ id: row.siswa_id || row.id, nama_lengkap: row.nama_lengkap, nisn: row.nisn, foto_url: row.foto_url, tingkat: row.tingkat, nomor_kelas: row.nomor_kelas, kelas_kelompok: row.kelas_kelompok })}
                      className="hover:bg-surface-2 cursor-pointer transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <AvatarSiswa siswa={{ nama_lengkap: row.nama_lengkap, foto_url: row.foto_url }} size="sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 truncate text-xs">{row.nama_lengkap}</p>
                            <p className="text-[10px] text-slate-400">{row.nisn}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 dark:text-slate-300 whitespace-nowrap">{formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelas_kelompok)}</td>
                      <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{(row.bidang_list || '').split(',').filter(Boolean).map((b: string) => <Badge key={b} label={b.trim()} colorClass={BIDANG_COLORS[b.trim() as BidangBK] ?? 'bg-surface-3 text-slate-500 dark:text-slate-400 border-surface'} />)}</div></td>
                      <td className="px-3 py-2.5 text-center"><span className="font-bold text-slate-700 dark:text-slate-300 dark:text-slate-200">{row.jumlah_rekaman}</span></td>
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{new Date(row.rekaman_terakhir).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-3 py-2.5">
                        {row.belum_count > 0
                          ? <Badge label={`${row.belum_count} pending`} colorClass="bg-amber-50 text-amber-700 border-amber-200" />
                          : <Badge label="Selesai" colorClass="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-surface-2">
              {rowsFiltered.map((row: any) => (
                <div key={row.siswa_id}
                  onClick={() => setSelectedSiswa({ id: row.siswa_id || row.id, nama_lengkap: row.nama_lengkap, nisn: row.nisn, foto_url: row.foto_url, tingkat: row.tingkat, nomor_kelas: row.nomor_kelas, kelas_kelompok: row.kelas_kelompok })}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 cursor-pointer transition-colors">
                  <AvatarSiswa siswa={{ nama_lengkap: row.nama_lengkap, foto_url: row.foto_url }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 truncate">{row.nama_lengkap}</p>
                    <p className="text-[11px] text-slate-400">{formatNamaKelas(row.tingkat, row.nomor_kelas, row.kelas_kelompok)} · {row.jumlah_rekaman} rekaman</p>
                    <div className="flex gap-1 mt-1 flex-wrap">{(row.bidang_list || '').split(',').filter(Boolean).map((b: string) => <Badge key={b} label={b.trim()} colorClass={BIDANG_COLORS[b.trim() as BidangBK] ?? 'bg-surface-3 text-slate-500 dark:text-slate-400 border-surface'} />)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {row.belum_count > 0 ? <Badge label={`${row.belum_count} pending`} colorClass="bg-amber-50 text-amber-700 border-amber-200" /> : <Badge label="Selesai" colorClass="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" />}
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-surface-2">
                <span className="text-[11px] text-slate-400">Hal. {page} dari {totalPages} ({total} siswa)</span>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => loadData(page - 1)} className="h-7 px-3 text-xs rounded-lg">← Prev</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => loadData(page + 1)} className="h-7 px-3 text-xs rounded-lg">Next →</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ModalCariSiswa isOpen={showCariSiswa} taId={taAktif.id} currentUserId={currentUserId}
        onSelect={s => setSelectedSiswa(s)} onClose={() => setShowCariSiswa(false)} />

      {selectedSiswa && (
        <ModalDetailSiswa siswa={selectedSiswa} taId={taAktif.id} guruBkId={currentUserId}
          userRole={userRole} topikAll={topikAll}
          onClose={() => setSelectedSiswa(null)} onDataChanged={() => loadData(page)} />
      )}
    </div>
  )
}

// ── Tab Topik ──────────────────────────────────────────────────────────
function TabTopik({ currentUserId, topikAll: initialTopik }: { currentUserId: string; topikAll: Topik[] }) {
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
    setTopikAll(prev => [...prev, { id: Date.now().toString(), bidang: activeBidang, nama: newNama.trim() }])
    setNewNama(''); setIsSaving(false)
  }

  const handleEdit = async (id: string) => {
    if (!editNama.trim()) return
    setIsSaving(true)
    const res = await editTopikBK(id, editNama)
    if (res.error) { alert(res.error); setIsSaving(false); return }
    setTopikAll(prev => prev.map(t => t.id === id ? { ...t, nama: editNama.trim() } : t))
    setEditingId(null); setIsSaving(false)
  }

  const handleHapus = async (id: string, nama: string) => {
    if (!confirm(`Hapus topik "${nama}"?`)) return
    const res = await hapusTopikBK(id)
    if (res.error) { alert(res.error); return }
    setTopikAll(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {BIDANG_LIST.map(b => (
          <button key={b} onClick={() => setActiveBidang(b)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
              activeBidang === b ? BIDANG_COLORS[b] : 'bg-surface-2 text-slate-500 dark:text-slate-400 border-surface hover:bg-surface-3')}>
            {b} ({topikAll.filter(t => t.bidang === b).length})
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={newNama} onChange={e => setNewNama(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleTambah() }}
          placeholder={`Topik baru untuk bidang ${activeBidang}...`} className="flex-1 h-9 text-sm rounded-lg border-surface bg-surface" />
        <Button size="sm" onClick={handleTambah} disabled={isSaving || !newNama.trim()}
          className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" /> Tambah
        </Button>
      </div>
      <div className="rounded-xl border border-surface bg-surface overflow-hidden">
        {topikFiltered.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">Belum ada topik untuk bidang {activeBidang}.</div>
        ) : (
          <div className="divide-y divide-surface-2">
            {topikFiltered.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 group hover:bg-surface-2 transition-colors">
                {editingId === t.id ? (
                  <>
                    <Input value={editNama} onChange={e => setEditNama(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleEdit(t.id) }} autoFocus className="flex-1 h-7 text-sm rounded border-surface" />
                    <button onClick={() => handleEdit(t.id)} disabled={isSaving} className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"><CheckCircle2 className="h-4 w-4" /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 rounded text-slate-400 hover:bg-surface-3"><X className="h-4 w-4" /></button>
                  </>
                ) : (
                  <>
                    <Tag className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 dark:text-slate-200">{t.nama}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingId(t.id); setEditNama(t.nama) }} className="p-1.5 rounded text-blue-500 hover:bg-blue-50"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleHapus(t.id, t.nama)} className="p-1.5 rounded text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
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

// ── Tab Kelas Binaan ───────────────────────────────────────────────────
function TabKelasBinaan({ kelasBinaan, isAdmin, currentUserId, taAktif }: {
  kelasBinaan: KelasInfo[]; isAdmin: boolean; currentUserId: string
  taAktif: { id: string; nama: string; semester: number } | null
}) {
  const [viewMode, setViewMode] = useState<'kelas' | 'guru'>('guru')
  const [perGuruData, setPerGuruData] = useState<{ guru_id: string; guru_nama: string; kelas_list: any[] }[]>([])
  const [isLoadingGuru, setIsLoadingGuru] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [expandedGuru, setExpandedGuru] = useState<Set<string>>(new Set())

  const loadPerGuru = async () => {
    if (!taAktif) return
    setIsLoadingGuru(true)
    const data = await getKelasBinaanPerGuru(taAktif.id)
    setPerGuruData(data)
    setExpandedGuru(new Set(data.map(g => g.guru_id)))
    setIsLoadingGuru(false)
  }

  const handleSinkron = async () => {
    if (!confirm('Sinkronisasi akan mengganti semua data kelas binaan dengan data dari penugasan mengajar semester aktif. Lanjutkan?')) return
    setIsSyncing(true)
    const res = await sinkronKelasBinaanDariPenugasan()
    if (res.error) alert(res.error)
    else { alert(res.success); if (viewMode === 'guru') loadPerGuru() }
    setIsSyncing(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && (
          <>
            <div className="flex rounded-lg border border-surface overflow-hidden shrink-0">
              <button onClick={() => setViewMode('kelas')} className={cn('px-3 py-1.5 text-xs font-medium transition-colors', viewMode === 'kelas' ? 'bg-slate-900 text-white' : 'bg-surface text-slate-500 dark:text-slate-400 hover:bg-surface-2')}>Per Kelas</button>
              <button onClick={() => { setViewMode('guru'); if (perGuruData.length === 0) loadPerGuru() }} className={cn('px-3 py-1.5 text-xs font-medium transition-colors', viewMode === 'guru' ? 'bg-slate-900 text-white' : 'bg-surface text-slate-500 dark:text-slate-400 hover:bg-surface-2')}>Per Guru BK</button>
            </div>
            <Button size="sm" variant="outline" onClick={handleSinkron} disabled={isSyncing}
              className="h-8 text-xs gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-lg ml-auto">
              {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />} Sinkron dari Penugasan
            </Button>
          </>
        )}
      </div>
      {isAdmin && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <span>Klik <strong>Sinkron dari Penugasan</strong> untuk otomatis mengisi kelas binaan berdasarkan data mengajar guru BK di semester aktif.</span>
            {taAktif && <span className="block mt-1 font-semibold text-blue-600">TA aktif: {taAktif.nama} · Smt {taAktif.semester === 1 ? 'Ganjil' : 'Genap'}</span>}
          </div>
        </div>
      )}

      {(!isAdmin || viewMode === 'kelas') && (
        kelasBinaan.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
            <Users className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada kelas binaan</p>
            {isAdmin ? <p className="text-xs">Klik "Sinkron dari Penugasan" untuk mengisi otomatis</p> : <p className="text-xs">Hubungi Super Admin untuk mengatur kelas binaan Anda</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-surface bg-surface overflow-hidden">
            <div className="divide-y divide-surface-2">
              {kelasBinaan.map(k => (
                <div key={k.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">{k.tingkat}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100">Kelas {formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok)}</p>
                    {k.guru_bk_nama && <p className="text-[11px] text-slate-400">{k.guru_bk_nama}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {isAdmin && viewMode === 'guru' && (
        isLoadingGuru ? (
          <div className="flex items-center justify-center py-10 gap-2 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Memuat data...</span></div>
        ) : perGuruData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400"><Users className="h-6 w-6 text-slate-300" /><p className="text-sm">Belum ada data kelas binaan</p></div>
        ) : (
          <div className="space-y-2">
            {perGuruData.map(g => (
              <div key={g.guru_id} className="rounded-xl border border-surface bg-surface overflow-hidden">
                <button onClick={() => setExpandedGuru(prev => { const n = new Set(prev); n.has(g.guru_id) ? n.delete(g.guru_id) : n.add(g.guru_id); return n })}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left">
                  <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-xs font-bold shrink-0">{g.guru_nama.charAt(0)}</div>
                  <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 truncate">{g.guru_nama.split(',')[0]}</span>
                  <span className="text-[11px] text-slate-400 shrink-0">{g.kelas_list.length} kelas</span>
                  {expandedGuru.has(g.guru_id) ? <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                </button>
                {expandedGuru.has(g.guru_id) && (
                  <div className="border-t border-surface-2 px-4 py-2 flex flex-wrap gap-1.5">
                    {g.kelas_list.map(k => (
                      <span key={k.id} className="text-xs font-semibold px-2 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-700">
                        {formatNamaKelas(k.tingkat, k.nomor_kelas, k.kelompok)}
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
export function BKClient({ currentUserId, userRole, taAktif, topikAll, kelasBinaan, isAdmin }: {
  currentUserId: string; userRole: string
  taAktif: { id: string; nama: string; semester: number } | null
  topikAll: Topik[]; kelasBinaan: KelasInfo[]; isAdmin: boolean
}) {
  return (
    <div className="space-y-3">
      {taAktif && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-surface text-xs text-slate-500 dark:text-slate-400">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>TA {taAktif.nama} · Semester {taAktif.semester === 1 ? 'Ganjil' : 'Genap'}</span>
        </div>
      )}
      <Tabs defaultValue="bk" className="space-y-3">
        <TabsList className="bg-surface border border-surface p-0.5 grid grid-cols-3 h-auto rounded-lg">
          <TabsTrigger value="bk" className="py-2 rounded-md data-[state=active]:bg-rose-600 data-[state=active]:text-white text-xs font-medium flex items-center gap-1.5">
            <HeartHandshake className="h-3.5 w-3.5" /> Konseling
          </TabsTrigger>
          <TabsTrigger value="topik" className="py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs font-medium flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Topik BK
          </TabsTrigger>
          <TabsTrigger value="kelas" className="py-2 rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs font-medium flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Kelas Binaan
          </TabsTrigger>
        </TabsList>
        <TabsContent value="bk" className="m-0">
          <TabBimbinganKonseling currentUserId={currentUserId} userRole={userRole} taAktif={taAktif} topikAll={topikAll} isAdmin={isAdmin} kelasBinaan={kelasBinaan} />
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
