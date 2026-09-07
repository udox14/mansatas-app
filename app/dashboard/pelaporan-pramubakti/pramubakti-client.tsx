/* eslint-disable @next/next/no-img-element -- Camera previews use temporary blob URLs. */
'use client'

import { useEffect, useState } from 'react'
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
  BookOpen, Send, AlertTriangle, Check, ExternalLink, Sparkles, X
} from 'lucide-react'
import { getPramubaktiReports, submitPramubaktiReport } from './actions'
import { PbDetails, PbStatus } from '@/components/pramubakti/report-details'
import { todayWIB, currentTimeWIB } from '@/lib/time'
import { minutes, type PbItem } from '@/lib/pramubakti'

export function PramubaktiClient({
  initialData,
}: {
  initialData: Awaited<ReturnType<typeof getPramubaktiReports>>
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

  // Riwayat State
  const [start, setStart] = useState(data.today.slice(0, 7) + '-01')
  const [end, setEnd] = useState(data.today)
  const [history, setHistory] = useState(data.items)
  const [clock, setClock] = useState(() => currentTimeWIB().hhmm)

  useEffect(() => {
    const timer = window.setInterval(() => setClock(currentTimeWIB().hhmm), 15000)
    return () => window.clearInterval(timer)
  }, [])

  function canFill(item: PbItem) {
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
      const fresh = await getPramubaktiReports()
      setData(fresh)
      setHistory(fresh.items)
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Gagal memuat data.' })
    } finally {
      setBusy(false)
    }
  }

  async function capture(file: File) {
    setCamera(false)
    setBusy(true)
    try {
      const compressed = await compressAgendaImage(file)
      setFoto(compressed)
    } catch {
      setMessage({ type: 'error', text: 'Foto gagal diproses. Silakan ambil ulang foto.' })
    } finally {
      setBusy(false)
    }
  }

  async function submit(targetSlotId: string | null) {
    if (!foto || !jobs.length || !tempat.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const form = new FormData()
      form.set('tanggal', data.today)
      form.set('request_id', requestId)
      form.set('slot_id', targetSlotId || '')
      form.set('tempat', tempat.trim())
      form.set('foto', foto)
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
        const fresh = await getPramubaktiReports()
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
            Laporan Tambahan
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
            Riwayat Saya
          </TabsTrigger>
        </TabsList>

        {/* TAB CONTENT: HARI INI */}
        <TabsContent value="hari-ini" className="space-y-3 mt-3">
          {slots.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-10 text-center">
              <BookOpen className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Tidak ada kewajiban slot kerja hari ini.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Laporan pekerjaan di luar jadwal dapat dicatat melalui tombol <strong>Laporan Tambahan</strong>.
              </p>
            </div>
          ) : (
            slots.map(item => {
              const isExpanded = selectedSlotId === item.slot!.id
              const isDone = Boolean(item.report || item.leave)
              const allowedToFill = canFill(item)

              return (
                <div
                  key={item.key}
                  className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden shadow-sm transition-all"
                >
                  {/* Card Header (Identik dengan JadwalBlock Agenda Guru) */}
                  <div className="grid grid-cols-1 gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                          Slot Jam: {item.slot!.start} – {item.slot!.end} WIB
                        </span>
                        <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Kewajiban Wajib
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Laporan bukti kebersihan dan pemeliharaan lingkungan madrasah
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {isDone ? (
                        <div className="flex items-center gap-2">
                          <PbStatus item={item} />
                          {item.report?.foto_url && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" />
                              Tersimpan
                            </span>
                          )}
                        </div>
                      ) : (
                        <>
                          {!allowedToFill && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                              <Clock className="h-3 w-3" />
                              Dibuka 5 mnt sblm {item.slot!.start}
                            </span>
                          )}
                          <Button
                            size="sm"
                            disabled={busy || !allowedToFill}
                            onClick={() => openFillSlot(item.slot!.id)}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors"
                          >
                            <ClipboardPen className="h-3.5 w-3.5 mr-1" />
                            {isExpanded ? 'Tutup Form' : 'Isi Laporan'}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expandable Form (Identik dengan form input Agenda Guru) */}
                  {isExpanded && !isDone && (
                    <div className="border-t bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
                      {/* Step 1: Pilihan Pekerjaan */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          1. Pilih Jenis Pekerjaan yang Dilakukan *
                        </Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {data.jobs
                            .filter(j => j.active === 1)
                            .map(job => {
                              const isChecked = jobs.includes(job.name)
                              return (
                                <button
                                  type="button"
                                  key={job.id}
                                  onClick={() => toggleJob(job.name)}
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
                      </div>

                      {/* Step 3: Bukti Foto Kamera */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          3. Foto Bukti Pekerjaan (Wajib Kamera) *
                        </Label>

                        {camera ? (
                          <div className="rounded-lg overflow-hidden border p-2 bg-black">
                            <CameraCapture onCapture={capture} onClose={() => setCamera(false)} />
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-3">
                            {preview ? (
                              <div className="relative w-36 h-28 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 shadow-sm">
                                <img
                                  src={preview}
                                  alt="Pratinjau Foto"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFoto(null)
                                    setPreview('')
                                  }}
                                  className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black text-white rounded-full transition-colors"
                                  title="Hapus foto"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : null}

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => setCamera(true)}
                              className="h-9 text-xs"
                            >
                              <Camera className="h-4 w-4 mr-1.5 text-emerald-600" />
                              {foto ? 'Ambil Ulang Foto' : 'Buka Kamera'}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Form Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <Button
                          disabled={busy || camera || !foto || !jobs.length || !tempat.trim()}
                          onClick={() => submit(item.slot!.id)}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors"
                        >
                          {busy ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                          Kirim Laporan
                        </Button>
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

        {/* TAB CONTENT: RIWAYAT SAYA */}
        <TabsContent value="riwayat" className="space-y-4 mt-3">
          <div className="rounded-lg border bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                  Riwayat Pekerjaan & Presensi
                </h3>
                <p className="text-xs text-slate-500">
                  Lihat rekam jejak laporan yang pernah Anda kirimkan.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                <Link href="/dashboard/ckh-generator">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  Buka CKH Generator
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex-1 min-w-[140px]">
                <Label className="text-xs text-slate-500">Dari Tanggal</Label>
                <Input
                  type="date"
                  value={start}
                  max={todayWIB()}
                  onChange={e => setStart(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <Label className="text-xs text-slate-500">Sampai Tanggal</Label>
                <Input
                  type="date"
                  value={end}
                  max={todayWIB()}
                  onChange={e => setEnd(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const res = await getPramubaktiReports(start, end)
                    setHistory(res.items)
                  } catch (e) {
                    setMessage({
                      type: 'error',
                      text: e instanceof Error ? e.message : 'Gagal memuat riwayat.',
                    })
                  } finally {
                    setBusy(false)
                  }
                }}
                className="h-9 px-4 font-medium"
              >
                {busy ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : 'Tampilkan'}
              </Button>
            </div>
          </div>

          <PbDetails items={history} />
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
            {/* 1. Pilih Pekerjaan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">1. Pilih Jenis Pekerjaan *</Label>
              <div className="grid grid-cols-2 gap-2">
                {data.jobs
                  .filter(j => j.active === 1)
                  .map(job => {
                    const isChecked = jobs.includes(job.name)
                    return (
                      <button
                        type="button"
                        key={job.id}
                        onClick={() => toggleJob(job.name)}
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
            </div>

            {/* 3. Foto */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">3. Foto Bukti Pekerjaan *</Label>
              {camera ? (
                <div className="rounded-lg overflow-hidden border p-2 bg-black">
                  <CameraCapture onCapture={capture} onClose={() => setCamera(false)} />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  {preview ? (
                    <div className="relative w-36 h-28 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 shadow-sm">
                      <img
                        src={preview}
                        alt="Pratinjau Foto"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFoto(null)
                          setPreview('')
                        }}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black text-white rounded-full transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => setCamera(true)}
                    className="h-9 text-xs"
                  >
                    <Camera className="h-4 w-4 mr-1.5 text-purple-600" />
                    {foto ? 'Ambil Ulang Foto' : 'Buka Kamera'}
                  </Button>
                </div>
              )}
            </div>
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
            <Button
              size="sm"
              disabled={busy || camera || !foto || !jobs.length || !tempat.trim()}
              onClick={() => submit(null)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium"
            >
              {busy ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Kirim Laporan Tambahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
