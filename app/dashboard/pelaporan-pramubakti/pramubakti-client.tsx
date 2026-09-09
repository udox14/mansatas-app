/* eslint-disable @next/next/no-img-element -- Camera previews use temporary blob URLs. */
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { CameraCapture } from '@/components/shared/camera-capture'
import { compressAgendaImage } from '@/app/dashboard/agenda/components/image-compression'
import {
  Camera, CheckCircle2, Clock, Plus, RefreshCw, ClipboardPen,
  BookOpen, Send, AlertTriangle, Check, ExternalLink, Sparkles, X,
  Calendar, Maximize2
} from 'lucide-react'
import { getPramubaktiReports, submitPramubaktiReport } from './actions'
import { PbStatus } from '@/components/pramubakti/report-details'
import { todayWIB, currentTimeWIB } from '@/lib/time'
import { minutes, getWeekRangePb, type PbItem } from '@/lib/pramubakti'

export function PramubaktiClient({
  initialData,
  isActingAs = false,
  actAsDate = null,
}: {
  initialData: Awaited<ReturnType<typeof getPramubaktiReports>>
  isActingAs?: boolean
  actAsDate?: string | null
}) {
  const [data, setData] = useState(initialData)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [isExtraModalOpen, setIsExtraModalOpen] = useState(false)

  // Form State
  const [jobs, setJobs] = useState<string[]>([])
  const [tempat, setTempat] = useState('')
  const [camera, setCamera] = useState(false)
  const [foto, setFoto] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [requestId, setRequestId] = useState('')

  // Riwayat State (Default Mingguan s/d Hari Ini)
  const defaultWeek = getWeekRangePb(data.today)
  const defaultEndWeekly = defaultWeek.end > data.today ? data.today : defaultWeek.end
  const [start, setStart] = useState((data as any).defaultStart || defaultWeek.start)
  const [end, setEnd] = useState((data as any).defaultEnd || defaultEndWeekly)
  const [history, setHistory] = useState(data.items)
  const [clock, setClock] = useState(() => currentTimeWIB().hhmm)
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null)

  // Sync state ketika server re-render karena Act As berganti user atau tanggal
  useEffect(() => {
    setData(initialData)
    setHistory(initialData.items)
    const dw = getWeekRangePb(initialData.today)
    const de = dw.end > initialData.today ? initialData.today : dw.end
    setStart((initialData as any).defaultStart || dw.start)
    setEnd((initialData as any).defaultEnd || de)
  }, [initialData])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(currentTimeWIB().hhmm), 15000)
    return () => window.clearInterval(timer)
  }, [])

  function canFill(item: PbItem) {
    if (isActingAs) return true
    return (
      data.today === todayWIB() &&
      (!data.rules.restricted ||
        !item.slot ||
        (minutes(clock) >= minutes(item.slot.start) - 5 && minutes(clock) <= minutes(item.slot.end)))
    )
  }

  useEffect(() => {
    if (!foto) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(foto)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [foto])

  const slots = data.items.filter(i => i.tanggal === data.today && i.slot && i.status !== 'TAMBAHAN')
  const completed = slots.filter(i => i.report || i.leave).length

  const groupedHistory = useMemo(() => {
    const map = new Map<string, PbItem[]>()
    // Hanya tampilkan hari berjalan dan hari yang sudah dilewati (tanggal <= data.today)
    const validHistory = history.filter(i => i.tanggal <= data.today)
    const sorted = [...validHistory].sort((a, b) => {
      if (a.tanggal !== b.tanggal) return b.tanggal.localeCompare(a.tanggal)
      const timeA = a.slot?.start || a.report?.waktu_input?.slice(11, 16) || '99:99'
      const timeB = b.slot?.start || b.report?.waktu_input?.slice(11, 16) || '99:99'
      return timeA.localeCompare(timeB)
    })

    for (const item of sorted) {
      if (!map.has(item.tanggal)) {
        map.set(item.tanggal, [])
      }
      map.get(item.tanggal)!.push(item)
    }

    return Array.from(map.entries()).map(([tanggal, items]) => ({
      tanggal,
      items,
    }))
  }, [history, data.today])

  const fetchRiwayat = async (startDate: string, endDate: string) => {
    const cappedEnd = endDate > data.today ? data.today : endDate
    const cappedStart = startDate > data.today ? data.today : startDate
    setBusy(true)
    try {
      const res = await getPramubaktiReports(cappedStart, cappedEnd, (data as any).targetUserId, actAsDate ?? undefined)
      setHistory(res.items)
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Gagal memuat riwayat.',
      })
    } finally {
      setBusy(false)
    }
  }

  const applyWeekPreset = () => {
    const w = getWeekRangePb(data.today)
    const cappedEnd = w.end > data.today ? data.today : w.end
    setStart(w.start)
    setEnd(cappedEnd)
    fetchRiwayat(w.start, cappedEnd)
  }

  const applyMonthPreset = () => {
    const today = data.today
    const startOfMonth = today.slice(0, 8) + '01'
    const parts = today.split('-').map(Number)
    const lastDay = new Date(parts[0], parts[1], 0).getDate()
    const rawEnd = `${today.slice(0, 8)}${String(lastDay).padStart(2, '0')}`
    const cappedEnd = rawEnd > today ? today : rawEnd
    setStart(startOfMonth)
    setEnd(cappedEnd)
    fetchRiwayat(startOfMonth, cappedEnd)
  }

  const openFillSlot = (slotId: string) => {
    if (selectedSlotId === slotId) {
      setSelectedSlotId(null)
      return
    }
    setSelectedSlotId(slotId)
    setJobs([])
    setTempat('')
    setFoto(null)
    setCamera(false)
    setMessage(null)
    setRequestId(crypto.randomUUID())
  }

  const openExtraModal = () => {
    setIsExtraModalOpen(true)
    setJobs([])
    setTempat('')
    setFoto(null)
    setCamera(false)
    setMessage(null)
    setRequestId(crypto.randomUUID())
  }

  async function refresh() {
    setBusy(true)
    try {
      const fresh = await getPramubaktiReports(undefined, undefined, (data as any).targetUserId, actAsDate ?? undefined)
      setData(fresh)
      setHistory(fresh.items)
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Gagal memuat data.' })
    } finally {
      setBusy(false)
    }
  }

  async function capture(file: File, targetSlotId: string | null) {
    if (!jobs.length || !tempat.trim()) {
      setCamera(false)
      setMessage({ type: 'error', text: 'Pilih pekerjaan dan isi tempat sebelum mengambil foto.' })
      return
    }

    setCamera(false)
    setBusy(true)
    try {
      const nowFormatted = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }) + ` ${currentTimeWIB().hhmm} WIB`
      const watermarkText = `MAN 1 KOTA TASIKMALAYA · ${nowFormatted}`
      const compressed = await compressAgendaImage(file, { watermarkText })
      setFoto(compressed)
      await submit(targetSlotId, compressed)
    } catch {
      setMessage({ type: 'error', text: 'Foto gagal diproses. Silakan ambil ulang foto.' })
      setFoto(null)
    } finally {
      setBusy(false)
    }
  }

  async function submit(targetSlotId: string | null, capturedFoto: File | null = foto) {
    if (!capturedFoto || !jobs.length || !tempat.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const form = new FormData()
      form.set('tanggal', data.today)
      form.set('request_id', requestId)
      form.set('slot_id', targetSlotId || '')
      form.set('tempat', tempat.trim())
      form.set('foto', capturedFoto)
      jobs.forEach(job => form.append('jobs', job))

      const result = await submitPramubaktiReport(form)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: result.success || 'Laporan berhasil dikirim!' })
        setSelectedSlotId(null)
        setIsExtraModalOpen(false)
        setFoto(null)
        setJobs([])
        setTempat('')
        const fresh = await getPramubaktiReports(undefined, undefined, (data as any).targetUserId, actAsDate ?? undefined)
        setData(fresh)
        setHistory(fresh.items)
      }
    } catch {
      setMessage({
        type: 'error',
        text: 'Koneksi terputus. Silakan coba kirim ulang. Laporan yang tersimpan tidak akan digandakan.',
      })
    } finally {
      setBusy(false)
    }
  }

  const toggleJob = (id: string) => {
    setJobs(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const todayDateFormatted = new Date(data.today + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-4">
      {/* HEADER TOOLBAR (Identik dengan Agenda Guru) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-white dark:bg-slate-900 px-4 py-3 shadow-sm">
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{todayDateFormatted}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {completed} dari {slots.length} slot wajib hari ini terselesaikan &middot; Jam sistem: {clock} WIB
          </p>
          {slots.length > 0 && (
            <div className="mt-2 w-full max-w-xs space-y-1">
              <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <span>Progres Hari Ini</span>
                <span className={completed === slots.length ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                  {Math.round((completed / slots.length) * 100)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    completed === slots.length ? 'bg-emerald-500' : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.round((completed / slots.length) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={busy}
            className="h-8 text-xs font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${busy ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={openExtraModal}
            disabled={busy}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Tambahan
          </Button>
        </div>
      </div>

      {/* ALERT PESAN (Identik dengan Agenda Guru) */}
      {message && (
        <div
          className={`rounded-lg border px-4 py-3 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
          }`}
        >
          <div className="flex items-center gap-3">
            {message.type === 'success' ? (
              <CheckCircle2 className="h-6 w-6 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            <div>
              {message.type === 'success' && (
                <p className="font-semibold text-sm">Laporan Berhasil Terkirim</p>
              )}
              <p className="text-xs sm:text-sm">{message.text}</p>
            </div>
          </div>
        </div>
      )}

      {/* TABS (Mengikuti struktur Agenda Guru: Mengajar/Hari Ini vs Riwayat) */}
      <Tabs defaultValue="hari-ini" className="space-y-3">
        <TabsList className="grid w-full grid-cols-2 max-w-sm h-auto p-1">
          <TabsTrigger value="hari-ini" className="text-xs sm:text-sm py-2">
            <ClipboardPen className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Hari Ini
          </TabsTrigger>
          <TabsTrigger value="riwayat" className="text-xs sm:text-sm py-2">
            <BookOpen className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Riwayat
          </TabsTrigger>
        </TabsList>

        {/* TAB CONTENT: HARI INI */}
        <TabsContent value="hari-ini" className="space-y-3 mt-3">
          {isActingAs ? (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-300">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Mode <strong>Act As</strong> aktif. Batasan jam kerja slot di-bypass untuk pengisian atas nama staf terpilih.
              </span>
            </div>
          ) : slots.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-300">
              <Clock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Form pengisian laporan dibuka mulai 5 menit sebelum jam kerja slot hingga jam selesai.
              </span>
            </div>
          )}

          {slots.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-10 text-center">
              <BookOpen className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Tidak ada kewajiban slot kerja hari ini.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Laporan pekerjaan di luar jadwal dapat dicatat melalui tombol <strong>Tambahan</strong>.
              </p>
            </div>
          ) : (
            slots.map((item, index) => {
              const isExpanded = selectedSlotId === item.slot!.id
              const isDone = Boolean(item.report || item.leave)
              const allowedToFill = canFill(item)

              return (
                <div
                  key={item.key}
                  className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden shadow-sm transition-all"
                >
                  {/* Card Header (Identik dengan JadwalBlock Agenda Guru) */}
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                          Pekerjaan {index + 1}
                        </span>
                        <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          Wajib
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3 inline text-slate-400" />
                        {item.slot!.start} – {item.slot!.end} WIB
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isDone ? (
                        <div className="flex items-center gap-2">
                          <PbStatus item={item} />
                          {item.report?.foto_url && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hidden sm:flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" />
                              Tersimpan
                            </span>
                          )}
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busy || !allowedToFill}
                          onClick={() => openFillSlot(item.slot!.id)}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors"
                        >
                          <ClipboardPen className="h-3.5 w-3.5 mr-1" />
                          {isExpanded ? 'Tutup Form' : 'Isi Laporan'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Form (Identik dengan form input Agenda Guru) */}
                  {isExpanded && !isDone && (
                    <div className="border-t bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
                      {isActingAs && (
                        <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                          Mode Act As: Laporan dicatat atas nama staf yang dipilih dan berstatus Selesai.
                        </div>
                      )}

                      {/* Step 1: Pilihan Pekerjaan */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          1. Pilih Jenis Pekerjaan yang Dilakukan *
                        </Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {data.jobs
                            .filter(j => j.active === 1)
                            .map(job => {
                              const isChecked = jobs.includes(job.id)
                              return (
                                <button
                                  type="button"
                                  key={job.id}
                                  onClick={() => toggleJob(job.id)}
                                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left text-xs font-medium transition-all ${
                                    isChecked
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 shadow-sm'
                                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <div
                                    className={`h-4 w-4 rounded flex items-center justify-center border shrink-0 ${
                                      isChecked
                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                                    }`}
                                  >
                                    {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                  </div>
                                  <span className="truncate">{job.name}</span>
                                </button>
                              )
                            })}
                        </div>
                      </div>

                      {/* Step 2: Tempat Pekerjaan */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          2. Tempat / Lokasi Melakukan Pekerjaan *
                        </Label>
                        <Input
                          value={tempat}
                          maxLength={300}
                          onChange={e => setTempat(e.target.value)}
                          placeholder="Contoh: Halaman depan madrasah, ruang guru, koridor kelas X..."
                          className="h-9 text-sm"
                        />
                        {data.recentPlaces && data.recentPlaces.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <p className="text-[11px] text-slate-400">Pilihan cepat dari riwayat Anda:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {data.recentPlaces.map(p => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => setTempat(p)}
                                  className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                                    tempat === p
                                      ? 'bg-emerald-100 dark:bg-emerald-950 border-emerald-400 text-emerald-800 dark:text-emerald-200 font-semibold shadow-xs'
                                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                                  }`}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Step 3: Bukti Foto Kamera */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          3. Foto Bukti Pekerjaan (Wajib Kamera) *
                        </Label>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Setelah foto diambil, laporan langsung dikirim otomatis.
                        </p>

                        {camera ? (
                          <CameraCapture onCapture={file => capture(file, item.slot!.id)} onClose={() => setCamera(false)} />
                        ) : preview ? (
                          <div className="relative">
                            <img
                              src={preview}
                              alt="Pratinjau Foto"
                              className="w-full max-h-64 object-cover rounded-lg border"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setFoto(null)
                                setPreview('')
                              }}
                              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                              title="Hapus foto"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            {foto && <p className="mt-1 text-xs text-slate-400">{(foto.size / 1024).toFixed(0)} KB</p>}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCamera(true)}
                            disabled={busy || !jobs.length || !tempat.trim()}
                            className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-300 disabled:hover:bg-white dark:disabled:hover:bg-slate-900"
                          >
                            <Camera className="h-8 w-8 text-slate-400" />
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                              {jobs.length && tempat.trim() ? 'Ketuk untuk mengambil foto dan mengirim' : 'Pilih pekerjaan dan isi tempat terlebih dahulu'}
                            </span>
                          </button>
                        )}
                      </div>

                      {busy && (
                        <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                          <RefreshCw className="h-5 w-5 animate-spin" />
                          Memproses foto dan mengirim laporan otomatis...
                        </div>
                      )}

                      {!busy && foto && message?.type === 'error' && (
                        <Button onClick={() => submit(item.slot!.id)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                          <RefreshCw className="h-4 w-4 mr-2" /> Coba Kirim Lagi
                        </Button>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setSelectedSlotId(null)
                            setFoto(null)
                            setCamera(false)
                          }}
                        >
                          Batal
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </TabsContent>

        {/* TAB CONTENT: RIWAYAT */}
        <TabsContent value="riwayat" className="space-y-4 mt-3">
          <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                  Riwayat Pekerjaan & Presensi
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Rekam jejak laporan tugas yang pernah Anda kirimkan.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="h-8 text-xs self-start sm:self-auto">
                <Link href="/dashboard/ckh-generator">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  Buka CKH Generator
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex-1 min-w-[130px]">
                <Label className="text-xs text-slate-500">Dari Tanggal</Label>
                <Input
                  type="date"
                  value={start}
                  max={todayWIB()}
                  onChange={e => setStart(e.target.value)}
                  className="h-8 text-xs sm:text-sm"
                />
              </div>
              <div className="flex-1 min-w-[130px]">
                <Label className="text-xs text-slate-500">Sampai Tanggal</Label>
                <Input
                  type="date"
                  value={end}
                  max={todayWIB()}
                  onChange={e => setEnd(e.target.value)}
                  className="h-8 text-xs sm:text-sm"
                />
              </div>
              <div className="flex items-center gap-1.5 self-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => fetchRiwayat(start, end)}
                  className="h-8 px-3 text-xs font-medium"
                >
                  {busy ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> : 'Tampilkan'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={applyWeekPreset}
                  className="h-8 px-2.5 text-xs"
                >
                  Minggu Ini
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={applyMonthPreset}
                  className="h-8 px-2.5 text-xs"
                >
                  Bulan Ini
                </Button>
              </div>
            </div>
          </div>

          {/* Grouped History by Day */}
          {groupedHistory.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-10 text-center">
              <BookOpen className="h-9 w-9 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tidak ada riwayat laporan.</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Belum ada aktivitas tercatat pada rentang tanggal ini.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedHistory.map(({ tanggal, items }) => (
                <div key={tanggal} className="space-y-2.5">
                  {/* Day Header - Sekali per tanggal */}
                  <div className="flex items-center gap-2 px-1 pt-1">
                    <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                      {new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                    <span className="text-[11px] font-medium text-slate-400">
                      {items.length} aktivitas
                    </span>
                  </div>

                  {/* List of slot/reports on that date */}
                  <div className="space-y-2">
                    {items.map(item => {
                      const slotItems = items.filter(i => i.slot)
                      const slotIdx = item.slot ? slotItems.findIndex(s => s.key === item.key) : -1
                      const isWajib = Boolean(item.slot)
                      const label = isWajib ? `Pekerjaan ${slotIdx + 1}` : 'Tambahan'

                      return (
                        <div
                          key={item.key}
                          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-sm space-y-3"
                        >
                          {/* Header row: Label + Badge + Time + Status */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                  {label}
                                </span>
                                <span
                                  className={`inline-flex items-center text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded border ${
                                    isWajib
                                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                      : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                  }`}
                                >
                                  {isWajib ? 'Wajib' : 'Tambahan'}
                                </span>
                                {item.slot && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                    ({item.slot.start} – {item.slot.end} WIB)
                                  </span>
                                )}
                              </div>

                              {item.report?.waktu_input && (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                  <Clock className="h-3 w-3 inline" />
                                  Waktu Kirim: {item.report.waktu_input.slice(11, 16)} WIB
                                </p>
                              )}
                            </div>

                            <div className="shrink-0">
                              <PbStatus item={item} />
                            </div>
                          </div>

                          {/* Report Body */}
                          {item.report && (
                            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                              {/* Photo Thumbnail */}
                              {item.report.foto_url && (
                                <div
                                  className="relative group cursor-pointer w-28 h-20 sm:w-28 sm:h-20 shrink-0 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100"
                                  onClick={() =>
                                    setPreviewPhoto({
                                      url: item.report!.foto_url,
                                      title: `${label} - ${item.report!.tempat}`,
                                    })
                                  }
                                >
                                  <img
                                    src={item.report.foto_url}
                                    alt="Bukti"
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                    <Maximize2 className="h-4 w-4" />
                                  </div>
                                </div>
                              )}

                              {/* Jobs & Place Details */}
                              <div className="flex-1 space-y-2 min-w-0">
                                {item.report.jobs && item.report.jobs.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.report.jobs.map((j, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                                      >
                                        {j}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {item.report.tempat && (
                                  <p className="text-slate-600 dark:text-slate-300 font-medium text-xs flex items-center gap-1.5">
                                    <span className="text-slate-400">Tempat:</span>
                                    {item.report.tempat}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Leave explanation */}
                          {item.leave && (
                            <div className="text-xs text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 p-2.5 rounded-md border border-sky-200 dark:border-sky-900">
                              <span className="font-semibold">{item.leave.status}: </span>
                              {item.leave.note || item.leave.reason_name || 'Tidak ada keterangan tambahan.'}
                            </div>
                          )}

                          {/* Alfa notice */}
                          {item.status === 'ALFA' && (
                            <p className="text-xs text-rose-600 dark:text-rose-400 pt-1">
                              Slot waktu kerja telah berakhir, namun laporan pekerjaan tidak diisi.
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL DIALOG: LAPORAN TAMBAHAN */}
      <Dialog open={isExtraModalOpen} onOpenChange={open => !open && setIsExtraModalOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              Laporan Pekerjaan Tambahan
            </DialogTitle>
            <DialogDescription className="text-xs">
              Laporkan aktivitas atau tugas khusus di luar slot jadwal rutin Anda hari ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            {isActingAs && (
              <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                Mode Act As: Laporan tambahan dicatat atas nama staf yang dipilih.
              </div>
            )}

            {/* 1. Pilih Pekerjaan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">1. Pilih Jenis Pekerjaan *</Label>
              <div className="grid grid-cols-2 gap-2">
                {data.jobs
                  .filter(j => j.active === 1)
                  .map(job => {
                    const isChecked = jobs.includes(job.id)
                    return (
                      <button
                        type="button"
                        key={job.id}
                        onClick={() => toggleJob(job.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs font-medium transition-all ${
                          isChecked
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className={`h-3.5 w-3.5 rounded flex items-center justify-center border shrink-0 ${
                            isChecked
                              ? 'bg-purple-600 border-purple-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                          }`}
                        >
                          {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                        </div>
                        <span className="truncate">{job.name}</span>
                      </button>
                    )
                  })}
              </div>
            </div>

            {/* 2. Lokasi */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">2. Tempat Melakukan Pekerjaan *</Label>
              <Input
                value={tempat}
                maxLength={300}
                onChange={e => setTempat(e.target.value)}
                placeholder="Contoh: Gedung perpustakaan, laboratorium, aula utama..."
                className="h-9 text-sm"
              />
              {data.recentPlaces && data.recentPlaces.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="text-[11px] text-slate-400">Pilihan cepat dari riwayat Anda:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.recentPlaces.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setTempat(p)}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                          tempat === p
                            ? 'bg-purple-100 dark:bg-purple-950 border-purple-400 text-purple-800 dark:text-purple-200 font-semibold shadow-xs'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Foto */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">3. Foto Bukti Pekerjaan *</Label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Setelah foto diambil, laporan langsung dikirim otomatis.
              </p>
              {camera ? (
                <CameraCapture onCapture={file => capture(file, null)} onClose={() => setCamera(false)} />
              ) : preview ? (
                <div className="relative">
                  <img src={preview} alt="Pratinjau Foto" className="w-full max-h-64 object-cover rounded-lg border" />
                  <button
                    type="button"
                    onClick={() => { setFoto(null); setPreview('') }}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {foto && <p className="mt-1 text-xs text-slate-400">{(foto.size / 1024).toFixed(0)} KB</p>}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCamera(true)}
                  disabled={busy || !jobs.length || !tempat.trim()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-300 disabled:hover:bg-white dark:disabled:hover:bg-slate-900"
                >
                  <Camera className="h-8 w-8 text-slate-400" />
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {jobs.length && tempat.trim() ? 'Ketuk untuk mengambil foto dan mengirim' : 'Pilih pekerjaan dan isi tempat terlebih dahulu'}
                  </span>
                </button>
              )}
            </div>

            {busy && (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-700">
                <RefreshCw className="h-5 w-5 animate-spin" />
                Memproses foto dan mengirim laporan otomatis...
              </div>
            )}

            {!busy && foto && message?.type === 'error' && (
              <Button onClick={() => submit(null)} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                <RefreshCw className="h-4 w-4 mr-2" /> Coba Kirim Lagi
              </Button>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsExtraModalOpen(false)
                setCamera(false)
              }}
            >
              Batal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PHOTO PREVIEW LIGHTBOX */}
      <Dialog open={Boolean(previewPhoto)} onOpenChange={open => !open && setPreviewPhoto(null)}>
        <DialogContent className="max-w-xl p-2 bg-black/95 border-slate-800">
          <DialogHeader className="p-2 text-white">
            <DialogTitle className="text-xs sm:text-sm font-medium">{previewPhoto?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-2 max-h-[75vh] overflow-hidden">
            {previewPhoto && (
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="max-w-full max-h-[70vh] object-contain rounded-md"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
