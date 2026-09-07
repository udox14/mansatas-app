'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Clock, CalendarOff, CheckSquare, FileText, Plus, Edit3, Trash2,
  AlertTriangle, CheckCircle2, Copy, ExternalLink, RefreshCw, Sparkles, Check
} from 'lucide-react'
import {
  PB_DAYS,
  DEFAULT_PB_SLOTS,
  getDefaultPbSlots,
  type PbSlot,
  type PbJob,
  type PbHoliday
} from '@/lib/pramubakti'
import { getPramubaktiSettings, savePramubaktiSettings } from './actions'

type SettingsData = Awaited<ReturnType<typeof getPramubaktiSettings>>

export function PramubaktiSettingsClient({ initialData }: { initialData: SettingsData }) {
  const [data, setData] = useState(initialData)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── Tab 1: Jadwal Langsung di Tabel (Direct In-Table Schedule Editor) ──
  const [scheduleDate, setScheduleDate] = useState(initialData.tomorrow)
  const [slots, setSlots] = useState<PbSlot[]>(() => {
    const latest = initialData.versions.at(-1)?.slots
    if (latest && latest.length > 0) return latest
    return DEFAULT_PB_SLOTS
  })

  // ── Tab 2: Libur Modal States ──
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false)
  const [holidayForm, setHolidayForm] = useState({
    start_date: initialData.tomorrow,
    end_date: initialData.tomorrow,
    reason: '',
  })
  const [cancellingHoliday, setCancellingHoliday] = useState<PbHoliday | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // ── Tab 3: Pekerjaan Modal States ──
  const [jobs, setJobs] = useState(initialData.jobs)
  const [isJobModalOpen, setIsJobModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<{
    id: string
    name: string
    sort_order: number
    active: number
  }>({ id: '', name: '', sort_order: 1, active: 1 })

  // ── Tab 4: Template States ──
  const [templates, setTemplates] = useState(initialData.templates)

  async function handleSave(payload: Parameters<typeof savePramubaktiSettings>[0]) {
    setBusy(true)
    setMessage(null)
    try {
      const result = await savePramubaktiSettings(payload)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: result.success || 'Pengaturan berhasil disimpan.' })
        const fresh = await getPramubaktiSettings()
        setData(fresh)
        setJobs(fresh.jobs)
        setTemplates(fresh.templates)
        if (payload.type === 'schedule') {
          const updatedSlots = fresh.versions.at(-1)?.slots
          if (updatedSlots && updatedSlots.length > 0) {
            setSlots(updatedSlots)
          }
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Gagal menyimpan pengaturan. Silakan coba lagi.' })
    } finally {
      setBusy(false)
    }
  }

  // ── Helper Slot Jadwal Langsung ──
  const updateSlotTime = (slotId: string, field: 'start' | 'end', val: string) => {
    setSlots(old => old.map(s => (s.id === slotId ? { ...s, [field]: val } : s)))
  }

  const addSlotToDay = (weekday: number) => {
    const daySlots = slots.filter(s => s.weekday === weekday)
    const lastSlot = daySlots.at(-1)
    const start = lastSlot ? lastSlot.end : '07:00'
    const end =
      start < '22:00'
        ? `${String(Math.min(23, Number(start.slice(0, 2)) + 1)).padStart(2, '0')}:${start.slice(3, 5)}`
        : '23:00'

    setSlots(old => [...old, { id: crypto.randomUUID(), weekday, start, end }])
  }

  const removeSlot = (slotId: string) => {
    setSlots(old => old.filter(s => s.id !== slotId))
  }

  const resetToDefaultSlots = () => {
    setSlots(getDefaultPbSlots())
    setMessage({
      type: 'success',
      text: 'Slot jadwal berhasil di-reset ke default (Senin–Sabtu: 06:45–08:00, 08:00–10:00, 10:00–12:00, 12:00–15:00). Klik "Simpan Versi Jadwal" untuk menerapkan.',
    })
  }

  const copyMondayToAllWorkdays = () => {
    const mondaySlots = slots.filter(s => s.weekday === 1)
    if (mondaySlots.length === 0) {
      setMessage({ type: 'error', text: 'Hari Senin belum memiliki slot untuk disalin.' })
      return
    }

    const newSlots: PbSlot[] = [...mondaySlots]
    for (let weekday = 2; weekday <= 6; weekday++) {
      mondaySlots.forEach(s => {
        newSlots.push({
          id: crypto.randomUUID(),
          weekday,
          start: s.start,
          end: s.end,
        })
      })
    }
    // Pertahankan slot hari Minggu jika ada
    const sundaySlots = slots.filter(s => s.weekday === 7)
    setSlots([...newSlots, ...sundaySlots])
    setMessage({
      type: 'success',
      text: 'Slot hari Senin berhasil disalin ke hari Selasa s/d Sabtu. Klik "Simpan Versi Jadwal" untuk menerapkan.',
    })
  }

  const saveCurrentSchedule = async () => {
    await handleSave({
      type: 'schedule',
      effective_date: scheduleDate,
      slots,
    })
  }

  // ── Helper Modal Pekerjaan ──
  const openJobModal = (job?: PbJob) => {
    if (job) {
      setEditingJob({ ...job })
    } else {
      setEditingJob({
        id: '',
        name: '',
        sort_order: (jobs.at(-1)?.sort_order || jobs.length) + 1,
        active: 1,
      })
    }
    setIsJobModalOpen(true)
  }

  const latestVersion = data.versions.at(-1)

  return (
    <div className="space-y-4">
      {/* Banner informasi kaitan dengan Pengaturan Global */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border border-indigo-200 bg-indigo-50/70 dark:border-indigo-900 dark:bg-indigo-950/20 px-4 py-3 text-xs text-indigo-900 dark:text-indigo-200">
        <p>
          Batas jam pembatasan waktu dan toleransi keterlambatan pramubakti terintegrasi dengan pengaturan madrasah.
        </p>
        <Button asChild variant="outline" size="sm" className="h-7 text-[11px] bg-white dark:bg-slate-900 shrink-0">
          <Link href="/dashboard/settings">
            <ExternalLink className="h-3 w-3 mr-1 text-indigo-600" />
            Pengaturan Perilaku Input
          </Link>
        </Button>
      </div>

      {/* Alert pesan */}
      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-center gap-2.5 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* TABS UTAMA (Easy to Scan) */}
      <Tabs defaultValue="jadwal" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-2xl h-auto p-1">
          <TabsTrigger value="jadwal" className="text-xs sm:text-sm py-2">
            <Clock className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Jadwal Bersama
          </TabsTrigger>
          <TabsTrigger value="libur" className="text-xs sm:text-sm py-2">
            <CalendarOff className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Libur Kerja
          </TabsTrigger>
          <TabsTrigger value="pekerjaan" className="text-xs sm:text-sm py-2">
            <CheckSquare className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Pilihan Pekerjaan
          </TabsTrigger>
          <TabsTrigger value="template" className="text-xs sm:text-sm py-2">
            <FileText className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Template CKH
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB 1: JADWAL BERSAMA (DIRECT IN-TABLE EDITOR) */}
        {/* ══════════════════════════════════════════════════════════ */}
        <TabsContent value="jadwal" className="space-y-4 mt-2">
          {/* Top Control Toolbar */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 rounded-lg border bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Clock className="h-5 w-5 text-emerald-600" />
                Pengaturan Slot Kerja Pramubakti
              </h3>
              <p className="text-xs text-slate-500">
                Atur slot kerja per hari langsung pada tabel di bawah tanpa modal dialog.
                {latestVersion && (
                  <span className="ml-1 text-emerald-700 dark:text-emerald-400 font-medium">
                    (Versi aktif: {latestVersion.effective_date} &middot; {latestVersion.slots.length} slot)
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold whitespace-nowrap text-slate-700 dark:text-slate-300">
                  Mulai Berlaku:
                </Label>
                <Input
                  type="date"
                  min={data.tomorrow}
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  className="h-9 w-36 text-xs font-medium"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetToDefaultSlots}
                disabled={busy}
                className="h-9 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                title="Kembalikan ke 4 slot default untuk Senin–Sabtu"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1 text-slate-500" />
                Reset Default
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyMondayToAllWorkdays}
                disabled={busy}
                className="h-9 text-xs font-medium text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50"
                title="Salin slot hari Senin ke hari Selasa s/d Sabtu"
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Salin Senin ke Sel–Sab
              </Button>

              <Button
                disabled={busy}
                onClick={saveCurrentSchedule}
                className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition-colors"
              >
                {busy ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                Simpan Jadwal Baru
              </Button>
            </div>
          </div>

          {/* Grid Tabel Per Hari (Senin s/d Minggu) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {PB_DAYS.slice(1).map((hari, dayIdx) => {
              const weekday = dayIdx + 1
              const daySlots = slots.filter(s => s.weekday === weekday)

              return (
                <div
                  key={hari}
                  className="rounded-lg border bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col justify-between"
                >
                  {/* Card Header Hari */}
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 dark:bg-slate-800/60 border-b">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                        {hari}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          daySlots.length > 0
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {daySlots.length} Slot
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addSlotToDay(weekday)}
                      className="h-7 px-2 text-[11px] font-medium"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Tambah Slot
                    </Button>
                  </div>

                  {/* Tabel Slot Langsung Edit */}
                  <div className="p-3 flex-1">
                    {daySlots.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 italic">
                        {weekday === 7
                          ? 'Hari libur rutin (tidak ada kewajiban slot).'
                          : 'Belum ada slot untuk hari ini.'}
                      </div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                            <th className="text-left py-1.5 w-12 font-medium">Slot</th>
                            <th className="text-left py-1.5 font-medium">Jam Mulai</th>
                            <th className="text-left py-1.5 font-medium">Jam Selesai</th>
                            <th className="text-right py-1.5 w-8 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {daySlots.map((slot, index) => (
                            <tr key={slot.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                              <td className="py-2 text-slate-500 font-medium">#{index + 1}</td>
                              <td className="py-2 pr-1.5">
                                <Input
                                  type="time"
                                  value={slot.start}
                                  onChange={e => updateSlotTime(slot.id, 'start', e.target.value)}
                                  className="h-8 text-xs w-24 font-mono font-medium"
                                />
                              </td>
                              <td className="py-2 pr-1.5">
                                <Input
                                  type="time"
                                  value={slot.end}
                                  onChange={e => updateSlotTime(slot.id, 'end', e.target.value)}
                                  className="h-8 text-xs w-24 font-mono font-medium"
                                />
                              </td>
                              <td className="py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeSlot(slot.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                  title="Hapus slot ini"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bottom Summary Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border bg-white dark:bg-slate-900 shadow-sm">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Total {slots.length} slot kerja aktif
              </span>{' '}
              akan diberlakukan mulai tanggal <strong>{scheduleDate}</strong>.
            </div>
            <Button
              disabled={busy}
              onClick={saveCurrentSchedule}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition-colors"
            >
              {busy ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
              Simpan Versi Jadwal ({scheduleDate})
            </Button>
          </div>

          {/* Riwayat Versi Jadwal */}
          <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-slate-50/70 dark:bg-slate-800/50">
              <h4 className="font-semibold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                Riwayat Versi Jadwal ({data.versions.length} Versi)
              </h4>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.versions
                .slice()
                .reverse()
                .map(v => (
                  <div
                    key={v.id}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                        Mulai Berlaku: {v.effective_date}
                      </p>
                      <p className="text-slate-500 mt-1">
                        {v.slots.length > 0
                          ? v.slots.map(s => `${PB_DAYS[s.weekday]} ${s.start}–${s.end}`).join(' · ')
                          : 'Tanpa kewajiban (semua slot dinonaktifkan)'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSlots(v.slots)
                        setScheduleDate(data.tomorrow)
                        setMessage({
                          type: 'success',
                          text: `Slot dari versi ${v.effective_date} telah disalin ke formulir tabel di atas. Klik "Simpan Versi Jadwal" untuk menerapkan.`,
                        })
                      }}
                      className="h-8 text-xs shrink-0 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Salin ke Formulir Tabel
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB 2: LIBUR KERJA */}
        {/* ══════════════════════════════════════════════════════════ */}
        <TabsContent value="libur" className="space-y-4 mt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div>
              <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <CalendarOff className="h-4 w-4 text-rose-600" />
                Daftar Libur Kerja Pramubakti
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Libur khusus pramubakti yang berdiri sendiri (terpisah dari kalender pendidikan KBM).
              </p>
            </div>
            <Button
              onClick={() => {
                setHolidayForm({
                  start_date: data.tomorrow,
                  end_date: data.tomorrow,
                  reason: '',
                })
                setIsHolidayModalOpen(true)
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition-colors"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Tambah Libur Kerja
            </Button>
          </div>

          <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Rentang Tanggal</TableHead>
                  <TableHead className="font-semibold">Alasan / Keterangan Libur</TableHead>
                  <TableHead className="font-semibold text-center">Status</TableHead>
                  <TableHead className="font-semibold text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.holidays.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-xs text-slate-400">
                      Belum ada jadwal libur kerja pramubakti.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.holidays.map(h => {
                    const isUpcoming = h.start_date >= data.tomorrow
                    return (
                      <TableRow key={h.id} className="text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <TableCell className="font-medium whitespace-nowrap text-slate-800 dark:text-slate-200">
                          {h.start_date} s/d {h.end_date}
                        </TableCell>
                        <TableCell className="text-slate-700 dark:text-slate-300">
                          {h.reason}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                              isUpcoming
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {isUpcoming ? 'Mendatang' : 'Sudah Berlalu'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {isUpcoming ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCancellingHoliday(h)
                                setCancelReason('')
                              }}
                              className="h-7 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Batalkan
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Arsip</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB 3: PILIHAN PEKERJAAN */}
        {/* ══════════════════════════════════════════════════════════ */}
        <TabsContent value="pekerjaan" className="space-y-4 mt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div>
              <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-emerald-600" />
                Daftar Pilihan Pekerjaan
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar aktivitas pekerjaan yang dapat dipilih saat pramubakti mengisi laporan harian.
              </p>
            </div>
            <Button
              onClick={() => openJobModal()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition-colors"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Tambah Pekerjaan
            </Button>
          </div>

          <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20 font-semibold text-center">Urutan</TableHead>
                  <TableHead className="font-semibold">Nama Pekerjaan</TableHead>
                  <TableHead className="font-semibold text-center">Status</TableHead>
                  <TableHead className="font-semibold text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map(job => (
                  <TableRow key={job.id} className="text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <TableCell className="text-center font-semibold text-slate-600 dark:text-slate-400">
                      {job.sort_order}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800 dark:text-slate-200">
                      {job.name}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                          job.active === 1
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {job.active === 1 ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openJobModal(job)}
                        className="h-7 text-xs"
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1 text-slate-600" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB 4: TEMPLATE CKH */}
        {/* ══════════════════════════════════════════════════════════ */}
        <TabsContent value="template" className="space-y-4 mt-2">
          <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-sm space-y-5">
            <div>
              <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                Template Capaian Kinerja Harian (CKH)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Format teks otomatis yang digunakan saat men-generate laporan CKH pramubakti dari laporan harian yang sudah diverifikasi.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Template Kegiatan Bulanan *</Label>
                <Textarea
                  rows={2}
                  maxLength={2000}
                  value={templates.monthly}
                  onChange={e => setTemplates(old => ({ ...old, monthly: e.target.value }))}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Template Catatan Kinerja Harian *</Label>
                <Textarea
                  rows={3}
                  maxLength={2000}
                  value={templates.daily}
                  onChange={e => setTemplates(old => ({ ...old, daily: e.target.value }))}
                  className="text-sm"
                />
                <p className="text-[11px] text-slate-500">
                  Wajib memuat placeholder <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-emerald-700 dark:text-emerald-400 font-mono">{'{pekerjaan}'}</code> dan <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-emerald-700 dark:text-emerald-400 font-mono">{'{tempat}'}</code>.
                </p>
              </div>
            </div>

            {/* Live Preview Box */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Pratinjau Hasil Render CKH:
              </p>
              <div className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                <p>
                  <strong>Kegiatan Bulanan:</strong>{' '}
                  {templates.monthly}
                </p>
                <p>
                  <strong>Catatan Harian:</strong>{' '}
                  {templates.daily
                    .replaceAll('{pekerjaan}', 'Membersihkan dan Membuang Sampah')
                    .replaceAll('{tempat}', 'Halaman depan madrasah')}
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                disabled={busy || !templates.monthly.trim() || !templates.daily.trim()}
                onClick={() => handleSave({ type: 'templates', ...templates })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition-colors"
              >
                {busy ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                Simpan Template CKH
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL 1: TAMBAH LIBUR KERJA */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Dialog open={isHolidayModalOpen} onOpenChange={open => !open && setIsHolidayModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarOff className="h-4 w-4 text-rose-600" />
              Tambah Libur Kerja Pramubakti
            </DialogTitle>
            <DialogDescription className="text-xs">
              Libur baru berlaku paling cepat mulai besok.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Dari Tanggal *</Label>
                <Input
                  type="date"
                  min={data.tomorrow}
                  value={holidayForm.start_date}
                  onChange={e => setHolidayForm(old => ({ ...old, start_date: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sampai Tanggal *</Label>
                <Input
                  type="date"
                  min={data.tomorrow}
                  value={holidayForm.end_date}
                  onChange={e => setHolidayForm(old => ({ ...old, end_date: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Alasan Libur *</Label>
              <Input
                maxLength={500}
                placeholder="Contoh: Hari Raya Idul Fitri, Cuti Bersama..."
                value={holidayForm.reason}
                onChange={e => setHolidayForm(old => ({ ...old, reason: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsHolidayModalOpen(false)}>
              Batal
            </Button>
            <Button
              size="sm"
              disabled={busy || !holidayForm.reason.trim()}
              onClick={async () => {
                await handleSave({ type: 'holiday', ...holidayForm })
                setIsHolidayModalOpen(false)
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {busy ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Simpan Libur Kerja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL 2: BATALKAN LIBUR KERJA (Ganti window.prompt) */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Dialog open={!!cancellingHoliday} onOpenChange={open => !open && setCancellingHoliday(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-rose-700 flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Batalkan Libur Kerja
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan alasan pembatalan libur untuk disimpan ke jejak audit sistem.
            </DialogDescription>
          </DialogHeader>

          {cancellingHoliday && (
            <div className="space-y-3 py-2">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs space-y-1">
                <p>
                  <strong>Periode:</strong> {cancellingHoliday.start_date} s/d {cancellingHoliday.end_date}
                </p>
                <p>
                  <strong>Alasan Awal:</strong> {cancellingHoliday.reason}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Alasan Pembatalan (Wajib) *</Label>
                <Input
                  maxLength={500}
                  placeholder="Contoh: Perubahan agenda kerja, penyesuaian jadwal dinas..."
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setCancellingHoliday(null)}>
              Kembali
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy || !cancelReason.trim()}
              onClick={async () => {
                if (!cancellingHoliday) return
                await handleSave({
                  type: 'removeHoliday',
                  id: cancellingHoliday.id,
                  reason: cancelReason.trim(),
                })
                setCancellingHoliday(null)
              }}
            >
              {busy ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Konfirmasi Batalkan Libur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL 3: TAMBAH / EDIT PEKERJAAN */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Dialog open={isJobModalOpen} onOpenChange={open => !open && setIsJobModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-emerald-600" />
              {editingJob.id ? 'Edit Pekerjaan' : 'Tambah Pekerjaan Baru'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Perubahan nama pekerjaan tidak mempengaruhi laporan lama yang sudah terkirim.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nama Aktivitas Pekerjaan *</Label>
              <Input
                maxLength={100}
                placeholder="Contoh: Membersihkan Kamar Mandi Siswa..."
                value={editingJob.name}
                onChange={e => setEditingJob(old => ({ ...old, name: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nomor Urutan Tampilan *</Label>
              <Input
                type="number"
                value={editingJob.sort_order}
                onChange={e => setEditingJob(old => ({ ...old, sort_order: Number(e.target.value) }))}
                className="h-9 text-sm max-w-xs"
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="job-active"
                checked={editingJob.active === 1}
                onCheckedChange={v => setEditingJob(old => ({ ...old, active: v ? 1 : 0 }))}
              />
              <label
                htmlFor="job-active"
                className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Pekerjaan Aktif (dapat dipilih di formulir laporan)
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsJobModalOpen(false)}>
              Batal
            </Button>
            <Button
              size="sm"
              disabled={busy || !editingJob.name.trim()}
              onClick={async () => {
                await handleSave({ type: 'job', job: editingJob })
                setIsJobModalOpen(false)
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {busy ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Simpan Pekerjaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
