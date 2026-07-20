'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw,
  Pencil, Trash2, CheckCircle2, XCircle, Search, Upload, FileSpreadsheet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  deleteKalenderEvent,
  deleteKbmException,
  getKalenderKelasOptions,
  getKalenderPendidikanData,
  importKalenderResmi,
  saveKalenderEvent,
  saveKbmException,
  syncTanggalMerah,
  type KalenderImportRow,
} from '../actions'
import {
  KALENDER_CATEGORY_LABELS,
  type KbmException,
  type KbmExceptionTargetType,
  type KalenderDateStatus,
  type KalenderEvent,
  type KalenderKategori,
} from '@/lib/kalender-pendidikan'

type KalenderData = {
  year: number
  month: number
  events: KalenderEvent[]
  statuses: KalenderDateStatus[]
  summary: {
    effective: number
    nonEffective: number
    tanggalMerah: number
    eventSekolah: number
    kbmExceptions?: number
  }
  kbmExceptions: KbmException[]
  syncLog: {
    tahun: number
    source: string
    status: string
    jumlah_data: number
    message: string | null
    synced_at: string
  } | null
}

type FormState = {
  id?: string
  start_date: string
  end_date: string
  title: string
  category: KalenderKategori
  is_effective: boolean
  description: string
}

type KbmFormState = {
  id?: string
  tanggal: string
  judul: string
  kategori: KalenderKategori
  jam_ke_mulai: string
  jam_ke_selesai: string
  target_type: KbmExceptionTargetType
  target_value: string
  description: string
}

type KelasOption = { id: string; tingkat: number; label: string }

type ImportPreviewRow = KalenderImportRow & { row_no: number }

const CATEGORY_TONES: Record<string, string> = {
  TANGGAL_MERAH: 'bg-rose-50 text-rose-700 border-rose-200',
  LIBUR_SEMESTER: 'bg-amber-50 text-amber-700 border-amber-200',
  RAPAT: 'bg-violet-50 text-violet-700 border-violet-200',
  UJIAN: 'bg-blue-50 text-blue-700 border-blue-200',
  KEGIATAN_MADRASAH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  LAINNYA: 'bg-slate-50 text-slate-700 border-slate-200',
  MINGGU: 'bg-slate-100 text-slate-500 border-slate-200',
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const CKH_WORKDAY_CATEGORIES = new Set(['RAPAT', 'UJIAN', 'KEGIATAN_MADRASAH', 'LAINNYA'])

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function emptyForm(date: string): FormState {
  return {
    start_date: date,
    end_date: date,
    title: '',
    category: 'LAINNYA',
    is_effective: false,
    description: '',
  }
}

function emptyKbmForm(date: string): KbmFormState {
  return {
    tanggal: date,
    judul: '',
    kategori: 'KEGIATAN_MADRASAH',
    jam_ke_mulai: '1',
    jam_ke_selesai: '1',
    target_type: 'ALL',
    target_value: '',
    description: '',
  }
}

function targetLabel(item: KbmException, kelasOptions: KelasOption[]) {
  if (item.target_type === 'ALL') return 'Semua kelas'
  if (item.target_type === 'TINGKAT') return `Kelas ${item.target_value}`
  const kelas = kelasOptions.find(k => k.id === item.target_value)
  return kelas?.label || 'Kelas tertentu'
}

function isCkhWorkdayCategory(category: string | null | undefined) {
  return !!category && CKH_WORKDAY_CATEGORIES.has(category)
}

function getStatusMeta(status: Pick<KalenderDateStatus, 'isEffective' | 'category'> | null | undefined) {
  if (status?.isEffective) {
    return {
      label: 'Hari efektif KBM',
      text: 'text-emerald-700',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      cell: 'bg-white dark:bg-slate-900 hover:bg-emerald-50/70',
      icon: 'effective',
    }
  }

  if (isCkhWorkdayCategory(status?.category)) {
    return {
      label: 'Non-KBM, masuk CKH',
      text: 'text-blue-700',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      cell: 'bg-blue-50/70 dark:bg-blue-950/20 hover:bg-blue-100/70',
      icon: 'ckh',
    }
  }

  return {
    label: 'Libur/tidak masuk CKH',
    text: 'text-rose-700',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    cell: 'bg-rose-50/70 dark:bg-rose-950/20 hover:bg-rose-100/70',
    icon: 'off',
  }
}

function getEventStatusMeta(event: Pick<KalenderEvent, 'category' | 'is_effective'>) {
  return getStatusMeta({
    isEffective: Number(event.is_effective) === 1,
    category: event.category,
  })
}

export function KalenderPendidikanClient({ initialData }: { initialData: KalenderData }) {
  const [data, setData] = useState(initialData)
  const [categoryFilter, setCategoryFilter] = useState('SEMUA')
  const [query, setQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [kbmForm, setKbmForm] = useState<KbmFormState | null>(null)
  const [kelasOptions, setKelasOptions] = useState<KelasOption[]>([])
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importYear, setImportYear] = useState(String(initialData.year))
  const [importRows, setImportRows] = useState<ImportPreviewRow[]>([])
  const [importError, setImportError] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [syncYear, setSyncYear] = useState(String(initialData.year))
  const [isPending, startTransition] = useTransition()

  const statusByDate = useMemo(() => {
    const map = new Map<string, KalenderDateStatus>()
    for (const status of data.statuses) map.set(status.tanggal, status)
    return map
  }, [data.statuses])

  const selectedStatus = selectedDate ? statusByDate.get(selectedDate) : null
  const selectedKbmExceptions = selectedDate ? data.kbmExceptions.filter(item => item.tanggal === selectedDate) : []

  const filteredEvents = data.events.filter(event => {
    if (categoryFilter !== 'SEMUA' && event.category !== categoryFilter) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      return event.title.toLowerCase().includes(q) || (event.description || '').toLowerCase().includes(q)
    }
    return true
  })

  const filteredKbmExceptions = data.kbmExceptions.filter(item => {
    if (query.trim()) {
      const q = query.toLowerCase()
      return item.judul.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q)
    }
    return true
  })

  const calendarCells = useMemo(() => {
    const firstDay = new Date(data.year, data.month - 1, 1)
    const startOffset = (firstDay.getDay() + 6) % 7
    const lastDay = new Date(data.year, data.month, 0).getDate()
    const cells: Array<{ date: string | null; day: number | null; status?: KalenderDateStatus }> = []
    for (let i = 0; i < startOffset; i++) cells.push({ date: null, day: null })
    for (let day = 1; day <= lastDay; day++) {
      const date = isoDate(data.year, data.month, day)
      cells.push({ date, day, status: statusByDate.get(date) })
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, day: null })
    return cells
  }, [data.month, data.year, statusByDate])

  const reload = (year = data.year, month = data.month) => {
    startTransition(async () => {
      setMessage(null)
      setData(await getKalenderPendidikanData(year, month))
    })
  }

  const moveMonth = (offset: number) => {
    const next = new Date(data.year, data.month - 1 + offset, 1)
    reload(next.getFullYear(), next.getMonth() + 1)
  }

  const submitForm = () => {
    if (!form) return
    startTransition(async () => {
      const result = await saveKalenderEvent(form)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
        return
      }
      setMessage({ type: 'success', text: result.success || 'Tersimpan.' })
      setForm(null)
      reload()
    })
  }

  const ensureKelasOptions = async () => {
    if (kelasOptions.length > 0) return kelasOptions
    const options = await getKalenderKelasOptions()
    setKelasOptions(options)
    return options
  }

  const submitKbmForm = () => {
    if (!kbmForm) return
    startTransition(async () => {
      const result = await saveKbmException({
        id: kbmForm.id,
        tanggal: kbmForm.tanggal,
        judul: kbmForm.judul,
        kategori: kbmForm.kategori,
        jam_ke_mulai: Number(kbmForm.jam_ke_mulai),
        jam_ke_selesai: Number(kbmForm.jam_ke_selesai),
        target_type: kbmForm.target_type,
        target_value: kbmForm.target_type === 'ALL' ? null : kbmForm.target_value,
        description: kbmForm.description,
      })
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
        return
      }
      setMessage({ type: 'success', text: result.success || 'Tersimpan.' })
      setKbmForm(null)
      reload()
    })
  }

  const removeEvent = (event: KalenderEvent) => {
    if (!confirm(`Hapus "${event.title}" dari kalender pendidikan?`)) return
    startTransition(async () => {
      const result = await deleteKalenderEvent(event.id)
      if (result.error) setMessage({ type: 'error', text: result.error })
      else {
        setMessage({ type: 'success', text: result.success || 'Dihapus.' })
        reload()
      }
    })
  }

  const removeKbmException = (item: KbmException) => {
    if (!confirm(`Hapus pengecualian "${item.judul}"?`)) return
    startTransition(async () => {
      const result = await deleteKbmException(item.id)
      if (result.error) setMessage({ type: 'error', text: result.error })
      else {
        setMessage({ type: 'success', text: result.success || 'Dihapus.' })
        reload()
      }
    })
  }

  const syncHolidays = () => {
    const year = Number(syncYear)
    startTransition(async () => {
      setMessage(null)
      const result = await syncTanggalMerah(year)
      if (result.error) setMessage({ type: 'error', text: result.error })
      else {
        setMessage({ type: 'success', text: result.success || 'Sinkron berhasil.' })
        reload(data.year, data.month)
      }
    })
  }

  const handleImportFile = async (file: File | null) => {
    setImportError('')
    setImportRows([])
    if (!file) return

    try {
      const parsed = await parseImportFile(file)
      if (parsed.length === 0) {
        setImportError('File tidak berisi baris valid. Gunakan template Excel yang tersedia.')
        return
      }
      setImportRows(parsed)
    } catch (error: any) {
      setImportError(error?.message || 'File tidak bisa dibaca.')
    }
  }

  const submitImport = () => {
    const year = Number(importYear)
    startTransition(async () => {
      const result = await importKalenderResmi(year, importRows)
      if (result.error) {
        setImportError(result.error)
        return
      }
      setMessage({ type: 'success', text: result.success || 'Impor berhasil.' })
      setIsImportOpen(false)
      setImportRows([])
      setImportError('')
      reload(data.year, data.month)
    })
  }

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx') as any
    const year = Number(importYear) || data.year
    const rows = [
      {
        tanggal: `${year}-01-01`,
        tanggal_selesai: `${year}-01-01`,
        nama: `Tahun Baru ${year} Masehi`,
        jenis: 'Tanggal Merah',
        status: 'Tidak Efektif',
        catatan: 'SKB resmi',
      },
      {
        tanggal: `${year}-12-07`,
        tanggal_selesai: `${year}-12-12`,
        nama: 'Ujian Semester',
        jenis: 'Ujian',
        status: 'Non-KBM',
        catatan: 'Guru bertugas, masuk CKH',
      },
    ]
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [
      { wch: 14 },
      { wch: 18 },
      { wch: 34 },
      { wch: 20 },
      { wch: 16 },
      { wch: 24 },
    ]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template SKB')
    XLSX.writeFile(workbook, `template_skb_${year}.xlsx`)
  }

  const openEdit = (event: KalenderEvent) => {
    setForm({
      id: event.id,
      start_date: event.start_date,
      end_date: event.end_date,
      title: event.title,
      category: event.category,
      is_effective: Number(event.is_effective) === 1,
      description: event.description || '',
    })
  }

  const openEditKbm = async (item: KbmException) => {
    await ensureKelasOptions()
    setKbmForm({
      id: item.id,
      tanggal: item.tanggal,
      judul: item.judul,
      kategori: item.kategori,
      jam_ke_mulai: String(item.jam_ke_mulai),
      jam_ke_selesai: String(item.jam_ke_selesai),
      target_type: item.target_type,
      target_value: item.target_value || '',
      description: item.description || '',
    })
  }

  const openAdd = (date?: string) => {
    setForm(emptyForm(date || isoDate(data.year, data.month, 1)))
  }

  const openAddKbm = async (date?: string) => {
    await ensureKelasOptions()
    setKbmForm(emptyKbmForm(date || selectedDate || isoDate(data.year, data.month, 1)))
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={cn(
          'rounded-lg border px-4 py-3 text-sm',
          message.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-rose-50 border-rose-200 text-rose-700',
        )}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          ['Hari efektif KBM', data.summary.effective, 'text-emerald-700 bg-emerald-50 border-emerald-200'],
          ['Non-KBM/Libur', data.summary.nonEffective, 'text-blue-700 bg-blue-50 border-blue-200'],
          ['Tanggal merah', data.summary.tanggalMerah, 'text-amber-700 bg-amber-50 border-amber-200'],
          ['Pengecualian KBM', data.summary.kbmExceptions || 0, 'text-blue-700 bg-blue-50 border-blue-200'],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className={cn('rounded-lg border p-3', String(tone))}>
            <p className="text-[11px] font-medium opacity-80">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-surface bg-surface p-3 space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => moveMonth(-1)} className="h-9 w-9 p-0" disabled={isPending}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[190px] rounded-lg border border-surface-2 bg-surface-2 px-3 py-2 text-center">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{MONTHS[data.month - 1]} {data.year}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => moveMonth(1)} className="h-9 w-9 p-0" disabled={isPending}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
            <Button onClick={() => openAdd()} size="sm" className="h-9 bg-slate-900 hover:bg-slate-800 text-white">
              <Plus className="h-4 w-4 mr-1.5" /> Tambah Event
            </Button>
            <Button onClick={() => openAddKbm()} size="sm" variant="outline" className="h-9">
              <Plus className="h-4 w-4 mr-1.5" /> Pengecualian KBM
            </Button>
            <Button onClick={() => { setImportYear(String(data.year)); setIsImportOpen(true) }} size="sm" variant="outline" className="h-9">
              <Upload className="h-4 w-4 mr-1.5" /> Impor SKB
            </Button>
            <div className="flex items-center gap-2 rounded-lg border border-surface-2 bg-surface-2 p-1">
              <Input
                type="number"
                min={2020}
                max={2100}
                value={syncYear}
                onChange={e => setSyncYear(e.target.value)}
                className="h-8 w-24 text-sm bg-surface"
              />
              <Button onClick={syncHolidays} size="sm" variant="outline" className="h-8 text-xs" disabled={isPending}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Sinkron
              </Button>
            </div>
          </div>
        </div>

        {data.syncLog && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Sinkron terakhir {data.syncLog.tahun}: {data.syncLog.status === 'SUCCESS' ? `${data.syncLog.jumlah_data} data dari ${data.syncLog.source}` : data.syncLog.message || 'gagal'}.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <div className="rounded-xl border border-surface bg-surface overflow-hidden">
          <div className="grid grid-cols-7 border-b border-surface-2 bg-surface-2">
            {WEEKDAYS.map(day => (
              <div key={day} className="px-2 py-2 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarCells.map((cell, idx) => {
              const status = cell.status
              const events = status?.events || []
              const statusMeta = getStatusMeta(status)
              return (
                <button
                  key={`${cell.date || 'blank'}-${idx}`}
                  disabled={!cell.date}
                  onClick={() => setSelectedDate(cell.date)}
                  className={cn(
                    'min-h-[92px] border-r border-b border-surface-2 p-2 text-left transition-colors disabled:bg-surface-2/50 disabled:cursor-default',
                    cell.date && statusMeta.cell,
                    selectedDate === cell.date && 'ring-2 ring-inset ring-emerald-500',
                  )}
                >
                  {cell.date && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className={cn('text-sm font-semibold', status?.isEffective ? 'text-slate-800 dark:text-slate-100' : statusMeta.text)}>{cell.day}</span>
                        {statusMeta.icon === 'off'
                          ? <XCircle className="h-3.5 w-3.5 text-rose-500" />
                          : <CheckCircle2 className={cn('h-3.5 w-3.5', statusMeta.icon === 'ckh' ? 'text-blue-500' : 'text-emerald-500')} />}
                      </div>
                      <div className="mt-2 space-y-1">
                        {events.slice(0, 2).map(event => (
                          <div key={event.id} className={cn('truncate rounded border px-1.5 py-0.5 text-[10px] font-medium', CATEGORY_TONES[event.category])}>
                            {event.title}
                          </div>
                        ))}
                        {data.kbmExceptions.filter(item => item.tanggal === cell.date).slice(0, 1).map(item => (
                          <div key={item.id} className="truncate rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                            Jam ke-{item.jam_ke_mulai}-{item.jam_ke_selesai}: {item.judul}
                          </div>
                        ))}
                        {events.length === 0 && !status?.isEffective && (
                          <div className="truncate rounded border px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 border-slate-200">
                            Minggu
                          </div>
                        )}
                        {events.length > 2 && <p className="text-[10px] text-slate-400">+{events.length - 2} event</p>}
                      </div>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-surface bg-surface p-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Detail Tanggal</p>
            </div>
            {!selectedStatus ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Pilih tanggal pada kalender untuk melihat detail.</p>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  {(() => {
                    const statusMeta = getStatusMeta(selectedStatus)
                    return (
                      <>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-50">{formatDate(selectedStatus.tanggal)}</p>
                  <span className={cn(
                    'mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                    statusMeta.badge,
                  )}>
                    {statusMeta.label}
                  </span>
                      </>
                    )
                  })()}
                </div>
                {selectedStatus.events.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{selectedStatus.reason || 'Tidak ada event.'}</p>
                ) : (
                  <div className="space-y-2">
                    {selectedStatus.events.map(event => (
                      <EventRow key={event.id} event={event} onEdit={openEdit} onDelete={removeEvent} />
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Pengecualian Jam KBM</p>
                    <span className="text-[10px] text-slate-400">{selectedKbmExceptions.length} item</span>
                  </div>
                  {selectedKbmExceptions.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-surface-2 px-3 py-3 text-xs text-slate-400">Tidak ada pengecualian jam KBM.</p>
                  ) : selectedKbmExceptions.map(item => (
                    <KbmExceptionRow
                      key={item.id}
                      item={item}
                      kelasOptions={kelasOptions}
                      onEdit={openEditKbm}
                      onDelete={removeKbmException}
                    />
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => openAdd(selectedStatus.tanggal)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Tambah di tanggal ini
                </Button>
                <Button variant="outline" size="sm" className="w-full" onClick={() => openAddKbm(selectedStatus.tanggal)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Tambah pengecualian KBM
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-surface bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Event Bulan Ini</p>
              <span className="text-xs text-slate-400">{filteredEvents.length} event</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari event..." className="h-9 pl-8 text-sm" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 w-[132px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEMUA">Semua</SelectItem>
                  {Object.entries(KALENDER_CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {filteredEvents.length === 0 ? (
                <p className="rounded-lg border border-dashed border-surface-2 px-3 py-8 text-center text-sm text-slate-400">Belum ada event.</p>
              ) : filteredEvents.map(event => (
                <EventRow key={event.id} event={event} onEdit={openEdit} onDelete={removeEvent} />
              ))}
              {filteredKbmExceptions.map(item => (
                <KbmExceptionRow
                  key={item.id}
                  item={item}
                  kelasOptions={kelasOptions}
                  onEdit={openEditKbm}
                  onDelete={removeKbmException}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!form} onOpenChange={open => !open && setForm(null)}>
        <DialogContent className="sm:max-w-lg rounded-xl border-surface">
          <DialogHeader className="border-b border-surface-2 pb-3">
            <DialogTitle className="text-base">{form?.id ? 'Edit Event Kalender' : 'Tambah Event Kalender'}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tanggal mulai</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value, end_date: e.target.value > form.end_date ? e.target.value : form.end_date })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tanggal selesai</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Judul</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Contoh: Libur semester ganjil" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Kategori</Label>
                  <Select value={form.category} onValueChange={value => setForm({ ...form, category: value as KalenderKategori })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(KALENDER_CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status hari</Label>
                  <Select value={form.is_effective ? 'effective' : 'non-effective'} onValueChange={value => setForm({ ...form, is_effective: value === 'effective' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="non-effective">Non-KBM / Libur</SelectItem>
                      <SelectItem value="effective">Hari efektif KBM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Catatan</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Catatan opsional..." rows={3} />
              </div>

              <Button onClick={submitForm} disabled={isPending} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Simpan Event
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!kbmForm} onOpenChange={open => !open && setKbmForm(null)}>
        <DialogContent className="sm:max-w-lg rounded-xl border-surface">
          <DialogHeader className="border-b border-surface-2 pb-3">
            <DialogTitle className="text-base">{kbmForm?.id ? 'Edit Pengecualian Jam KBM' : 'Tambah Pengecualian Jam KBM'}</DialogTitle>
          </DialogHeader>
          {kbmForm && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Tanggal</Label>
                  <Input type="date" value={kbmForm.tanggal} onChange={e => setKbmForm({ ...kbmForm, tanggal: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kategori</Label>
                  <Select value={kbmForm.kategori} onValueChange={value => setKbmForm({ ...kbmForm, kategori: value as KalenderKategori })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(KALENDER_CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Judul</Label>
                <Input value={kbmForm.judul} onChange={e => setKbmForm({ ...kbmForm, judul: e.target.value })} placeholder="Contoh: Pembinaan kelas 11 di GOR" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Jam mulai</Label>
                  <Input type="number" min={1} max={20} value={kbmForm.jam_ke_mulai} onChange={e => setKbmForm({ ...kbmForm, jam_ke_mulai: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Jam selesai</Label>
                  <Input type="number" min={1} max={20} value={kbmForm.jam_ke_selesai} onChange={e => setKbmForm({ ...kbmForm, jam_ke_selesai: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Sasaran</Label>
                  <Select value={kbmForm.target_type} onValueChange={value => setKbmForm({ ...kbmForm, target_type: value as KbmExceptionTargetType, target_value: '' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Semua kelas</SelectItem>
                      <SelectItem value="TINGKAT">Tingkat kelas</SelectItem>
                      <SelectItem value="KELAS">Kelas tertentu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {kbmForm.target_type === 'TINGKAT' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tingkat</Label>
                    <Select value={kbmForm.target_value} onValueChange={value => setKbmForm({ ...kbmForm, target_value: value })}>
                      <SelectTrigger><SelectValue placeholder="Pilih tingkat" /></SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set(kelasOptions.map(k => k.tingkat))).sort((a, b) => a - b).map(tingkat => (
                          <SelectItem key={tingkat} value={String(tingkat)}>Kelas {tingkat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {kbmForm.target_type === 'KELAS' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Kelas</Label>
                    <Select value={kbmForm.target_value} onValueChange={value => setKbmForm({ ...kbmForm, target_value: value })}>
                      <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                      <SelectContent>
                        {kelasOptions.map(kelas => (
                          <SelectItem key={kelas.id} value={kelas.id}>{kelas.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Catatan</Label>
                <Textarea value={kbmForm.description} onChange={e => setKbmForm({ ...kbmForm, description: e.target.value })} placeholder="Catatan opsional..." rows={3} />
              </div>

              <Button onClick={submitKbmForm} disabled={isPending} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Simpan Pengecualian
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-3xl rounded-xl border-surface">
          <DialogHeader className="border-b border-surface-2 pb-3">
            <DialogTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Impor SKB Resmi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Unduh template Excel, isi daftar SKB resmi, lalu upload kembali. Status isi <strong>Tidak Efektif</strong> untuk libur/cuti bersama.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Tahun</Label>
                <Input type="number" value={importYear} onChange={e => setImportYear(e.target.value)} min={2020} max={2100} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Template dan file Excel</Label>
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-2">
                  <Button type="button" variant="outline" onClick={downloadTemplate} className="gap-1.5">
                    <FileSpreadsheet className="h-4 w-4" />
                    Download Template
                  </Button>
                  <Input type="file" accept=".xlsx,.xls" onChange={e => handleImportFile(e.target.files?.[0] || null)} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-surface-2 bg-surface-2 p-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kolom template</p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-white dark:bg-slate-900 p-2 text-[11px] text-slate-600 dark:text-slate-300">{`tanggal,nama,jenis,status,catatan
2027-01-01,Tahun Baru 2027 Masehi,Tanggal Merah,Tidak Efektif,SKB resmi
2027-03-10,Cuti Bersama Idulfitri,Tanggal Merah,Tidak Efektif,SKB resmi
2027-12-07,Ujian Semester,Ujian,Non-KBM,Guru bertugas masuk CKH`}</pre>
            </div>

            {importError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{importError}</div>
            )}

            {importRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Preview {importRows.length} baris</p>
                <div className="max-h-72 overflow-auto rounded-lg border border-surface-2">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-2 text-slate-500">
                      <tr>
                        <th className="px-2 py-2 text-left">Tanggal</th>
                        <th className="px-2 py-2 text-left">Nama</th>
                        <th className="px-2 py-2 text-left">Jenis</th>
                        <th className="px-2 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-2">
                      {importRows.slice(0, 80).map(row => (
                        <tr key={row.row_no}>
                          <td className="px-2 py-2 whitespace-nowrap">{row.start_date}{row.end_date !== row.start_date ? ` s/d ${row.end_date}` : ''}</td>
                          <td className="px-2 py-2">{row.title}</td>
                          <td className="px-2 py-2">{KALENDER_CATEGORY_LABELS[row.category]}</td>
                          <td className={cn('px-2 py-2 font-semibold', getStatusMeta({ isEffective: row.is_effective, category: row.category }).text)}>
                            {getStatusMeta({ isEffective: row.is_effective, category: row.category }).label}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importRows.length > 80 && <p className="text-[11px] text-slate-400">Preview menampilkan 80 baris pertama.</p>}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end border-t border-surface-2 pt-3">
              <Button variant="outline" onClick={() => setIsImportOpen(false)} disabled={isPending}>Batal</Button>
              <Button onClick={submitImport} disabled={isPending || importRows.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Simpan sebagai SKB Resmi
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EventRow({
  event,
  onEdit,
  onDelete,
}: {
  event: KalenderEvent
  onEdit: (event: KalenderEvent) => void
  onDelete: (event: KalenderEvent) => void
}) {
  const statusMeta = getEventStatusMeta(event)

  return (
    <div className="rounded-lg border border-surface-2 bg-surface-2 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{event.title}</p>
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', CATEGORY_TONES[event.category])}>
              {KALENDER_CATEGORY_LABELS[event.category]}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {formatDate(event.start_date)}{event.start_date !== event.end_date ? ` s/d ${formatDate(event.end_date)}` : ''}
          </p>
          <p className={cn('mt-1 text-[11px] font-semibold', statusMeta.text)}>
            {statusMeta.label} | {event.source === 'official' ? 'SKB Resmi' : event.source === 'sync' ? 'API Publik' : 'Manual'}
          </p>
          {event.description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{event.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => onEdit(event)} className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-emerald-600" title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(event)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Hapus">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function KbmExceptionRow({
  item,
  kelasOptions,
  onEdit,
  onDelete,
}: {
  item: KbmException
  kelasOptions: KelasOption[]
  onEdit: (item: KbmException) => void
  onDelete: (item: KbmException) => void
}) {
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-slate-800">{item.judul}</p>
            <span className="rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-sky-700">
              Jam ke-{item.jam_ke_mulai}-{item.jam_ke_selesai}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(item.tanggal)} | {targetLabel(item, kelasOptions)}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-sky-700">Pengecualian KBM parsial</p>
          {item.description && <p className="mt-1 text-xs text-slate-500">{item.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => onEdit(item)} className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-sky-600" title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(item)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Hapus">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

async function parseImportFile(file: File): Promise<ImportPreviewRow[]> {
  const XLSX = await import('xlsx') as any
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const worksheet = workbook.Sheets[sheetName]
  const records = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Array<Record<string, unknown>>
  const rows: ImportPreviewRow[] = []

  records.forEach((record: Record<string, unknown>, index: number) => {
    const obj: Record<string, string> = {}
    for (const [key, value] of Object.entries(record)) {
      obj[normalizeHeader(key)] = value instanceof Date ? value.toISOString().split('T')[0] : String(value ?? '').trim()
    }

    const start = normalizeDateCell(obj.tanggal || obj.date || obj.start_date || obj.mulai)
    const end = normalizeDateCell(obj.tanggal_selesai || obj.end_date || obj.selesai || obj.sampai || start)
    const title = obj.nama || obj.title || obj.judul || obj.keterangan
    if (!start || !end || !title) return

    rows.push({
      row_no: index + 2,
      start_date: start,
      end_date: end,
      title: title.trim(),
      category: parseCategory(obj.jenis || obj.category || obj.kategori),
      is_effective: parseEffective(obj.status || obj.efektif || obj.is_effective),
      description: obj.catatan || obj.description || '',
    })
  })

  return rows
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
}

function normalizeDateCell(value: string) {
  const clean = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean
  const slash = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (slash) {
    return `${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`
  }
  if (/^\d+(\.\d+)?$/.test(clean)) {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(Number(clean)))
    return epoch.toISOString().split('T')[0]
  }
  return ''
}

function parseCategory(value: string): KalenderKategori {
  const raw = value.trim().toLowerCase()
  if (raw.includes('semester')) return 'LIBUR_SEMESTER'
  if (raw.includes('rapat')) return 'RAPAT'
  if (raw.includes('ujian') || raw.includes('asesmen')) return 'UJIAN'
  if (raw.includes('kegiatan')) return 'KEGIATAN_MADRASAH'
  if (raw.includes('lain')) return 'LAINNYA'
  return 'TANGGAL_MERAH'
}

function parseEffective(value: string) {
  const raw = value.trim().toLowerCase()
  if (!raw) return false
  if (raw.includes('tidak') || raw.includes('libur') || raw.includes('cuti') || raw === '0' || raw === 'false') return false
  return raw.includes('efektif') || raw.includes('masuk') || raw === '1' || raw === 'true'
}
