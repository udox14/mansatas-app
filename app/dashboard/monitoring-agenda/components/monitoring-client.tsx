// Lokasi: app/dashboard/monitoring-agenda/components/monitoring-client.tsx
'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import {
  Search, Loader2, Eye, Edit3, CheckCircle2, Clock, XCircle,
  AlertTriangle, Calendar, BarChart3, Printer,
  ChevronLeft, ChevronRight, ShieldCheck,
} from 'lucide-react'
import {
  getMonitoringHarian, getMonitoringHarianSlots, getRekapKehadiranGuru,
  editAgendaStatus, batchEditAgendaStatus, getDataCetakLaporan,
  getMonitoringPiketHarian, editAgendaPiketStatus,
} from '../actions'
import { todayWIB, nowWIB, formatTimeWIB } from '@/lib/time'

// ============================================================
// TYPES
// ============================================================
type FilterOption = { id: string; nama?: string; label?: string }
interface MonitoringClientProps {
  filterOptions: { guru: FilterOption[]; kelas: FilterOption[] }
  userRole: string
}

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: any; label: string; dot: string }> = {
  TEPAT_WAKTU: { bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, label: 'Tepat Waktu', dot: 'bg-emerald-500' },
  HADIR:       { bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, label: 'Hadir', dot: 'bg-emerald-500' },
  BELUM_MENGISI: { bg: 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-300', icon: Clock, label: 'Belum Mengisi', dot: 'bg-slate-400' },
  TELAT:       { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: Clock, label: 'Telat', dot: 'bg-amber-500' },
  ALFA:        { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: XCircle, label: 'Alfa', dot: 'bg-red-500' },
  SAKIT:       { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: AlertTriangle, label: 'Sakit', dot: 'bg-blue-500' },
  IZIN:        { bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700', icon: AlertTriangle, label: 'Izin', dot: 'bg-sky-500' },
}

const STATUS_OPTIONS = ['TEPAT_WAKTU', 'TELAT', 'ALFA', 'SAKIT', 'IZIN']
const HARI_NAMA = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
type SlotOption = { id: number; nama: string; mulai: string; selesai: string }
const ALASAN_STYLE: Record<'SAKIT' | 'IZIN', { label: string; text: string }> = {
  SAKIT: { label: 'Sakit', text: 'text-blue-600' },
  IZIN: { label: 'Izin', text: 'text-sky-600' },
}

function formatTanggal(tgl: string) {
  return new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function todayStr() { return todayWIB() }

const BULAN_OPTIONS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

type PrintScope = 'semua_guru' | 'per_guru' | 'per_kelas'
type PrintPeriod = 'rentang' | 'bulan' | 'hari' | 'semester' | 'tahun'

function monthEnd(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

function agendaPeriodRange(
  mode: PrintPeriod,
  values: { tanggal: string; bulan: string; tahun: string; tahunAjaran: string; semester: 'ganjil' | 'genap'; mulai: string; selesai: string }
) {
  if (mode === 'hari') return { start: values.tanggal, end: values.tanggal }
  if (mode === 'bulan') {
    const [year, month] = values.bulan.split('-').map(Number)
    return { start: `${year}-${String(month).padStart(2, '0')}-01`, end: monthEnd(year, month) }
  }
  if (mode === 'semester') {
    const startYear = Number(values.tahunAjaran)
    return values.semester === 'ganjil'
      ? { start: `${startYear}-07-01`, end: `${startYear}-12-31` }
      : { start: `${startYear + 1}-01-01`, end: `${startYear + 1}-06-30` }
  }
  if (mode === 'tahun') return { start: `${values.tahun}-01-01`, end: `${values.tahun}-12-31` }
  return { start: values.mulai, end: values.selesai }
}

function agendaPeriodLabel(mode: PrintPeriod, range: { start: string; end: string }, bulan: string, tahunAjaran: string, semester: 'ganjil' | 'genap') {
  if (mode === 'hari') return formatTanggal(range.start)
  if (mode === 'bulan') {
    const [year, month] = bulan.split('-').map(Number)
    return `${BULAN_OPTIONS[month - 1]} ${year}`
  }
  if (mode === 'semester') return `Semester ${semester === 'ganjil' ? 'Ganjil' : 'Genap'} Tahun Ajaran ${tahunAjaran}/${Number(tahunAjaran) + 1}`
  if (mode === 'tahun') return `Tahun ${range.start.slice(0, 4)}`
  return `${formatTanggal(range.start)} s/d ${formatTanggal(range.end)}`
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] || STATUS_STYLE.ALFA
  const StatusIcon = style.icon

  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${style.bg} ${style.text}`}>
      <StatusIcon className="h-3 w-3" />{style.label}
    </span>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export function MonitoringClient({ filterOptions, userRole }: MonitoringClientProps) {
  return (
    <Tabs defaultValue="harian" className="space-y-3">
      <TabsList className="grid w-full grid-cols-4 max-w-2xl h-auto p-1">
        <TabsTrigger value="harian" className="text-xs sm:text-sm"><Calendar className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Harian</TabsTrigger>
        <TabsTrigger value="rekap" className="text-xs sm:text-sm"><BarChart3 className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Rekap</TabsTrigger>
        <TabsTrigger value="cetak" className="text-xs sm:text-sm"><Printer className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Cetak</TabsTrigger>
        <TabsTrigger value="mon-piket" className="text-xs sm:text-sm"><ShieldCheck className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />Mon. Piket</TabsTrigger>
      </TabsList>

      <TabsContent value="harian"><TabHarian filterOptions={filterOptions} /></TabsContent>
      <TabsContent value="rekap"><TabRekap filterOptions={filterOptions} /></TabsContent>
      <TabsContent value="cetak"><TabCetak filterOptions={filterOptions} /></TabsContent>
      <TabsContent value="mon-piket"><TabMonitoringPiket /></TabsContent>
    </Tabs>
  )
}

// ============================================================
// TAB: MONITORING HARIAN
// ============================================================
function TabHarian({ filterOptions }: { filterOptions: MonitoringClientProps['filterOptions'] }) {
  const [tanggal, setTanggal] = useState(todayStr())
  const [filterMode, setFilterMode] = useState<'semua' | 'guru' | 'kelas'>('semua')
  const [filterId, setFilterId] = useState('')
  const [jamFilter, setJamFilter] = useState('all_jam')
  const [slots, setSlots] = useState<SlotOption[]>([])
  const [data, setData] = useState<any[]>([])
  const [hariNama, setHariNama] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)

  // Detail modal
  const [detailItem, setDetailItem] = useState<any>(null)
  // Edit modal
  const [editItem, setEditItem] = useState<any>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editCatatan, setEditCatatan] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [batchStatus, setBatchStatus] = useState('ALFA')
  const [batchCatatan, setBatchCatatan] = useState('')
  const [isBatchEditing, setIsBatchEditing] = useState(false)

  useEffect(() => {
    let active = true

    getMonitoringHarianSlots(tanggal).then((result) => {
      if (!active) return

      const nextSlots = ((result as any).slots || []) as SlotOption[]
      setSlots(nextSlots)
      setHariNama(result.hariNama || '')
      setJamFilter(current => {
        if (current === 'all_jam') return current
        return nextSlots.some(slot => String(slot.id) === current) ? current : 'all_jam'
      })
    })

    setData([])
    setPesan(null)

    return () => { active = false }
  }, [tanggal])

  const handleSearch = async () => {
    setIsLoading(true); setPesan(null)
    try {
      const selectedJam = jamFilter !== 'all_jam' ? Number(jamFilter) : undefined
      const result = await getMonitoringHarian(
        tanggal,
        filterMode,
        filterMode !== 'semua' ? filterId : undefined,
        typeof selectedJam === 'number' && Number.isFinite(selectedJam) ? selectedJam : undefined,
      )
      if (result.error) setPesan({ tipe: 'error', teks: result.error })
      else {
        setData(result.data || [])
        setSelectedKeys(new Set())
        setHariNama(result.hariNama || '')
        setSlots(((result as any).slots || []) as SlotOption[])
        if ((result as any).calendarStatus && !(result as any).calendarStatus.isEffective) {
          setPesan({ tipe: 'sukses', teks: `Tanggal ini tidak efektif pembelajaran: ${(result as any).calendarStatus.reason || 'tidak ada kewajiban agenda.'}` })
        }
      }
    } catch (error) {
      console.error('Gagal memuat monitoring harian:', error)
      setPesan({ tipe: 'error', teks: 'Gagal memuat monitoring harian. Silakan coba lagi.' })
      setData([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!editItem) return
    setIsEditing(true)
    try {
      const result = await editAgendaStatus(
        editItem.agenda_id || null,
        editItem.penugasan_id,
        tanggal,
        editItem.guru_id,
        editItem.jam_ke_mulai,
        editItem.jam_ke_selesai,
        editStatus,
        editCatatan,
      )
      if (result.error) setPesan({ tipe: 'error', teks: result.error })
      else {
        setPesan({ tipe: 'sukses', teks: result.success || 'Berhasil' })
        setEditItem(null)
        await handleSearch()
      }
    } catch (error) {
      console.error('Gagal mengubah status agenda:', error)
      setPesan({ tipe: 'error', teks: 'Gagal mengubah status agenda. Silakan coba lagi.' })
    } finally {
      setIsEditing(false)
    }
  }

  const navigateDate = (offset: number) => {
    const d = new Date(tanggal + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    const newTgl = d.toISOString().split('T')[0]
    setTanggal(newTgl)
  }

  // Summary counts
  const filteredData = data

  const itemKey = (item: any) => `${item.penugasan_id}:${item.guru_id}`
  const selectedItems = filteredData.filter(item => selectedKeys.has(itemKey(item)))
  const allVisibleSelected = filteredData.length > 0 && filteredData.every(item => selectedKeys.has(itemKey(item)))

  const toggleSelected = (item: any) => {
    const key = itemKey(item)
    setSelectedKeys(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else if (next.size < 100) next.add(key)
      return next
    })
  }

  const toggleAllVisible = () => {
    setSelectedKeys(current => {
      const next = new Set(current)
      if (allVisibleSelected) {
        for (const item of filteredData) next.delete(itemKey(item))
      } else {
        for (const item of filteredData) {
          if (next.size >= 100) break
          next.add(itemKey(item))
        }
      }
      return next
    })
  }

  const handleBatchEdit = async () => {
    if (selectedItems.length === 0) return
    const statusLabel = STATUS_STYLE[batchStatus]?.label || batchStatus
    if (!confirm(`Ubah ${selectedItems.length} agenda terpilih menjadi ${statusLabel}?`)) return

    setIsBatchEditing(true)
    setPesan(null)
    try {
      const result = await batchEditAgendaStatus(
        tanggal,
        selectedItems.map(item => ({ penugasan_id: item.penugasan_id, guru_id: item.guru_id })),
        batchStatus,
        batchCatatan,
      )
      if (result.error) setPesan({ tipe: 'error', teks: result.error })
      else {
        const successText = result.success || 'Batch status berhasil diperbarui.'
        setSelectedKeys(new Set())
        setBatchCatatan('')
        await handleSearch()
        setPesan({ tipe: 'sukses', teks: successText })
      }
    } catch (error) {
      console.error('Gagal mengubah status agenda secara batch:', error)
      setPesan({ tipe: 'error', teks: 'Batch perubahan status gagal. Silakan coba lagi.' })
    } finally {
      setIsBatchEditing(false)
    }
  }

  const selectedSlot = slots.find(slot => String(slot.id) === jamFilter)

  const summary = filteredData.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="rounded-lg border bg-white dark:bg-slate-900 p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateDate(-1)} className="h-9 w-9 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="h-9 min-w-0 text-sm" />
          <Button variant="outline" size="sm" onClick={() => navigateDate(1)} className="h-9 w-9 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTanggal(todayStr())} className="h-9 px-2 text-xs sm:px-3">Hari Ini</Button>
        </div>

        <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <div className="min-w-0">
            <Label className="text-xs text-slate-500 dark:text-slate-400">Filter</Label>
            <Select value={filterMode} onValueChange={(v) => { setFilterMode(v as any); setFilterId('') }}>
              <SelectTrigger className="h-9 w-full text-sm sm:w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua</SelectItem>
                <SelectItem value="guru">Per Guru</SelectItem>
                <SelectItem value="kelas">Per Kelas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filterMode === 'guru' && (
            <div className="col-span-2 min-w-0 sm:flex-1 sm:min-w-[200px]">
              <Label className="text-xs text-slate-500 dark:text-slate-400">Guru</Label>
              <Combobox
                options={filterOptions.guru.map(g => ({ value: g.id, label: g.nama || g.label || '' }))}
                value={filterId}
                onValueChange={setFilterId}
                placeholder="Pilih guru..."
                searchPlaceholder="Cari nama guru..."
                emptyText="Guru tidak ditemukan"
              />
            </div>
          )}

          {filterMode === 'kelas' && (
            <div className="col-span-2 min-w-0 sm:flex-1 sm:min-w-[200px]">
              <Label className="text-xs text-slate-500 dark:text-slate-400">Kelas</Label>
              <Combobox
                options={filterOptions.kelas.map(k => ({ value: k.id, label: k.label || k.nama || '' }))}
                value={filterId}
                onValueChange={setFilterId}
                placeholder="Pilih kelas..."
                searchPlaceholder="Cari kelas..."
                emptyText="Kelas tidak ditemukan"
              />
            </div>
          )}

          {slots.length > 0 && (
            <div className="min-w-0 sm:min-w-[180px]">
              <Label className="text-xs text-slate-500 dark:text-slate-400">Jam Pelajaran</Label>
              <Select value={jamFilter} onValueChange={setJamFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_jam">Semua Jam</SelectItem>
                  {slots.map(slot => (
                    <SelectItem key={slot.id} value={String(slot.id)}>
                      {slot.nama || `Jam ${slot.id}`} ({slot.mulai}-{slot.selesai})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleSearch} disabled={isLoading} size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
            Cari
          </Button>
        </div>
      </div>

      {/* Pesan */}
      {pesan && (
        <div className={`rounded-lg border px-4 py-2.5 text-sm ${pesan.tipe === 'sukses' ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {pesan.teks}
        </div>
      )}

      {/* Summary badges */}
      {filteredData.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          <span className="shrink-0 text-xs bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full font-medium">
            {hariNama} &middot; {filteredData.length} blok{selectedSlot ? ` &middot; ${selectedSlot.nama || `Jam ${selectedSlot.id}`}` : ''}
          </span>
          {Object.entries(summary).map(([status, count]) => {
            const s = STATUS_STYLE[status]
            return s ? <span key={status} className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium border ${s.bg} ${s.text}`}>{s.label}: {count as number}</span> : null
          })}
        </div>
      )}

      {filteredData.length > 0 && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 dark:border-indigo-900 dark:bg-indigo-950/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex items-center gap-2 lg:min-w-[170px]">
              <Checkbox
                checked={allVisibleSelected ? true : selectedItems.length > 0 ? 'indeterminate' : false}
                onCheckedChange={toggleAllVisible}
                aria-label="Pilih semua agenda yang tampil"
              />
              <div>
                <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">Batch status agenda</p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400">{selectedItems.length} dipilih · maksimal 100 sesi</p>
              </div>
            </div>
            <div className="min-w-[170px]">
              <Label className="text-[10px] text-indigo-700 dark:text-indigo-300">Status baru</Label>
              <Select value={batchStatus} onValueChange={setBatchStatus}>
                <SelectTrigger className="mt-1 h-9 bg-white text-sm dark:bg-slate-900"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(status => <SelectItem key={status} value={status}>{STATUS_STYLE[status]?.label || status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-[10px] text-indigo-700 dark:text-indigo-300">Catatan admin (opsional)</Label>
              <Input
                value={batchCatatan}
                onChange={event => setBatchCatatan(event.target.value)}
                maxLength={1000}
                placeholder="Contoh: koreksi massal karena outage sistem"
                className="mt-1 h-9 bg-white text-sm dark:bg-slate-900"
              />
            </div>
            <Button
              onClick={handleBatchEdit}
              disabled={selectedItems.length === 0 || isBatchEditing}
              className="h-9 bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {isBatchEditing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit3 className="mr-2 h-4 w-4" />}
              Terapkan ke {selectedItems.length || 0} sesi
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {filteredData.length > 0 && (
        <div className="hidden rounded-lg border bg-white dark:bg-slate-900 overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected ? true : selectedItems.length > 0 ? 'indeterminate' : false}
                    onCheckedChange={toggleAllVisible}
                    aria-label="Pilih semua agenda"
                  />
                </TableHead>
                <TableHead className="text-xs w-8">#</TableHead>
                <TableHead className="text-xs">Guru</TableHead>
                <TableHead className="text-xs">Mapel</TableHead>
                <TableHead className="text-xs">Kelas</TableHead>
                <TableHead className="text-xs">Jam</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item, idx) => {
                return (
                  <TableRow key={`${item.penugasan_id}-${idx}`} data-state={selectedKeys.has(itemKey(item)) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedKeys.has(itemKey(item))}
                        onCheckedChange={() => toggleSelected(item)}
                        aria-label={`Pilih agenda ${item.guru_nama}`}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                    <TableCell className="text-xs font-medium text-slate-800 dark:text-slate-200">{item.guru_nama}</TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">{item.mapel_nama}</TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">{item.kelas_label}</TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">{item.jam_label}<br /><span className="text-[10px]">{item.slot_mulai}-{item.slot_selesai}</span></TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                      {item.alasan_ketidakhadiran && item.pelaksana_nama && (
                        <p className="text-[10px] text-violet-500 mt-0.5">Pelaksana: {item.pelaksana_nama}</p>
                      )}
                      {item.alasan_ketidakhadiran && (
                        <p className={`text-[10px] mt-0.5 ${ALASAN_STYLE[item.alasan_ketidakhadiran as 'SAKIT' | 'IZIN']?.text || 'text-slate-500'}`}>
                          Alasan: {ALASAN_STYLE[item.alasan_ketidakhadiran as 'SAKIT' | 'IZIN']?.label || item.alasan_ketidakhadiran}
                          {item.deskripsi_ketidakhadiran ? ` - ${item.deskripsi_ketidakhadiran}` : ''}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {item.agenda_id && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetailItem(item)} title="Detail">
                          <Eye className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                        setEditItem(item); setEditStatus(STATUS_OPTIONS.includes(item.status) ? item.status : 'ALFA'); setEditCatatan(item.catatan_admin || '')
                      }} title="Edit Status">
                        <Edit3 className="h-3.5 w-3.5 text-indigo-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {filteredData.length > 0 && (
        <div className="space-y-2 md:hidden">
          {filteredData.map((item, idx) => (
            <div key={`${item.penugasan_id}-mobile-${idx}`} className={`rounded-lg border p-3 shadow-sm ${selectedKeys.has(itemKey(item)) ? 'border-indigo-300 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/20' : 'bg-white dark:bg-slate-900'}`}>
              <div className="flex items-start justify-between gap-2">
                <Checkbox
                  checked={selectedKeys.has(itemKey(item))}
                  onCheckedChange={() => toggleSelected(item)}
                  aria-label={`Pilih agenda ${item.guru_nama}`}
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-400">#{idx + 1}</span>
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.guru_nama}</p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{item.mapel_nama}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>

              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                <div className="min-w-0 text-xs text-slate-600 dark:text-slate-300">
                  <p className="truncate font-medium">{item.kelas_label}</p>
                  <p className="text-[11px] text-slate-400">{item.jam_label} &middot; {item.slot_mulai}-{item.slot_selesai}</p>
                  {item.alasan_ketidakhadiran && item.pelaksana_nama && (
                    <p className="mt-0.5 truncate text-[11px] text-violet-500">Pelaksana: {item.pelaksana_nama}</p>
                  )}
                  {item.alasan_ketidakhadiran && (
                    <p className={`mt-0.5 text-[11px] ${ALASAN_STYLE[item.alasan_ketidakhadiran as 'SAKIT' | 'IZIN']?.text || 'text-slate-500'}`}>
                      Alasan: {ALASAN_STYLE[item.alasan_ketidakhadiran as 'SAKIT' | 'IZIN']?.label || item.alasan_ketidakhadiran}
                      {item.deskripsi_ketidakhadiran ? ` - ${item.deskripsi_ketidakhadiran}` : ''}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {item.agenda_id && (
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDetailItem(item)} title="Detail">
                      <Eye className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {
                    setEditItem(item); setEditStatus(STATUS_OPTIONS.includes(item.status) ? item.status : 'ALFA'); setEditCatatan(item.catatan_admin || '')
                  }} title="Edit Status">
                    <Edit3 className="h-3.5 w-3.5 text-indigo-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.length > 0 && filteredData.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-8 text-center">
          <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Tidak ada jadwal pada jam pelajaran yang dipilih.</p>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!detailItem} onOpenChange={() => setDetailItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Detail Agenda</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500 dark:text-slate-400 text-xs">Guru</span><p className="font-medium">{detailItem.guru_nama}</p></div>
                <div><span className="text-slate-500 dark:text-slate-400 text-xs">Mapel</span><p className="font-medium">{detailItem.mapel_nama}</p></div>
                <div><span className="text-slate-500 dark:text-slate-400 text-xs">Kelas</span><p className="font-medium">{detailItem.kelas_label}</p></div>
                <div><span className="text-slate-500 dark:text-slate-400 text-xs">Jam</span><p className="font-medium">{detailItem.jam_label}</p></div>
                <div><span className="text-slate-500 dark:text-slate-400 text-xs">Waktu Input</span><p className="font-medium">{detailItem.waktu_input ? formatTimeWIB(detailItem.waktu_input, { legacyShiftedWIB: true }) : '-'}</p></div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Status</span>
                  {(() => {
                    const s = STATUS_STYLE[detailItem.status] || STATUS_STYLE.ALFA
                    return <p className={`font-medium ${s.text}`}>{s.label}</p>
                  })()}
                </div>
              </div>
              {detailItem.materi && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Materi</span>
                  <p className="text-sm bg-slate-50 dark:bg-slate-800 rounded-md p-2 mt-0.5">{detailItem.materi}</p>
                </div>
              )}
              {detailItem.foto_url && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Foto</span>
                  <img src={detailItem.foto_url} alt="Foto agenda" className="mt-1 w-full max-h-72 object-cover rounded-lg border" />
                </div>
              )}
              {detailItem.catatan_admin && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Catatan Admin</span>
                  <p className="text-sm bg-amber-50 rounded-md p-2 mt-0.5 text-amber-800">{detailItem.catatan_admin}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Status Modal */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Ubah Status Agenda</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div className="text-sm">
                <p className="font-medium text-slate-800 dark:text-slate-200">{editItem.guru_nama}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{editItem.mapel_nama} — {editItem.kelas_label} — {editItem.jam_label}</p>
              </div>
              <div>
                <Label className="text-xs">Status Baru</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{STATUS_STYLE[s]?.label || s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Catatan Admin</Label>
                <textarea
                  value={editCatatan}
                  onChange={(e) => setEditCatatan(e.target.value)}
                  placeholder="Alasan perubahan status..."
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none resize-none"
                />
              </div>
              <Button onClick={handleEdit} disabled={isEditing} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                {isEditing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Edit3 className="h-4 w-4 mr-2" />}
                Simpan Perubahan
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// TAB: REKAP KEHADIRAN
// ============================================================
function TabRekap({ filterOptions }: { filterOptions: MonitoringClientProps['filterOptions'] }) {
  const [tglMulai, setTglMulai] = useState(() => {
    const d = nowWIB(); d.setUTCDate(1); return d.toISOString().split('T')[0]
  })
  const [tglSelesai, setTglSelesai] = useState(todayStr())
  const [sortBy, setSortBy] = useState<'nama' | 'patuh' | 'alfa'>('patuh')
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('semua')
  const [pesan, setPesan] = useState<{ tipe: 'error'; teks: string } | null>(null)

  const handleSearch = async () => {
    setIsLoading(true)
    setPesan(null)
    try {
      const result = await getRekapKehadiranGuru(tglMulai, tglSelesai, sortBy)
      if (result.error) setPesan({ tipe: 'error', teks: result.error })
      setData(result.data || [])
    } catch (error) {
      console.error('Gagal memuat rekap kehadiran guru:', error)
      setPesan({ tipe: 'error', teks: 'Gagal memuat rekap kehadiran guru. Silakan coba lagi.' })
      setData([])
    } finally {
      setIsLoading(false)
    }
  }

  const filteredData = statusFilter === 'semua' ? data : data.filter(d => {
    if (statusFilter === 'patuh') return d.kepatuhan >= 80
    if (statusFilter === 'kurang') return d.kepatuhan < 50
    if (statusFilter === 'sedang') return d.kepatuhan >= 50 && d.kepatuhan < 80
    return true
  })

  return (
    <div className="space-y-3">
      {/* Filter Bar */}
      <div className="rounded-lg border bg-white dark:bg-slate-900 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-slate-500 dark:text-slate-400">Dari Tanggal</Label>
            <Input type="date" value={tglMulai} onChange={(e) => setTglMulai(e.target.value)} className="h-9 text-sm w-[155px]" />
          </div>
          <div>
            <Label className="text-xs text-slate-500 dark:text-slate-400">Sampai Tanggal</Label>
            <Input type="date" value={tglSelesai} onChange={(e) => setTglSelesai(e.target.value)} className="h-9 text-sm w-[155px]" />
          </div>
          <div>
            <Label className="text-xs text-slate-500 dark:text-slate-400">Urutkan</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="patuh">Paling Patuh</SelectItem>
                <SelectItem value="alfa">Paling Banyak Alfa</SelectItem>
                <SelectItem value="nama">Nama (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSearch} disabled={isLoading} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
            Tampilkan
          </Button>
        </div>
      </div>

      {pesan && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {pesan.teks}
        </div>
      )}

      {/* Filter badges */}
      {data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {['semua', 'patuh', 'sedang', 'kurang'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${statusFilter === f ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-medium' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              {f === 'semua' ? `Semua (${data.length})` : f === 'patuh' ? `Patuh ≥80% (${data.filter(d => d.kepatuhan >= 80).length})` : f === 'sedang' ? `Sedang 50-79% (${data.filter(d => d.kepatuhan >= 50 && d.kepatuhan < 80).length})` : `Kurang <50% (${data.filter(d => d.kepatuhan < 50).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Rekap Table */}
      {filteredData.length > 0 && (
        <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-8">#</TableHead>
                <TableHead className="text-xs">Nama Guru</TableHead>
                <TableHead className="text-xs text-center">Total Blok</TableHead>
                <TableHead className="text-xs text-center">Tepat</TableHead>
                <TableHead className="text-xs text-center">Telat</TableHead>
                <TableHead className="text-xs text-center">Alfa</TableHead>
                <TableHead className="text-xs text-center">Sakit</TableHead>
                <TableHead className="text-xs text-center">Izin</TableHead>
                <TableHead className="text-xs text-center">Kepatuhan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item, idx) => {
                const kepColor = item.kepatuhan >= 80 ? 'text-emerald-600' : item.kepatuhan >= 50 ? 'text-amber-600' : 'text-red-600'
                const barWidth = `${Math.min(item.kepatuhan, 100)}%`
                const barColor = item.kepatuhan >= 80 ? 'bg-emerald-400' : item.kepatuhan >= 50 ? 'bg-amber-400' : 'bg-red-400'
                return (
                  <TableRow key={item.guru_id}>
                    <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                    <TableCell className="text-xs font-medium text-slate-800 dark:text-slate-200 min-w-[140px]">{item.guru_nama}</TableCell>
                    <TableCell className="text-xs text-center text-slate-600 dark:text-slate-400">{item.total_blok}</TableCell>
                    <TableCell className="text-xs text-center text-emerald-600 font-medium">{item.tepat_waktu}</TableCell>
                    <TableCell className="text-xs text-center text-amber-600 font-medium">{item.telat}</TableCell>
                    <TableCell className="text-xs text-center text-red-600 font-medium">{item.alfa}</TableCell>
                    <TableCell className="text-xs text-center text-blue-600 font-medium">{item.sakit}</TableCell>
                    <TableCell className="text-xs text-center text-sky-600 font-medium">{item.izin}</TableCell>
                    <TableCell className="text-center min-w-[100px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: barWidth }} />
                        </div>
                        <span className={`text-xs font-semibold ${kepColor} w-10 text-right`}>{item.kepatuhan}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {data.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-10 text-center">
          <BarChart3 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Pilih rentang tanggal dan klik &quot;Tampilkan&quot; untuk melihat rekap.</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// TAB: CETAK LAPORAN
// ============================================================
function TabCetak({ filterOptions }: { filterOptions: MonitoringClientProps['filterOptions'] }) {
  const current = nowWIB()
  const currentYear = current.getUTCFullYear()
  const currentMonth = String(current.getUTCMonth() + 1).padStart(2, '0')
  const [scope, setScope] = useState<PrintScope>('semua_guru')
  const [periodMode, setPeriodMode] = useState<PrintPeriod>('bulan')
  const [tanggal, setTanggal] = useState(todayStr())
  const [bulan, setBulan] = useState(`${currentYear}-${currentMonth}`)
  const [tahun, setTahun] = useState(String(currentYear))
  const [tahunAjaran, setTahunAjaran] = useState(String(current.getUTCMonth() + 1 >= 7 ? currentYear : currentYear - 1))
  const [semester, setSemester] = useState<'ganjil' | 'genap'>(current.getUTCMonth() + 1 >= 7 ? 'ganjil' : 'genap')
  const [tglMulai, setTglMulai] = useState(`${currentYear}-${currentMonth}-01`)
  const [tglSelesai, setTglSelesai] = useState(todayStr())
  const [guruId, setGuruId] = useState('')
  const [kelasId, setKelasId] = useState('')
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'error'; teks: string } | null>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent)
  const range = useMemo(() => agendaPeriodRange(periodMode, {
    tanggal, bulan, tahun, tahunAjaran, semester, mulai: tglMulai, selesai: tglSelesai,
  }), [bulan, periodMode, semester, tahun, tahunAjaran, tanggal, tglMulai, tglSelesai])
  const periodLabel = agendaPeriodLabel(periodMode, range, bulan, tahunAjaran, semester)
  const selectedGuru = filterOptions.guru.find(guru => guru.id === guruId)?.nama || ''
  const selectedKelas = filterOptions.kelas.find(kelas => kelas.id === kelasId)?.label || ''
  const guruNamaMap = new Map(filterOptions.guru.map(guru => [guru.id, guru.nama]))

  const resetData = () => {
    setData([])
    setPesan(null)
  }

  const handleLoad = async () => {
    if (scope === 'per_guru' && !guruId) {
      setPesan({ tipe: 'error', teks: 'Pilih guru yang akan dicetak.' })
      return
    }
    if (scope === 'per_kelas' && !kelasId) {
      setPesan({ tipe: 'error', teks: 'Pilih kelas yang akan dicetak.' })
      return
    }
    setIsLoading(true)
    setPesan(null)
    try {
      const result = await getDataCetakLaporan(
        range.start,
        range.end,
        scope === 'per_guru' ? guruId : undefined,
        scope === 'per_kelas' ? kelasId : undefined,
      )
      setData(result)
      if (result.length === 0) setPesan({ tipe: 'error', teks: 'Tidak ada data agenda pada cakupan dan periode tersebut.' })
    } catch (error) {
      console.error('Gagal memuat data cetak laporan:', error)
      setPesan({ tipe: 'error', teks: 'Gagal memuat data cetak laporan. Silakan coba lagi.' })
      setData([])
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = () => {
    const el = printRef.current
    if (!el) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup diblokir browser. Izinkan popup untuk mencetak.')
      return
    }
    printWindow.document.write(`<!DOCTYPE html><html><head><base href="${window.location.origin}/"><title>Laporan Agenda Guru</title>
<style>
@page { size: 215mm 330mm; margin: 8mm 8mm 10mm; }
html, body { margin: 0; padding: 0; background: #fff; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
.agenda-print-document { width: auto !important; min-height: 0 !important; padding: 0 !important; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
</style></head><body>${el.innerHTML}</body></html>`)
    printWindow.document.close()
    const images = Array.from(printWindow.document.images)
    const ready = images.length === 0
      ? Promise.resolve()
      : Promise.all(images.map(image => image.complete
        ? Promise.resolve()
        : new Promise<void>(resolve => { image.onload = () => resolve(); image.onerror = () => resolve() })))
    ready.then(() => {
      printWindow.focus()
      printWindow.print()
    })
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white dark:bg-slate-900 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end max-sm:[&_input]:w-full max-sm:[&_[role=combobox]]:w-full">
          <div>
            <Label className="text-xs text-slate-500 dark:text-slate-400">Cakupan Cetak</Label>
            <Select value={scope} onValueChange={(value) => { setScope(value as PrintScope); resetData() }}>
              <SelectTrigger className="mt-1 h-9 w-[175px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semua_guru">Semua Guru</SelectItem>
                <SelectItem value="per_guru">Per Guru</SelectItem>
                <SelectItem value="per_kelas">Per Kelas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-slate-500 dark:text-slate-400">Periode</Label>
            <Select value={periodMode} onValueChange={(value) => { setPeriodMode(value as PrintPeriod); resetData() }}>
              <SelectTrigger className="mt-1 h-9 w-[150px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hari">Per Hari</SelectItem>
                <SelectItem value="bulan">Per Bulan</SelectItem>
                <SelectItem value="semester">Per Semester</SelectItem>
                <SelectItem value="tahun">Per Tahun</SelectItem>
                <SelectItem value="rentang">Rentang Tanggal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === 'per_guru' && <div className="min-w-[230px] flex-1">
            <Label className="text-xs text-slate-500 dark:text-slate-400">Guru</Label>
            <Combobox
              options={filterOptions.guru.map(g => ({ value: g.id, label: g.nama || g.label || '' }))}
              value={guruId}
              onValueChange={(value) => { setGuruId(value); resetData() }}
              placeholder="Pilih guru"
              searchPlaceholder="Cari nama guru..."
              emptyText="Guru tidak ditemukan"
            />
          </div>}
          {scope === 'per_kelas' && <div className="min-w-[210px] flex-1">
            <Label className="text-xs text-slate-500 dark:text-slate-400">Kelas</Label>
            <Combobox
              options={filterOptions.kelas.map(k => ({ value: k.id, label: k.label || k.nama || '' }))}
              value={kelasId}
              onValueChange={(value) => { setKelasId(value); resetData() }}
              placeholder="Pilih kelas"
              searchPlaceholder="Cari kelas..."
              emptyText="Kelas tidak ditemukan"
            />
          </div>}
          {periodMode === 'hari' && <div><Label className="text-xs text-slate-500">Tanggal</Label><Input type="date" value={tanggal} onChange={e => { setTanggal(e.target.value); resetData() }} className="mt-1 h-9 w-[155px] text-sm" /></div>}
          {periodMode === 'bulan' && <div><Label className="text-xs text-slate-500">Bulan</Label><Input type="month" value={bulan} onChange={e => { setBulan(e.target.value); resetData() }} className="mt-1 h-9 w-[155px] text-sm" /></div>}
          {periodMode === 'tahun' && <div><Label className="text-xs text-slate-500">Tahun</Label><Input type="number" min="2020" max="2100" value={tahun} onChange={e => { setTahun(e.target.value); resetData() }} className="mt-1 h-9 w-[105px] text-sm" /></div>}
          {periodMode === 'semester' && <>
            <div><Label className="text-xs text-slate-500">Awal Tahun Ajaran</Label><Input type="number" min="2020" max="2100" value={tahunAjaran} onChange={e => { setTahunAjaran(e.target.value); resetData() }} className="mt-1 h-9 w-[120px] text-sm" /></div>
            <div><Label className="text-xs text-slate-500">Semester</Label><Select value={semester} onValueChange={value => { setSemester(value as 'ganjil' | 'genap'); resetData() }}><SelectTrigger className="mt-1 h-9 w-[120px] text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ganjil">Ganjil</SelectItem><SelectItem value="genap">Genap</SelectItem></SelectContent></Select></div>
          </>}
          {periodMode === 'rentang' && <>
            <div><Label className="text-xs text-slate-500">Dari Tanggal</Label><Input type="date" value={tglMulai} onChange={e => { setTglMulai(e.target.value); resetData() }} className="mt-1 h-9 w-[155px] text-sm" /></div>
            <div><Label className="text-xs text-slate-500">Sampai Tanggal</Label><Input type="date" value={tglSelesai} onChange={e => { setTglSelesai(e.target.value); resetData() }} className="mt-1 h-9 w-[155px] text-sm" /></div>
          </>}
          <Button onClick={handleLoad} disabled={isLoading} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
            Muat Data
          </Button>
          {data.length > 0 && (
            <Button onClick={() => handlePrint()} size="sm" variant="outline">
              <Printer className="h-4 w-4 mr-1.5" /> {isMobile ? 'Simpan PDF' : 'Cetak'}
            </Button>
          )}
        </div>
      </div>

      {pesan && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {pesan.teks}
        </div>
      )}

      {/* Preview */}
      {data.length > 0 && (
        <div className="rounded-lg border bg-slate-100 dark:bg-slate-900 p-3 overflow-x-auto">
            <div ref={printRef} className="mx-auto w-[215mm] min-w-[215mm] bg-white shadow-sm">
              <AgendaPrintDocument
                data={data}
                scope={scope}
                scopeLabel={scope === 'per_guru' ? selectedGuru : scope === 'per_kelas' ? selectedKelas : 'Semua Guru'}
                periodLabel={periodLabel}
              />
              {false && (
              <div>
              {/* Note: This content is used for printing. Not visible in UI preview here but used by handlePrint */}
              <h2>Laporan Agenda Guru</h2>
              <p className="sub">
                MAN 1 Tasikmalaya<br/>
                Periode: {formatTanggal(tglMulai)} s/d {formatTanggal(tglSelesai)}
                {guruId && guruId !== 'all_guru' && ` — ${guruNamaMap.get(guruId) || ''}`}
              </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>No</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Tanggal</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Guru</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Mapel</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Kelas</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Jam</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Materi</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Status</th>
                  <th style={{ border: '1px solid #000', padding: '4px 6px' }}>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item: any, idx: number) => {
                  const statusClass = `status-${item.status?.toLowerCase().replace('_', '-')}`
                  return (
                    <tr key={item.id || idx}>
                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{item.tanggal}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{item.guru_nama}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{item.nama_mapel}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{item.tingkat}-{item.nomor_kelas}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>
                        {item.jam_ke_mulai === item.jam_ke_selesai ? `${item.jam_ke_mulai}` : `${item.jam_ke_mulai}-${item.jam_ke_selesai}`}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{item.materi || '-'}</td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }} className={statusClass}>
                        {STATUS_STYLE[item.status]?.label || item.status}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{item.keterangan || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
              </div>
              )}
          </div>
        </div>
      )}

      {data.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-10 text-center">
          <Printer className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Pilih periode dan klik &quot;Muat Data&quot; untuk preview laporan.</p>
        </div>
      )}
    </div>
  )
}

const AGENDA_PRINT_FONT = '"Book Antiqua", "Palatino Linotype", Palatino, "Times New Roman", serif'
const agendaPrintCell = {
  border: '0.6pt solid #000',
  padding: '2.5pt 3pt',
  verticalAlign: 'top' as const,
  lineHeight: 1.2,
}

function AgendaPrintDocument({ data, scope, scopeLabel, periodLabel }: {
  data: any[]
  scope: PrintScope
  scopeLabel: string
  periodLabel: string
}) {
  const showGuru = scope !== 'per_guru'
  const showKelas = scope !== 'per_kelas'

  return (
    <div className="agenda-print-document" style={{ width: '215mm', minHeight: '330mm', padding: '8mm 8mm 10mm', background: '#fff', color: '#000', fontFamily: AGENDA_PRINT_FONT, fontSize: '8pt' }}>
      <img src="/kopsurat.png" alt="Kop Surat" style={{ width: '100%', display: 'block', marginBottom: '8pt' }} />
      <div style={{ textAlign: 'center', marginBottom: '9pt', lineHeight: 1.35 }}>
        <div style={{ fontSize: '13pt', fontWeight: 700 }}>LAPORAN MONITORING AGENDA GURU</div>
        <div style={{ fontSize: '10pt', fontWeight: 600 }}>Periode: {periodLabel}</div>
      </div>
      <table style={{ marginBottom: '8pt', borderCollapse: 'collapse', fontSize: '9pt' }}>
        <tbody>
          <tr>
            <td style={{ paddingRight: '10pt', whiteSpace: 'nowrap' }}>{scope === 'per_guru' ? 'Nama Guru' : scope === 'per_kelas' ? 'Kelas' : 'Cakupan'}</td>
            <td style={{ paddingRight: '5pt' }}>:</td>
            <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{scopeLabel}</td>
          </tr>
          <tr><td style={{ paddingRight: '10pt' }}>Jumlah Agenda</td><td style={{ paddingRight: '5pt' }}>:</td><td>{data.length} sesi</td></tr>
        </tbody>
      </table>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: AGENDA_PRINT_FONT, fontSize: '7.5pt' }}>
        <colgroup>
          <col style={{ width: '7mm' }} /><col style={{ width: '20mm' }} />
          {showGuru && <col style={{ width: '35mm' }} />}
          <col style={{ width: '25mm' }} />
          {showKelas && <col style={{ width: '17mm' }} />}
          <col style={{ width: '11mm' }} /><col /><col style={{ width: '20mm' }} /><col style={{ width: '30mm' }} />
        </colgroup>
        <thead>
          <tr>
            {['No', 'Tanggal', ...(showGuru ? ['Guru'] : []), 'Mata Pelajaran', ...(showKelas ? ['Kelas'] : []), 'Jam', 'Materi', 'Status', 'Keterangan'].map(label => (
              <th key={label} style={{ ...agendaPrintCell, padding: '3pt 2pt', textAlign: 'center', verticalAlign: 'middle', fontWeight: 700, background: '#f2f2f2' }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={`${item.penugasan_id}-${item.tanggal}-${index}`}>
              <td style={{ ...agendaPrintCell, textAlign: 'center' }}>{index + 1}</td>
              <td style={{ ...agendaPrintCell, textAlign: 'center', whiteSpace: 'nowrap' }}>{new Date(`${item.tanggal}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
              {showGuru && <td style={{ ...agendaPrintCell, whiteSpace: 'nowrap', fontSize: '7pt' }}>{item.guru_nama}</td>}
              <td style={agendaPrintCell}>{item.nama_mapel}</td>
              {showKelas && <td style={{ ...agendaPrintCell, textAlign: 'center', whiteSpace: 'nowrap' }}>{item.tingkat}-{item.nomor_kelas}</td>}
              <td style={{ ...agendaPrintCell, textAlign: 'center', whiteSpace: 'nowrap' }}>{item.jam_ke_mulai === item.jam_ke_selesai ? item.jam_ke_mulai : `${item.jam_ke_mulai}-${item.jam_ke_selesai}`}</td>
              <td style={{ ...agendaPrintCell, overflowWrap: 'break-word' }}>{item.materi || '-'}</td>
              <td style={{ ...agendaPrintCell, textAlign: 'center' }}>{STATUS_STYLE[item.status]?.label || item.status}</td>
              <td style={{ ...agendaPrintCell, overflowWrap: 'break-word' }}>{item.keterangan || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '8pt', display: 'flex', justifyContent: 'space-between', fontSize: '7pt' }}>
        <span>Dicetak pada {formatTimeWIB(new Date().toISOString())}</span>
        <span>Sistem Informasi Manajemen MAN 1 Tasikmalaya</span>
      </div>
    </div>
  )
}

// ============================================================
// TAB: MONITORING PIKET
// ============================================================
function TabMonitoringPiket() {
  const [tanggal, setTanggal] = useState(todayStr())
  const [data, setData] = useState<any[]>([])
  const [hariNama, setHariNama] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)

  // Detail foto modal
  const [fotoModal, setFotoModal] = useState<{ url: string; nama: string } | null>(null)
  // Edit status modal
  const [editItem, setEditItem] = useState<any>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editCatatan, setEditCatatan] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const PIKET_STATUS_OPTIONS = ['HADIR', 'TELAT', 'ALFA', 'SAKIT', 'IZIN']

  const handleSearch = async () => {
    setIsLoading(true); setPesan(null)
    try {
      const result = await getMonitoringPiketHarian(tanggal)
      if (result.error) setPesan({ tipe: 'error', teks: result.error })
      else {
        setData(result.data || [])
        setHariNama(result.hariNama || '')
        if ((result as any).calendarStatus && !(result as any).calendarStatus.isEffective) {
          setPesan({ tipe: 'sukses', teks: `Tanggal ini tidak efektif pembelajaran: ${(result as any).calendarStatus.reason || 'tidak ada kewajiban piket.'}` })
        }
      }
    } catch (error) {
      console.error('Gagal memuat monitoring piket:', error)
      setPesan({ tipe: 'error', teks: 'Gagal memuat monitoring piket. Silakan coba lagi.' })
      setData([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async () => {
    if (!editItem) return
    setIsEditing(true)
    try {
      const result = await editAgendaPiketStatus(
        editItem.agenda_id || null,
        editItem.jadwal_id,
        editItem.user_id,
        editItem.shift_id,
        tanggal,
        editStatus,
        editCatatan,
      )
      if (result.error) setPesan({ tipe: 'error', teks: result.error })
      else {
        setPesan({ tipe: 'sukses', teks: result.success || 'Berhasil' })
        setEditItem(null)
        await handleSearch()
      }
    } catch (error) {
      console.error('Gagal mengubah status piket:', error)
      setPesan({ tipe: 'error', teks: 'Gagal mengubah status piket. Silakan coba lagi.' })
    } finally {
      setIsEditing(false)
    }
  }

  const navigateDate = (offset: number) => {
    const d = new Date(tanggal + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    setTanggal(d.toISOString().split('T')[0])
  }

  const summary = data.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-3">
      {/* Date Picker */}
      <div className="rounded-lg border bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => navigateDate(-1)} className="px-2">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="max-w-[180px] text-sm" />
          <Button variant="outline" size="sm" onClick={() => navigateDate(1)} className="px-2">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTanggal(todayStr())} className="text-xs">Hari Ini</Button>
          <Button onClick={handleSearch} disabled={isLoading} size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
            Cari
          </Button>
        </div>
      </div>

      {/* Pesan */}
      {pesan && (
        <div className={`rounded-lg border px-4 py-2.5 text-sm ${
          pesan.tipe === 'sukses' ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700'
        }`}>{pesan.teks}</div>
      )}

      {/* Summary badges */}
      {data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full font-medium">
            {hariNama} &middot; {data.length} guru piket
          </span>
          {Object.entries(summary).map(([status, count]) => {
            const s = STATUS_STYLE[status]
            return s ? (
              <span key={status} className={`text-xs px-2.5 py-1 rounded-full font-medium border ${s.bg} ${s.text}`}>
                {s.label}: {count as number}
              </span>
            ) : null
          })}
        </div>
      )}

      {/* Table */}
      {data.length > 0 && (
        <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-8">#</TableHead>
                <TableHead className="text-xs">Guru</TableHead>
                <TableHead className="text-xs">Shift</TableHead>
                <TableHead className="text-xs">Waktu Shift</TableHead>
                <TableHead className="text-xs">Waktu Submit</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, idx) => {
                const style = STATUS_STYLE[item.status] || STATUS_STYLE.ALFA
                const StatusIcon = style.icon
                return (
                  <TableRow key={`${item.jadwal_id}-${idx}`}>
                    <TableCell className="text-xs text-slate-400">{idx + 1}</TableCell>
                    <TableCell className="text-xs font-medium text-slate-800 dark:text-slate-200">{item.guru_nama}</TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">{item.shift_nama}</TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      {item.slot_mulai !== '-' ? `${item.slot_mulai}–${item.slot_selesai}` : `Jam ${item.jam_mulai}–${item.jam_selesai}`}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      {item.waktu_submit
                        ? formatTimeWIB(item.waktu_submit, { legacyShiftedWIB: true })
                        : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${style.bg} ${style.text}`}>
                        <StatusIcon className="h-3 w-3" />{style.label}
                      </span>
                      {item.catatan_admin && (
                        <p className="text-[10px] text-amber-600 mt-0.5">{item.catatan_admin}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {item.foto_url && (
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => setFotoModal({ url: item.foto_url, nama: item.guru_nama })}
                          title="Lihat Foto"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={() => { setEditItem(item); setEditStatus(item.status); setEditCatatan(item.catatan_admin || '') }}
                        title="Ubah Status"
                      >
                        <Edit3 className="h-3.5 w-3.5 text-teal-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {data.length === 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-10 text-center">
          <ShieldCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Pilih tanggal dan klik &quot;Cari&quot; untuk melihat kehadiran guru piket.</p>
        </div>
      )}

      {/* Modal Foto */}
      <Dialog open={!!fotoModal} onOpenChange={() => setFotoModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Foto Kehadiran Piket</DialogTitle>
          </DialogHeader>
          {fotoModal && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">{fotoModal.nama}</p>
              <img
                src={fotoModal.url}
                alt={`Foto piket ${fotoModal.nama}`}
                className="w-full max-h-96 object-cover rounded-lg border"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Edit Status */}
      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Ubah Status Piket</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div className="text-sm">
                <p className="font-medium text-slate-800 dark:text-slate-200">{editItem.guru_nama}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{editItem.shift_nama} &mdash; {tanggal}</p>
              </div>
              <div>
                <Label className="text-xs">Status Baru</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PIKET_STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{STATUS_STYLE[s]?.label || s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Catatan Admin</Label>
                <textarea
                  value={editCatatan}
                  onChange={(e) => setEditCatatan(e.target.value)}
                  placeholder="Alasan perubahan status..."
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none resize-none"
                />
              </div>
              <Button onClick={handleEdit} disabled={isEditing} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                {isEditing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Edit3 className="h-4 w-4 mr-2" />}
                Simpan Perubahan
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
