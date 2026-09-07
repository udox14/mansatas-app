'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Clock, CalendarOff, CheckSquare, FileText, Plus, Edit3, Trash2,
  AlertTriangle, CheckCircle2, Copy, ExternalLink, RefreshCw, Sparkles, Check
} from 'lucide-react'
import { PB_DAYS, type PbSlot, type PbJob, type PbHoliday } from '@/lib/pramubakti'
import { getPramubaktiSettings, savePramubaktiSettings } from './actions'

type SettingsData = Awaited<ReturnType<typeof getPramubaktiSettings>>

export function PramubaktiSettingsClient({ initialData }: { initialData: SettingsData }) {
  const [data, setData] = useState(initialData)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── Tab 1: Jadwal Modal States ──
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [scheduleDate, setScheduleDate] = useState(initialData.tomorrow)
  const [slots, setSlots] = useState<PbSlot[]>(initialData.versions.at(-1)?.slots || [])

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
      }
    } catch {
      setMessage({ type: 'error', text: 'Gagal menyimpan pengaturan. Silakan coba lagi.' })
    } finally {
      setBusy(false)
    }
  }

  // Helper untuk membuka modal jadwal baru
  const openScheduleModal = (presetSlots?: PbSlot[]) => {
    if (presetSlots) {
      setSlots(presetSlots)
    } else {
      setSlots(data.versions.at(-1)?.slots || [])
    }
    setScheduleDate(data.tomorrow)
    setIsScheduleModalOpen(true)
  }

  // Helper untuk menambah baris slot baru di modal
  const addSlotRow = () => {
    setSlots(old => [
      ...old,
      { id: crypto.randomUUID(), weekday: 1, start: '07:00', end: '08:00' },
    ])
  }

  // Helper untuk menghapus baris slot
  const removeSlotRow = (index: number) => {
    setSlots(old => old.filter((_, i) => i !== index))
  }

  // Helper untuk membuka modal pekerjaan
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
        {/* TAB 1: JADWAL BERSAMA (SLOTS) */}
        {/* ══════════════════════════════════════════════════════════ */}
        <TabsContent value="jadwal" className="space-y-4 mt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-white dark:bg-slate-900 p-4 shadow-sm">
            <div>
              <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                Versi Jadwal Aktif
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {latestVersion
                  ? `Mulai berlaku sejak ${latestVersion.effective_date} (${latestVersion.slots.length} slot per minggu)`
                  : 'Belum ada jadwal yang dikonfigurasi.'}
              </p>
            </div>
            <Button
              onClick={() => openScheduleModal()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition-colors"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Perbarui Versi Jadwal
            </Button>
          </div>

          {/* Grid Slot Aktif Berdasarkan Hari */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {PB_DAYS.slice(1).map((hari, dayIdx) => {
              const daySlots = (latestVersion?.slots || []).filter(s => s.weekday === dayIdx + 1)
              return (
                <div
                  key={hari}
                  className="rounded-lg border bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      {hari}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {daySlots.length} slot
                    </span>
                  </div>

                  {daySlots.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">Tidak ada kewajiban slot</p>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      {daySlots.map(s => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-emerald-600" />
                            {s.start} – {s.end} WIB
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
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
                      onClick={() => openScheduleModal(v.slots)}
                      className="h-8 text-xs shrink-0 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Salin Slot ke Versi Baru
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
      {/* MODAL 1: ATUR / PERBARUI VERSI JADWAL */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Dialog open={isScheduleModalOpen} onOpenChange={open => !open && setIsScheduleModalOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              Perbarui Versi Jadwal Bersama
            </DialogTitle>
            <DialogDescription className="text-xs">
              Jadwal baru berlaku paling cepat mulai besok. Mengosongkan semua slot menghentikan kewajiban sejak tanggal berlaku.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 overflow-y-auto pr-1 flex-1">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tanggal Mulai Berlaku *</Label>
              <Input
                type="date"
                min={data.tomorrow}
                value={scheduleDate}
                onChange={e => setScheduleDate(e.target.value)}
                className="h-9 text-sm max-w-xs"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Daftar Slot Wajib ({slots.length} slot)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSlotRow}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Tambah Slot
                </Button>
              </div>

              {slots.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed text-center text-xs text-slate-500">
                  Tidak ada slot. Versi ini akan menonaktifkan seluruh kewajiban mulai tanggal berlaku.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto p-1">
                  {slots.map((slot, index) => (
                    <div
                      key={slot.id || index}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-slate-50/60 dark:bg-slate-800/40 text-xs"
                    >
                      <div className="w-28 shrink-0">
                        <Select
                          value={String(slot.weekday)}
                          onValueChange={v =>
                            setSlots(old =>
                              old.map((s, i) => (i === index ? { ...s, weekday: Number(v) } : s))
                            )
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PB_DAYS.slice(1).map((day, i) => (
                              <SelectItem key={day} value={String(i + 1)}>
                                {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-1.5 flex-1">
                        <Input
                          type="time"
                          value={slot.start}
                          onChange={e =>
                            setSlots(old =>
                              old.map((s, i) => (i === index ? { ...s, start: e.target.value } : s))
                            )
                          }
                          className="h-8 text-xs"
                        />
                        <span>s/d</span>
                        <Input
                          type="time"
                          value={slot.end}
                          onChange={e =>
                            setSlots(old =>
                              old.map((s, i) => (i === index ? { ...s, end: e.target.value } : s))
                            )
                          }
                          className="h-8 text-xs"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSlotRow(index)}
                        className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setIsScheduleModalOpen(false)}>
              Batal
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                await handleSave({
                  type: 'schedule',
                  effective_date: scheduleDate,
                  slots,
                })
                setIsScheduleModalOpen(false)
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {busy ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Simpan Versi Jadwal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* MODAL 2: TAMBAH LIBUR KERJA */}
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
      {/* MODAL 3: BATALKAN LIBUR KERJA (Ganti window.prompt) */}
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
      {/* MODAL 4: TAMBAH / EDIT PEKERJAAN */}
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
