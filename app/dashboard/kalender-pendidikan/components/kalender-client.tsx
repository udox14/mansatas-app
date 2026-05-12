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
  getKalenderPendidikanData,
  importKalenderResmi,
  saveKalenderEvent,
  syncTanggalMerah,
  type KalenderImportRow,
} from '../actions'
import {
  KALENDER_CATEGORY_LABELS,
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
  }
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

export function KalenderPendidikanClient({ initialData }: { initialData: KalenderData }) {
  const [data, setData] = useState(initialData)
  const [categoryFilter, setCategoryFilter] = useState('SEMUA')
  const [query, setQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
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

  const filteredEvents = data.events.filter(event => {
    if (categoryFilter !== 'SEMUA' && event.category !== categoryFilter) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      return event.title.toLowerCase().includes(q) || (event.description || '').toLowerCase().includes(q)
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
        tanggal: `${year}-07-20`,
        tanggal_selesai: `${year}-07-20`,
        nama: 'Kegiatan Awal Tahun',
        jenis: 'Kegiatan Madrasah',
        status: 'Hari Efektif',
        catatan: 'Masuk seperti biasa',
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

  const openAdd = (date?: string) => {
    setForm(emptyForm(date || isoDate(data.year, data.month, 1)))
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
          ['Hari efektif', data.summary.effective, 'text-emerald-700 bg-emerald-50 border-emerald-200'],
          ['Tidak efektif', data.summary.nonEffective, 'text-rose-700 bg-rose-50 border-rose-200'],
          ['Tanggal merah', data.summary.tanggalMerah, 'text-amber-700 bg-amber-50 border-amber-200'],
          ['Event sekolah', data.summary.eventSekolah, 'text-blue-700 bg-blue-50 border-blue-200'],
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
              const tone = status?.isEffective
                ? 'bg-white dark:bg-slate-900 hover:bg-emerald-50/70'
                : 'bg-rose-50/70 dark:bg-rose-950/20 hover:bg-rose-100/70'
              return (
                <button
                  key={`${cell.date || 'blank'}-${idx}`}
                  disabled={!cell.date}
                  onClick={() => setSelectedDate(cell.date)}
                  className={cn(
                    'min-h-[92px] border-r border-b border-surface-2 p-2 text-left transition-colors disabled:bg-surface-2/50 disabled:cursor-default',
                    cell.date && tone,
                    selectedDate === cell.date && 'ring-2 ring-inset ring-emerald-500',
                  )}
                >
                  {cell.date && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className={cn('text-sm font-semibold', status?.isEffective ? 'text-slate-800 dark:text-slate-100' : 'text-rose-700')}>{cell.day}</span>
                        {status?.isEffective ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-rose-500" />}
                      </div>
                      <div className="mt-2 space-y-1">
                        {events.slice(0, 2).map(event => (
                          <div key={event.id} className={cn('truncate rounded border px-1.5 py-0.5 text-[10px] font-medium', CATEGORY_TONES[event.category])}>
                            {event.title}
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
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-50">{formatDate(selectedStatus.tanggal)}</p>
                  <span className={cn(
                    'mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
                    selectedStatus.isEffective ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200',
                  )}>
                    {selectedStatus.isEffective ? 'Hari efektif' : 'Tidak efektif'}
                  </span>
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
                <Button variant="outline" size="sm" className="w-full" onClick={() => openAdd(selectedStatus.tanggal)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Tambah di tanggal ini
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
                      <SelectItem value="non-effective">Tidak efektif</SelectItem>
                      <SelectItem value="effective">Hari efektif</SelectItem>
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
2027-07-20,Kegiatan Awal Tahun,Kegiatan Madrasah,Hari Efektif,Masuk seperti biasa`}</pre>
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
                          <td className={cn('px-2 py-2 font-semibold', row.is_effective ? 'text-emerald-600' : 'text-rose-600')}>{row.is_effective ? 'Hari efektif' : 'Tidak efektif'}</td>
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
          <p className={cn('mt-1 text-[11px] font-semibold', Number(event.is_effective) === 1 ? 'text-emerald-600' : 'text-rose-600')}>
            {Number(event.is_effective) === 1 ? 'Hari efektif' : 'Tidak efektif'} | {event.source === 'official' ? 'SKB Resmi' : event.source === 'sync' ? 'API Publik' : 'Manual'}
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
