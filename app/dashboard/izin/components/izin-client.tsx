// Lokasi: app/dashboard/izin/components/izin-client.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Loader2, DoorOpen, UserX, AlertCircle, CheckCircle2, Trash2, LogIn, Clock, CalendarDays, Pencil, Save } from 'lucide-react'
import { tambahIzinKeluar, tandaiSudahKembali, tambahIzinKelas, editIzinKeluar, editIzinKelas, hapusIzinKeluar, hapusIzinKeluarBatch, hapusIzinKelas, hapusIzinKelasBatch, searchSiswaIzin, type AlasanIzinRow } from '../actions'
import { KelolaAlasanModal } from './kelola-alasan-modal'
import { cn, formatNamaKelas } from '@/lib/utils'
import { AvatarSiswa } from '@/components/ui/avatar-siswa'
import { formatTimeWIB } from '@/lib/time'

const initialFormState = { error: null as string | null, success: null as string | null }

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return ''
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/)
  return match ? `${match[1]}T${match[2]}:${match[3]}` : ''
}

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm mt-3">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
    </Button>
  )
}

export function IzinClient({
  izinKeluarList,
  izinKelasList,
  currentUserRole,
  canDeleteIzin,
  canEditIzin,
  initialAlasanList,
  initialTanggal,
  todayTanggal
}: {
  izinKeluarList: any[],
  izinKelasList: any[],
  currentUserRole: string,
  canDeleteIzin: boolean,
  canEditIzin: boolean,
  initialAlasanList: AlasanIzinRow[],
  initialTanggal: string,
  todayTanggal: string
}) {
  const isSuperAdmin = currentUserRole === 'super_admin'
  const [alasanList, setAlasanList] = useState<AlasanIzinRow[]>(initialAlasanList)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filterTanggal, setFilterTanggal] = useState(initialTanggal)

  // Tab 1: Keluar
  const [searchKeluar, setSearchKeluar] = useState('')
  const [filterStatus, setFilterStatus] = useState('SEMUA')
  const [isModalKeluarOpen, setIsModalKeluarOpen] = useState(false)
  const [stateKeluar, actionKeluar] = useActionState(tambahIzinKeluar, initialFormState)
  const [selectedKeluarIds, setSelectedKeluarIds] = useState<string[]>([])
  const [isBatchDeletingKeluar, setIsBatchDeletingKeluar] = useState(false)
  const [editKeluarItem, setEditKeluarItem] = useState<any | null>(null)
  const [editKeluarForm, setEditKeluarForm] = useState({ waktu_keluar: '', waktu_kembali: '', status: 'BELUM KEMBALI', keterangan: '' })
  const [isSavingEditKeluar, setIsSavingEditKeluar] = useState(false)

  // Tab 2: Kelas
  const [searchKelas, setSearchKelas] = useState('')
  const [filterAlasan, setFilterAlasan] = useState('SEMUA')
  const [isModalKelasOpen, setIsModalKelasOpen] = useState(false)
  const [stateKelas, actionKelas] = useActionState(tambahIzinKelas, initialFormState)
  const [selectedJam, setSelectedJam] = useState<number[]>([])
  const [selectedKelasIds, setSelectedKelasIds] = useState<string[]>([])
  const [isBatchDeletingKelas, setIsBatchDeletingKelas] = useState(false)
  const [editKelasItem, setEditKelasItem] = useState<any | null>(null)
  const [editKelasForm, setEditKelasForm] = useState<{ jam_pelajaran: number[]; alasan: string; keterangan: string }>({ jam_pelajaran: [], alasan: '', keterangan: '' })
  const [isSavingEditKelas, setIsSavingEditKelas] = useState(false)

  // Autocomplete siswa — lazy via Server Action (bukan pre-load semua siswa)
  const [searchSiswa, setSearchSiswa] = useState('')
  const [selectedSiswaId, setSelectedSiswaId] = useState('')
  const [showSiswaDropdown, setShowSiswaDropdown] = useState(false)
  const [siswaResults, setSiswaResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSiswaSearch = useCallback((val: string) => {
    setSearchSiswa(val)
    setSelectedSiswaId('')
    setShowSiswaDropdown(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length < 2) { setSiswaResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchSiswaIzin(val)
        setSiswaResults(results)
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [])

  const toggleJam = (jam: number) => setSelectedJam(prev => prev.includes(jam) ? prev.filter(j => j !== jam) : [...prev, jam].sort((a, b) => a - b))
  const toggleSemuaJam = () => setSelectedJam(selectedJam.length === 10 ? [] : [1,2,3,4,5,6,7,8,9,10])
  const applyTanggalFilter = useCallback((tanggal: string) => {
    const params = new URLSearchParams(searchParams?.toString() || '')
    if (tanggal === todayTanggal) {
      params.delete('tanggal')
    } else {
      params.set('tanggal', tanggal)
    }
    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname)
  }, [pathname, router, searchParams, todayTanggal])

  useEffect(() => { setFilterTanggal(initialTanggal) }, [initialTanggal])
  useEffect(() => { if (stateKeluar?.success) { const t = setTimeout(() => setIsModalKeluarOpen(false), 1500); return () => clearTimeout(t) } }, [stateKeluar?.success])
  useEffect(() => { if (stateKelas?.success) { const t = setTimeout(() => setIsModalKelasOpen(false), 1500); return () => clearTimeout(t) } }, [stateKelas?.success])

  const handleKembali = async (id: string) => { const res = await tandaiSudahKembali(id); if (res.error) alert(res.error) }
  const handleDeleteKeluar = async (id: string) => { if (!confirm('Hapus riwayat ini?')) return; const res = await hapusIzinKeluar(id); if (res.error) alert(res.error) }
  const handleDeleteKelas = async (id: string) => { if (!confirm('Hapus riwayat ini?')) return; const res = await hapusIzinKelas(id); if (res.error) alert(res.error) }

  const openEditKeluar = (item: any) => {
    setEditKeluarItem(item)
    setEditKeluarForm({
      waktu_keluar: toDateTimeLocal(item.waktu_keluar),
      waktu_kembali: toDateTimeLocal(item.waktu_kembali),
      status: item.status === 'SUDAH KEMBALI' ? 'SUDAH KEMBALI' : 'BELUM KEMBALI',
      keterangan: item.keterangan || '',
    })
  }

  const saveEditKeluar = async () => {
    if (!editKeluarItem) return
    setIsSavingEditKeluar(true)
    try {
      const res = await editIzinKeluar(editKeluarItem.id, editKeluarForm)
      if (res.error) alert(res.error)
      else {
        setEditKeluarItem(null)
        router.refresh()
      }
    } finally {
      setIsSavingEditKeluar(false)
    }
  }

  const openEditKelas = (item: any) => {
    setEditKelasItem(item)
    setEditKelasForm({
      jam_pelajaran: Array.isArray(item.jam_pelajaran) ? item.jam_pelajaran : [],
      alasan: item.alasan || '',
      keterangan: item.keterangan || '',
    })
  }

  const toggleEditKelasJam = (jam: number) => {
    setEditKelasForm(prev => ({
      ...prev,
      jam_pelajaran: prev.jam_pelajaran.includes(jam)
        ? prev.jam_pelajaran.filter(item => item !== jam)
        : [...prev.jam_pelajaran, jam].sort((a, b) => a - b),
    }))
  }

  const saveEditKelas = async () => {
    if (!editKelasItem) return
    setIsSavingEditKelas(true)
    try {
      const res = await editIzinKelas(editKelasItem.id, editKelasForm)
      if (res.error) alert(res.error)
      else {
        setEditKelasItem(null)
        router.refresh()
      }
    } finally {
      setIsSavingEditKelas(false)
    }
  }

  const toggleSelection = (ids: string[], id: string, checked: boolean) =>
    checked ? Array.from(new Set([...ids, id])) : ids.filter(item => item !== id)

  const handleBatchDeleteKeluar = async () => {
    if (selectedKeluarIds.length === 0) return
    if (!confirm(`Hapus ${selectedKeluarIds.length} riwayat izin keluar terpilih?`)) return
    setIsBatchDeletingKeluar(true)
    try {
      const res = await hapusIzinKeluarBatch(selectedKeluarIds)
      if (res.error) alert(res.error)
      else {
        setSelectedKeluarIds([])
        router.refresh()
      }
    } finally {
      setIsBatchDeletingKeluar(false)
    }
  }

  const handleBatchDeleteKelas = async () => {
    if (selectedKelasIds.length === 0) return
    if (!confirm(`Hapus ${selectedKelasIds.length} riwayat izin kelas terpilih?`)) return
    setIsBatchDeletingKelas(true)
    try {
      const res = await hapusIzinKelasBatch(selectedKelasIds)
      if (res.error) alert(res.error)
      else {
        setSelectedKelasIds([])
        router.refresh()
      }
    } finally {
      setIsBatchDeletingKelas(false)
    }
  }

  const displayKeluar = izinKeluarList.filter(k =>
    k.siswa?.nama_lengkap?.toLowerCase().includes(searchKeluar.toLowerCase()) &&
    (filterStatus === 'SEMUA' || k.status === filterStatus)
  )
  const displayKelas = izinKelasList.filter(k =>
    k.siswa?.nama_lengkap?.toLowerCase().includes(searchKelas.toLowerCase()) &&
    (filterAlasan === 'SEMUA' || k.alasan === filterAlasan)
  )

  useEffect(() => {
    const validIds = new Set(izinKeluarList.map(k => k.id))
    setSelectedKeluarIds(prev => prev.filter(id => validIds.has(id)))
  }, [izinKeluarList])

  useEffect(() => {
    const validIds = new Set(izinKelasList.map(k => k.id))
    setSelectedKelasIds(prev => prev.filter(id => validIds.has(id)))
  }, [izinKelasList])

  const displayKeluarIds = displayKeluar.map(k => k.id)
  const displayKelasIds = displayKelas.map(k => k.id)
  const isAllDisplayKeluarSelected = displayKeluarIds.length > 0 && displayKeluarIds.every(id => selectedKeluarIds.includes(id))
  const isAllDisplayKelasSelected = displayKelasIds.length > 0 && displayKelasIds.every(id => selectedKelasIds.includes(id))

  const toggleAllDisplayKeluar = (checked: boolean) => {
    setSelectedKeluarIds(prev => checked
      ? Array.from(new Set([...prev, ...displayKeluarIds]))
      : prev.filter(id => !displayKeluarIds.includes(id))
    )
  }

  const toggleAllDisplayKelas = (checked: boolean) => {
    setSelectedKelasIds(prev => checked
      ? Array.from(new Set([...prev, ...displayKelasIds]))
      : prev.filter(id => !displayKelasIds.includes(id))
    )
  }

  const formatTime = (iso: string) => formatTimeWIB(iso, { suffix: false })

  const renderSiswaAutocomplete = () => (
    <div className="space-y-1.5 relative">
      <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300">Cari Siswa <span className="text-rose-500">*</span></Label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
        <Input
          placeholder="Ketik min. 2 huruf nama siswa..."
          value={searchSiswa}
          onChange={e => handleSiswaSearch(e.target.value)}
          onFocus={() => setShowSiswaDropdown(true)}
          onBlur={() => setTimeout(() => setShowSiswaDropdown(false), 200)}
          className={cn("pl-8 h-9 text-sm rounded-lg", selectedSiswaId ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/50' : '')}
        />
        {isSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-slate-400 dark:text-slate-500" />}
      </div>
      {showSiswaDropdown && searchSiswa.length > 1 && (
        <div className="absolute z-50 w-full mt-0.5 bg-surface border border-surface rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {siswaResults.length === 0 && !isSearching && (
            <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">Tidak ditemukan</div>
          )}
          {siswaResults.map(s => (
            <div
              key={s.id}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setSelectedSiswaId(s.id); setSearchSiswa(s.nama_lengkap); setShowSiswaDropdown(false) }}
              className="px-3 py-2 hover:bg-surface-2 cursor-pointer border-b border-surface-2 flex items-center gap-2.5 last:border-0"
            >
              <AvatarSiswa fotoUrl={s.foto_url} nama={s.nama_lengkap} />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200 dark:text-slate-100 flex-1 min-w-0 truncate">{s.nama_lengkap}</span>
              <span className="text-[10px] bg-surface-3 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 dark:text-slate-500 shrink-0">{s.kelas ? formatNamaKelas(s.kelas.tingkat, s.kelas.nomor_kelas, s.kelas.kelompok) : ''}</span>
            </div>
          ))}
        </div>
      )}
      {selectedSiswaId && (() => {
        const selected = siswaResults.find(s => s.id === selectedSiswaId)
        if (!selected) return null
        return (
          <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2">
            <AvatarSiswa fotoUrl={selected.foto_url} nama={selected.nama_lengkap} size="xl" className="shadow-sm border border-slate-200 dark:border-slate-700" />
            <div className="text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">{selected.nama_lengkap}</p>
              <p className="text-[11px] text-slate-500">{selected.kelas ? formatNamaKelas(selected.kelas.tingkat, selected.kelas.nomor_kelas, selected.kelas.kelompok) : ''} · {selected.nisn}</p>
            </div>
          </div>
        )
      })()}
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-surface rounded-lg p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1 min-w-[200px]">
            <Label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Filter Tanggal</Label>
            <div className="relative">
              <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <Input
                type="date"
                value={filterTanggal}
                onChange={e => setFilterTanggal(e.target.value)}
                className="h-8 pl-8 text-xs rounded-md"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => applyTanggalFilter(filterTanggal)}
            className="h-8 px-3 text-xs rounded-md bg-slate-700 hover:bg-slate-800 text-white"
          >
            Terapkan
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => { setFilterTanggal(todayTanggal); applyTanggalFilter(todayTanggal) }}
            className="h-8 px-3 text-xs rounded-md"
          >
            HARI INI
          </Button>
        </div>
      </div>

      {/* MODAL 1: KELUAR KOMPLEK */}
      <Dialog open={isModalKeluarOpen} onOpenChange={open => { setIsModalKeluarOpen(open); if (!open) { setSelectedSiswaId(''); setSearchSiswa('') } }}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-blue-600" /> Catat Izin Keluar Komplek
            </DialogTitle>
          </DialogHeader>
          <form action={actionKeluar} className="space-y-3 pt-1">
            {stateKeluar?.error && <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border border-rose-200 flex gap-1.5"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{stateKeluar.error}</div>}
            {stateKeluar?.success && <div className="p-2.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border border-emerald-200 dark:border-emerald-800 flex gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" />{stateKeluar.success}</div>}
            <input type="hidden" name="siswa_id" value={selectedSiswaId} />
            {renderSiswaAutocomplete()}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Keterangan / Tujuan (Opsional)</Label>
              <Input name="keterangan" placeholder="Contoh: Beli alat tulis..." className="h-9 text-sm rounded-lg" />
            </div>
            <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100 text-xs text-blue-700 flex gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Waktu keluar dicatat otomatis. Status: "BELUM KEMBALI".
            </div>
            <SubmitBtn label="Simpan & Izinkan Keluar" />
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: IZIN KELAS */}
      <Dialog open={isModalKelasOpen} onOpenChange={open => { setIsModalKelasOpen(open); if (!open) { setSelectedSiswaId(''); setSearchSiswa(''); setSelectedJam([]) } }}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <UserX className="h-4 w-4 text-indigo-600" /> Izin Tidak Masuk Kelas
            </DialogTitle>
          </DialogHeader>
          <form action={actionKelas} className="space-y-3 pt-1">
            {stateKelas?.error && <div className="p-2.5 text-xs text-rose-600 bg-rose-50 rounded-lg border flex gap-1.5"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{stateKelas.error}</div>}
            {stateKelas?.success && <div className="p-2.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg border flex gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" />{stateKelas.success}</div>}
            <input type="hidden" name="siswa_id" value={selectedSiswaId} />
            {selectedJam.map(jam => <input key={jam} type="hidden" name="jam_pelajaran" value={jam} />)}
            {renderSiswaAutocomplete()}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Jam Pelajaran <span className="text-rose-500">*</span></Label>
                <button type="button" onClick={toggleSemuaJam} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors">
                  {selectedJam.length === 10 ? 'Batal Semua' : 'Pilih Semua'}
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[1,2,3,4,5,6,7,8,9,10].map(jam => (
                  <button
                    key={jam} type="button" onClick={() => toggleJam(jam)}
                    className={cn("h-9 rounded-lg border text-sm font-bold transition-all", selectedJam.includes(jam) ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-surface-2 text-slate-500 dark:text-slate-400 dark:text-slate-500 border-surface hover:bg-surface-3')}
                  >{jam}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Alasan <span className="text-rose-500">*</span></Label>
              <Select name="alasan" required>
                <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue placeholder="Pilih alasan..." /></SelectTrigger>
                <SelectContent>
                  {alasanList.map(a => (
                    <SelectItem key={a.id} value={a.alasan}>{a.alasan}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Keterangan (Opsional)</Label>
              <Input name="keterangan" placeholder="Contoh: Lomba OSN..." className="h-9 text-sm rounded-lg" />
            </div>
            <SubmitBtn label="Simpan Izin Kelas" />
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: EDIT KELUAR KOMPLEK */}
      <Dialog open={!!editKeluarItem} onOpenChange={open => { if (!open) setEditKeluarItem(null) }}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Pencil className="h-4 w-4 text-blue-600" /> Edit Izin Keluar Komplek
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-bold text-slate-800 leading-tight">{editKeluarItem?.siswa?.nama_lengkap}</p>
              <p className="text-[11px] text-slate-500">{editKeluarItem?.siswa?.kelas ? formatNamaKelas(editKeluarItem.siswa.kelas.tingkat, editKeluarItem.siswa.kelas.nomor_kelas, editKeluarItem.siswa.kelas.kelompok) : ''}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Waktu Keluar <span className="text-rose-500">*</span></Label>
              <Input type="datetime-local" value={editKeluarForm.waktu_keluar} onChange={e => setEditKeluarForm(prev => ({ ...prev, waktu_keluar: e.target.value }))} className="h-9 text-sm rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Status</Label>
              <Select value={editKeluarForm.status} onValueChange={value => setEditKeluarForm(prev => ({ ...prev, status: value, waktu_kembali: value === 'BELUM KEMBALI' ? '' : prev.waktu_kembali }))}>
                <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BELUM KEMBALI">Belum Kembali</SelectItem>
                  <SelectItem value="SUDAH KEMBALI">Sudah Kembali</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editKeluarForm.status === 'SUDAH KEMBALI' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Waktu Kembali <span className="text-rose-500">*</span></Label>
                <Input type="datetime-local" value={editKeluarForm.waktu_kembali} onChange={e => setEditKeluarForm(prev => ({ ...prev, waktu_kembali: e.target.value }))} className="h-9 text-sm rounded-lg" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Keterangan</Label>
              <Input value={editKeluarForm.keterangan} onChange={e => setEditKeluarForm(prev => ({ ...prev, keterangan: e.target.value }))} placeholder="Keterangan / tujuan..." className="h-9 text-sm rounded-lg" />
            </div>
            <Button onClick={saveEditKeluar} disabled={isSavingEditKeluar} className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm">
              {isSavingEditKeluar ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1.5" /> Simpan Perubahan</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: EDIT IZIN KELAS */}
      <Dialog open={!!editKelasItem} onOpenChange={open => { if (!open) setEditKelasItem(null) }}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Pencil className="h-4 w-4 text-indigo-600" /> Edit Izin Tidak Masuk Kelas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-sm font-bold text-slate-800 leading-tight">{editKelasItem?.siswa?.nama_lengkap}</p>
              <p className="text-[11px] text-slate-500">{editKelasItem?.siswa?.kelas ? formatNamaKelas(editKelasItem.siswa.kelas.tingkat, editKelasItem.siswa.kelas.nomor_kelas, editKelasItem.siswa.kelas.kelompok) : ''}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Jam Pelajaran <span className="text-rose-500">*</span></Label>
              <div className="grid grid-cols-5 gap-1.5">
                {[1,2,3,4,5,6,7,8,9,10].map(jam => (
                  <button
                    key={jam}
                    type="button"
                    onClick={() => toggleEditKelasJam(jam)}
                    className={cn("h-9 rounded-lg border text-sm font-bold transition-all", editKelasForm.jam_pelajaran.includes(jam) ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-surface-2 text-slate-500 border-surface hover:bg-surface-3')}
                  >
                    {jam}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Alasan <span className="text-rose-500">*</span></Label>
              <Select value={editKelasForm.alasan} onValueChange={value => setEditKelasForm(prev => ({ ...prev, alasan: value }))}>
                <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue placeholder="Pilih alasan..." /></SelectTrigger>
                <SelectContent>
                  {alasanList.map(a => (
                    <SelectItem key={a.id} value={a.alasan}>{a.alasan}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Keterangan</Label>
              <Input value={editKelasForm.keterangan} onChange={e => setEditKelasForm(prev => ({ ...prev, keterangan: e.target.value }))} placeholder="Keterangan tambahan..." className="h-9 text-sm rounded-lg" />
            </div>
            <Button onClick={saveEditKelas} disabled={isSavingEditKelas} className="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm">
              {isSavingEditKelas ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1.5" /> Simpan Perubahan</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MAIN TABS */}
      <Tabs defaultValue="keluar" className="space-y-3">
        <TabsList className="bg-surface border border-surface p-0.5 h-auto grid grid-cols-2 rounded-lg">
          <TabsTrigger value="keluar" className="py-2 rounded-md data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs sm:text-sm font-medium">
            Keluar Komplek
          </TabsTrigger>
          <TabsTrigger value="kelas" className="py-2 rounded-md data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs sm:text-sm font-medium">
            Izin Tidak Masuk Kelas
          </TabsTrigger>
        </TabsList>

        {/* TAB KELUAR */}
        <TabsContent value="keluar" className="m-0 space-y-3">
          <div className="bg-surface border border-surface rounded-lg p-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-0" style={{ minWidth: '140px' }}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <Input placeholder="Cari nama siswa..." value={searchKeluar} onChange={e => setSearchKeluar(e.target.value)} className="pl-8 h-8 text-sm rounded-md" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-36 text-xs rounded-md shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SEMUA">Semua Status</SelectItem>
                <SelectItem value="BELUM KEMBALI">Belum Kembali</SelectItem>
                <SelectItem value="SUDAH KEMBALI">Sudah Kembali</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setIsModalKeluarOpen(true)} size="sm" className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md shrink-0">
              <DoorOpen className="h-3.5 w-3.5 mr-1" /> Catat Keluar
            </Button>
            {canDeleteIzin && (
              <div className="flex flex-wrap items-center gap-2 border-t border-surface-2 pt-2 w-full sm:w-auto sm:border-t-0 sm:pt-0">
                <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <Checkbox
                    checked={isAllDisplayKeluarSelected}
                    disabled={displayKeluarIds.length === 0}
                    onCheckedChange={checked => toggleAllDisplayKeluar(Boolean(checked))}
                    className="h-3.5 w-3.5"
                  />
                  Pilih tampil
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={selectedKeluarIds.length === 0 || isBatchDeletingKeluar}
                  onClick={handleBatchDeleteKeluar}
                  className="h-8 px-3 text-xs rounded-md border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  {isBatchDeletingKeluar ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                  Hapus {selectedKeluarIds.length > 0 ? selectedKeluarIds.length : ''}
                </Button>
              </div>
            )}
          </div>

          {/* MOBILE */}
          <div className="block lg:hidden space-y-2">
            {displayKeluar.length === 0 ? (
              <div className="bg-surface py-10 rounded-lg border border-surface text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">Tidak ada data izin keluar.</p>
              </div>
            ) : displayKeluar.map(k => (
              <div key={k.id} className={cn("bg-surface border rounded-lg p-3 relative", canDeleteIzin && "pl-9", k.status === 'BELUM KEMBALI' ? 'border-amber-200 bg-amber-50/30' : 'border-surface')}>
                {canDeleteIzin && (
                  <>
                    <Checkbox
                      checked={selectedKeluarIds.includes(k.id)}
                      onCheckedChange={checked => setSelectedKeluarIds(prev => toggleSelection(prev, k.id, Boolean(checked)))}
                      className="absolute left-3 top-3 h-3.5 w-3.5"
                    />
                    {canEditIzin && (
                      <button onClick={() => openEditKeluar(k)} className="absolute top-2 right-8 p-1 text-slate-300 dark:text-slate-600 hover:text-blue-500 transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleDeleteKeluar(k.id)} className="absolute top-2 right-2 p-1 text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {canEditIzin && !canDeleteIzin && (
                  <button onClick={() => openEditKeluar(k)} className="absolute top-2 right-2 p-1 text-slate-300 dark:text-slate-600 hover:text-blue-500 transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                <div className="flex items-start justify-between pr-6 mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <AvatarSiswa fotoUrl={k.siswa?.foto_url} nama={k.siswa?.nama_lengkap || ''} />
                    <div>                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 leading-tight">{k.siswa?.nama_lengkap}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-surface-3 px-1.5 py-0.5 rounded border border-surface">
                        {k.siswa?.kelas ? formatNamaKelas(k.siswa.kelas.tingkat, k.siswa.kelas.nomor_kelas, k.siswa.kelas.kelompok) : ''}
                      </span>
                      <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">{formatTime(k.waktu_keluar)}</span>
                    </div>
                    </div>
                  </div>
                  <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0", k.status === 'BELUM KEMBALI' ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-surface-3 text-slate-500 dark:text-slate-400 dark:text-slate-500')}>
                    {k.status === 'BELUM KEMBALI' ? 'Di Luar' : 'Kembali'}
                  </span>
                </div>
                {k.keterangan && <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 truncate mb-2">{k.keterangan}</p>}
                <div className="flex items-center justify-between pt-2 border-t border-surface-2">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Oleh: {k.pelapor?.nama_lengkap?.split(' ')[0]}</span>
                  {k.status === 'BELUM KEMBALI' ? (
                    <Button size="sm" onClick={() => handleKembali(k.id)} className="h-7 px-2.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 rounded">
                      <LogIn className="h-3 w-3 mr-1" />Tandai Kembali
                    </Button>
                  ) : (
                    <span className="text-[10px] text-emerald-600 flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3" />Tiba {formatTime(k.waktu_kembali)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden lg:block bg-surface rounded-lg border border-surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-2 hover:bg-surface-2">
                  {canDeleteIzin && (
                    <TableHead className="h-9 px-4 w-10">
                      <Checkbox
                        checked={isAllDisplayKeluarSelected}
                        disabled={displayKeluarIds.length === 0}
                        onCheckedChange={checked => toggleAllDisplayKeluar(Boolean(checked))}
                        className="h-3.5 w-3.5"
                      />
                    </TableHead>
                  )}
                  <TableHead className="h-9 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500">Siswa</TableHead>
                  <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 w-24">Keluar</TableHead>
                  <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500">Keterangan</TableHead>
                  <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 text-center w-28">Status</TableHead>
                  <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 text-right px-4 w-36">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayKeluar.length === 0 ? (
                  <TableRow><TableCell colSpan={canDeleteIzin ? 6 : 5} className="h-24 text-center text-sm text-slate-400 dark:text-slate-500">Tidak ada data izin keluar.</TableCell></TableRow>
                ) : displayKeluar.map(k => (
                  <TableRow key={k.id} className={cn("border-surface-2 group", k.status === 'BELUM KEMBALI' ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'hover:bg-surface-2/60')}>
                    {canDeleteIzin && (
                      <TableCell className="px-4 py-2.5">
                        <Checkbox
                          checked={selectedKeluarIds.includes(k.id)}
                          onCheckedChange={checked => setSelectedKeluarIds(prev => toggleSelection(prev, k.id, Boolean(checked)))}
                          className="h-3.5 w-3.5"
                        />
                      </TableCell>
                    )}
                    <TableCell className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <AvatarSiswa fotoUrl={k.siswa?.foto_url} nama={k.siswa?.nama_lengkap || ''} />
                        <div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 leading-tight">{k.siswa?.nama_lengkap}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Kelas {k.siswa?.kelas ? formatNamaKelas(k.siswa.kelas.tingkat, k.siswa.kelas.nomor_kelas, k.siswa.kelas.kelompok) : ''} · {k.pelapor?.nama_lengkap}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs font-mono text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">{formatTime(k.waktu_keluar)}</TableCell>
                    <TableCell className="py-2.5 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{k.keterangan || '-'}</TableCell>
                    <TableCell className="py-2.5 text-center">
                      <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded border", k.status === 'BELUM KEMBALI' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' : 'bg-surface-2 text-slate-500 dark:text-slate-400 dark:text-slate-500 border-surface')}>
                        {k.status === 'BELUM KEMBALI' ? 'Di Luar' : `Tiba ${formatTime(k.waktu_kembali)}`}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {k.status === 'BELUM KEMBALI' ? (
                          <Button size="sm" onClick={() => handleKembali(k.id)} className="h-7 px-2.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 rounded">
                            <LogIn className="h-3 w-3 mr-1" />Tandai Kembali
                          </Button>
                        ) : null}
                        {canEditIzin && (
                          <button onClick={() => openEditKeluar(k)} className="p-1.5 rounded text-blue-400 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDeleteIzin && (
                          <button onClick={() => handleDeleteKeluar(k.id)} className="p-1.5 rounded text-rose-400 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB KELAS */}
        <TabsContent value="kelas" className="m-0 space-y-3">
          <div className="bg-surface border border-surface rounded-lg p-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-0" style={{ minWidth: '140px' }}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <Input placeholder="Cari nama siswa..." value={searchKelas} onChange={e => setSearchKelas(e.target.value)} className="pl-8 h-8 text-sm rounded-md" />
            </div>
            <Select value={filterAlasan} onValueChange={setFilterAlasan}>
              <SelectTrigger className="h-8 w-36 text-xs rounded-md shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SEMUA">Semua Alasan</SelectItem>
                {alasanList.map(a => (
                  <SelectItem key={a.id} value={a.alasan}>{a.alasan}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setIsModalKelasOpen(true)} size="sm" className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shrink-0">
              <UserX className="h-3.5 w-3.5 mr-1" /> Catat Izin Kelas
            </Button>
            {isSuperAdmin && (
              <KelolaAlasanModal alasanList={alasanList} onAlasanChange={setAlasanList} />
            )}
            {canDeleteIzin && (
              <div className="flex flex-wrap items-center gap-2 border-t border-surface-2 pt-2 w-full sm:w-auto sm:border-t-0 sm:pt-0">
                <label className="flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <Checkbox
                    checked={isAllDisplayKelasSelected}
                    disabled={displayKelasIds.length === 0}
                    onCheckedChange={checked => toggleAllDisplayKelas(Boolean(checked))}
                    className="h-3.5 w-3.5"
                  />
                  Pilih tampil
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={selectedKelasIds.length === 0 || isBatchDeletingKelas}
                  onClick={handleBatchDeleteKelas}
                  className="h-8 px-3 text-xs rounded-md border-rose-200 text-rose-600 hover:bg-rose-50"
                >
                  {isBatchDeletingKelas ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                  Hapus {selectedKelasIds.length > 0 ? selectedKelasIds.length : ''}
                </Button>
              </div>
            )}
          </div>

          {/* MOBILE */}
          <div className="block lg:hidden space-y-2">
            {displayKelas.length === 0 ? (
              <div className="bg-surface py-10 rounded-lg border border-surface text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">Tidak ada data izin kelas.</p>
              </div>
            ) : displayKelas.map(k => (
              <div key={k.id} className={cn("bg-surface border border-surface rounded-lg p-3 relative", canDeleteIzin && "pl-9")}>
                {canDeleteIzin && (
                  <>
                    <Checkbox
                      checked={selectedKelasIds.includes(k.id)}
                      onCheckedChange={checked => setSelectedKelasIds(prev => toggleSelection(prev, k.id, Boolean(checked)))}
                      className="absolute left-3 top-3 h-3.5 w-3.5"
                    />
                    {canEditIzin && (
                      <button onClick={() => openEditKelas(k)} className="absolute top-2 right-8 p-1 text-slate-300 dark:text-slate-600 hover:text-indigo-500 transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => handleDeleteKelas(k.id)} className="absolute top-2 right-2 p-1 text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {canEditIzin && !canDeleteIzin && (
                  <button onClick={() => openEditKelas(k)} className="absolute top-2 right-2 p-1 text-slate-300 dark:text-slate-600 hover:text-indigo-500 transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                <div className="flex items-start justify-between pr-6 mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <AvatarSiswa fotoUrl={k.siswa?.foto_url} nama={k.siswa?.nama_lengkap || ''} />
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 leading-tight truncate">{k.siswa?.nama_lengkap}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-surface-3 px-1.5 py-0.5 rounded border border-surface shrink-0 ml-2">
                    {k.siswa?.kelas ? formatNamaKelas(k.siswa.kelas.tingkat, k.siswa.kelas.nomor_kelas, k.siswa.kelas.kelompok) : ''}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1 mb-1.5">
                  <span className="text-[9px] font-bold uppercase text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded tracking-wide">
                    {k.alasan}
                  </span>
                  {k.jam_pelajaran.map((jam: number) => (
                    <span key={jam} className="text-[9px] h-4 w-4 rounded bg-surface-3 text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600 font-bold flex items-center justify-center border border-surface">{jam}</span>
                  ))}
                </div>
                {k.keterangan && <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500 truncate">{k.keterangan}</p>}
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 pt-1.5 border-t border-surface-2">Oleh: {k.pelapor?.nama_lengkap}</p>
              </div>
            ))}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden lg:block bg-surface rounded-lg border border-surface overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow className="bg-surface-2 hover:bg-surface-2">
                    {canDeleteIzin && (
                      <TableHead className="h-9 px-4 w-10">
                        <Checkbox
                          checked={isAllDisplayKelasSelected}
                          disabled={displayKelasIds.length === 0}
                          onCheckedChange={checked => toggleAllDisplayKelas(Boolean(checked))}
                          className="h-3.5 w-3.5"
                        />
                      </TableHead>
                    )}
                    <TableHead className="h-9 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500">Siswa</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 text-center w-44">Jam Ke-</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 w-44">Alasan</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500">Keterangan</TableHead>
                    <TableHead className="h-9 text-xs font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 text-right px-4 w-16">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayKelas.length === 0 ? (
                    <TableRow><TableCell colSpan={canDeleteIzin ? 6 : 5} className="h-24 text-center text-sm text-slate-400 dark:text-slate-500">Tidak ada data izin kelas.</TableCell></TableRow>
                  ) : displayKelas.map(k => (
                    <TableRow key={k.id} className="hover:bg-surface-2/60 border-surface-2 group">
                      {canDeleteIzin && (
                        <TableCell className="px-4 py-2.5">
                          <Checkbox
                            checked={selectedKelasIds.includes(k.id)}
                            onCheckedChange={checked => setSelectedKelasIds(prev => toggleSelection(prev, k.id, Boolean(checked)))}
                            className="h-3.5 w-3.5"
                          />
                        </TableCell>
                      )}
                      <TableCell className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <AvatarSiswa fotoUrl={k.siswa?.foto_url} nama={k.siswa?.nama_lengkap || ''} />
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 leading-tight">{k.siswa?.nama_lengkap}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Kelas {k.siswa?.kelas ? formatNamaKelas(k.siswa.kelas.tingkat, k.siswa.kelas.nomor_kelas, k.siswa.kelas.kelompok) : ''}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {k.jam_pelajaran.map((jam: number) => (
                            <span key={jam} className="h-6 w-6 rounded bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center border border-indigo-200">{jam}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <span className="text-[10px] font-bold uppercase text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded tracking-wide">{k.alasan}</span>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600 truncate max-w-[200px]">{k.keterangan || '-'}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Oleh: {k.pelapor?.nama_lengkap}</p>
                      </TableCell>
                      <TableCell className="py-2.5 px-4 text-right">
                        {canEditIzin && (
                          <button onClick={() => openEditKelas(k)} className="p-1.5 rounded text-indigo-400 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDeleteIzin && (
                          <button onClick={() => handleDeleteKelas(k.id)} className="p-1.5 rounded text-rose-400 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
