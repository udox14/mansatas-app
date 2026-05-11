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
  Pencil, Trash2, CheckCircle2, XCircle, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  deleteKalenderEvent,
  getKalenderPendidikanData,
  saveKalenderEvent,
  syncTanggalMerah,
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
            {Number(event.is_effective) === 1 ? 'Hari efektif' : 'Tidak efektif'} | {event.source === 'sync' ? 'Sinkron' : 'Manual'}
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
