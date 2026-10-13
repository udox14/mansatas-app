// Lokasi: app/dashboard/agenda/components/agenda-client.tsx
'use client'

import { CameraCapture } from '@/components/shared/camera-capture'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Camera, CheckCircle2, Clock, AlertTriangle, XCircle,
  Loader2, BookOpen, Send, RefreshCw, ClipboardPen, Ban,
  FileWarning,
} from 'lucide-react'
import { submitForgottenAgendaRequest } from '../actions'
import { sendAgenda } from '@/lib/agenda-submission-client'
import { agendaDraftKey, readAgendaDraft, saveAgendaDraft, saveAgendaCameraPhoto, clearAgendaDraft, beginAgendaCamera, finishAgendaCamera, draftPhotoFile, fileToDataUrl, AGENDA_DRAFT_RESTORED_EVENT } from '@/lib/agenda-draft'
import type { SlotJam } from '@/app/dashboard/settings/types'
import { compressAgendaImage } from './image-compression'
import type { KbmException } from '@/lib/kalender-pendidikan'

type JadwalBlock = {
  penugasan_id: string
  mapel_nama: string
  kelas_label: string
  kelas_id: string
  guru_id: string
  guru_nama: string
  jam_ke_mulai: number
  jam_ke_selesai: number
  jadwal_jam_ke_mulai: number
  jadwal_jam_ke_selesai: number
  slot_mulai: string
  slot_selesai: string
  jumlah_jam_aktif: number
  exception_segments: Array<{
    exception_id: string
    judul: string
    description: string | null
    jam_ke_mulai: number
    jam_ke_selesai: number
  }>
  is_fully_excepted: boolean
  sudah_isi: boolean
  sudah_didelegasi: boolean
  alasan_ketidakhadiran?: 'SAKIT' | 'IZIN'
  deskripsi_ketidakhadiran?: string | null
  alasan_delegasi?: string | null
  tugas_delegasi?: string | null
  pelaksana_nama?: string | null
  delegasi_selesai?: boolean
  agenda_id?: string
  status?: string
  pengajuan_lupa_id?: string
  pengajuan_lupa_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  pengajuan_lupa_catatan?: string | null
  blok_selesai: boolean
  waktu_pengisian_berakhir: boolean
  bisa_ajukan_lupa: boolean
}

interface AgendaClientProps {
  initialData: {
    error: string | null
    blocks: JadwalBlock[]
    slots: SlotJam[]
    tanggal: string
    hari: number
    forgottenRequestQuota?: { limit: number; used: number; remaining: number }
    kbmExceptions?: KbmException[]
    calendarStatus?: { isEffective: boolean; reason: string | null; category: string | null }
  }
  userRole: string
  draftOwnerId: string
  isActingAs?: boolean
}

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  TEPAT_WAKTU: { bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, label: 'Tepat Waktu' },
  TELAT: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: Clock, label: 'Telat' },
  ALFA: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: XCircle, label: 'Alfa' },
  SAKIT: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: AlertTriangle, label: 'Sakit' },
  IZIN: { bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700', icon: AlertTriangle, label: 'Izin' },
}

const HARI_NAMA = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const REQUEST_TIMEOUT_MS = 45000

async function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), REQUEST_TIMEOUT_MS)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function loadAgendaSchedule(controller = new AbortController()): Promise<AgendaClientProps['initialData']> {
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const date = new URLSearchParams(window.location.search).get('date')
    const response = await fetch(`/api/agenda/schedule${date ? `?date=${encodeURIComponent(date)}` : ''}`, { credentials: 'include', cache: 'no-store', signal: controller.signal })
    if (response.status === 401) throw new Error('Sesi login sudah berakhir. Login kembali untuk memuat status agenda.')
    const result = await response.json() as AgendaClientProps['initialData']
    if (!response.ok || result?.error || !Array.isArray(result?.blocks)) throw new Error(result?.error || 'Status agenda gagal dimuat dari server. Tekan Refresh untuk mencoba lagi.')
    return result
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Memuat status agenda melewati 45 detik. Periksa koneksi lalu tekan Refresh.')
    if (error instanceof TypeError) throw new Error('Koneksi terputus. Status agenda belum dapat diperbarui; periksa koneksi lalu tekan Refresh.')
    if (error instanceof SyntaxError) throw new Error('Respons status agenda tidak dapat dibaca. Tekan Refresh untuk mencoba lagi.')
    throw error
  } finally { clearTimeout(timer) }
}

export function AgendaClient({ initialData, userRole, draftOwnerId, isActingAs = false }: AgendaClientProps) {
  const [data, setData] = useState(initialData)
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null)
  const [materi, setMateri] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error' | 'info'; teks: string } | null>(null)
  const [showCamera, setShowCamera] = useState<false | 'native' | 'inline'>(false)
  const [forgottenBlock, setForgottenBlock] = useState<string | null>(null)
  const [forgottenMateri, setForgottenMateri] = useState('')
  const [isSubmittingForgotten, setIsSubmittingForgotten] = useState(false)
  const submittingRef = useRef(false)
  const captureRef = useRef(false)
  const cameraOpenRef = useRef(false)
  const restoreVersion = useRef(0)
  const scheduleVersion = useRef(0)
  const draftKey = agendaDraftKey(draftOwnerId, data.tanggal)

  useEffect(() => {
    let disposed = false
    const restore = async () => {
      if (cameraOpenRef.current || captureRef.current || submittingRef.current) return
      const version = ++restoreVersion.current
      const isCurrent = () => !disposed && version === restoreVersion.current &&
        !cameraOpenRef.current && !captureRef.current && !submittingRef.current
      try {
        const draft = readAgendaDraft(draftKey)
        if (!draft) return
        const block = initialData.blocks.find(item => item.penugasan_id === draft.penugasanId)
        if (!block || block.sudah_isi || block.sudah_didelegasi) { clearAgendaDraft(draftKey); return }
        setExpandedBlock(block.penugasan_id)
        setMateri(draft.materi)
        setShowCamera(false)
        const restored = await draftPhotoFile(draft)
        const photo = restored ? (draft.photoDataUrl ? restored : await compressAgendaImage(restored)) : null
        if (!isCurrent()) return
        if (photo) {
          if (!draft.photoDataUrl) {
            const photoDataUrl = await fileToDataUrl(photo)
            if (!isCurrent()) return
            const latest = readAgendaDraft(draftKey)
            if (!latest || latest.penugasanId !== draft.penugasanId) return
            saveAgendaDraft(draftKey, { ...latest, nativePhoto: undefined, photoDataUrl, photoName: photo.name, updatedAt: Date.now() })
          }
          setFotoFile(photo)
          setFotoPreview(URL.createObjectURL(photo))
        }
        setPesan({ tipe: photo ? 'error' : 'info', teks: photo
          ? 'Draft materi dan foto dipulihkan. Agenda belum dikonfirmasi tersimpan; tekan Coba Kirim Lagi untuk memeriksa dan melanjutkan.'
          : 'Materi sudah dipulihkan. Foto belum diterima dari kamera; ambil foto lagi untuk melanjutkan.' })
      } catch (error) {
        if (isCurrent()) setPesan({ tipe: 'error', teks: error instanceof Error ? error.message : 'Draft atau foto gagal dipulihkan. Isi materi dan ambil foto ulang.' })
      }
    }
    void restore()
    const onRestored = () => { void restore() }
    window.addEventListener(AGENDA_DRAFT_RESTORED_EVENT, onRestored)
    return () => { disposed = true; window.removeEventListener(AGENDA_DRAFT_RESTORED_EVENT, onRestored) }
  }, [draftKey, initialData.blocks])

  useEffect(() => () => { if (fotoPreview) URL.revokeObjectURL(fotoPreview) }, [fotoPreview])

  // Router/PWA dapat memulihkan snapshot halaman. Periksa ulang ketika dibuka
  // atau kembali dari background, tanpa menimpa form yang sedang dikirim.
  useEffect(() => {
    let disposed = false
    let controller: AbortController | undefined
    const refresh = async () => {
      if (submittingRef.current || captureRef.current || cameraOpenRef.current) return
      controller?.abort()
      controller = new AbortController()
      const currentController = controller
      const version = scheduleVersion.current
      try {
        const result = await loadAgendaSchedule(currentController)
        if (!disposed && version === scheduleVersion.current && !submittingRef.current && !captureRef.current && !cameraOpenRef.current) setData(result)
      } catch (error) {
        if (!disposed && version === scheduleVersion.current && !currentController.signal.aborted) setPesan({ tipe: 'error', teks: error instanceof TypeError ? 'Koneksi terputus. Status agenda belum dapat diperbarui; periksa koneksi lalu tekan Refresh.' : error instanceof Error ? error.message : 'Status agenda gagal diperbarui. Tekan Refresh untuk mencoba lagi.' })
        if (!disposed && controller === currentController && currentController.signal.aborted) setPesan({ tipe: 'error', teks: 'Memuat status agenda melewati 45 detik. Periksa koneksi lalu tekan Refresh.' })
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    void refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => { disposed = true; controller?.abort(); document.removeEventListener('visibilitychange', onVisible) }
  }, [draftOwnerId])

  const persistDraft = (block: JadwalBlock, nextMateri = materi) => {
    const previous = readAgendaDraft(draftKey)
    saveAgendaDraft(draftKey, {
      ...(previous?.penugasanId === block.penugasan_id ? previous : {}),
      penugasanId: block.penugasan_id, materi: nextMateri, updatedAt: Date.now(),
    })
  }

  const handleRefresh = async ({ clearMessage = true, failurePrefix = '' }: { clearMessage?: boolean; failurePrefix?: string } = {}) => {
    setIsRefreshing(true)
    if (clearMessage) setPesan(null)
    try {
      const result = await loadAgendaSchedule()
      setData(result)
    } catch (error: any) {
      setPesan({ tipe: 'error', teks: failurePrefix + (error?.message || 'Gagal memuat ulang jadwal. Periksa koneksi lalu tekan Refresh.') })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSubmit = async (block: JadwalBlock, capturedFoto: File | null = fotoFile) => {
    if (submittingRef.current) return
    if (!materi.trim()) { setPesan({ tipe: 'error', teks: 'Materi wajib diisi.' }); return }
    if (!capturedFoto && !isActingAs) { setPesan({ tipe: 'error', teks: 'Foto wajib diambil.' }); return }

    submittingRef.current = true
    restoreVersion.current += 1
    scheduleVersion.current += 1
    setIsSubmitting(true)
    setPesan(null)

    const fd = new FormData()
    fd.append('penugasan_id', block.penugasan_id)
    fd.append('tanggal', data.tanggal)
    fd.append('jam_ke_mulai', String(block.jam_ke_mulai))
    fd.append('jam_ke_selesai', String(block.jam_ke_selesai))
    fd.append('slot_mulai', block.slot_mulai)
    fd.append('slot_selesai', block.slot_selesai)
    fd.append('materi', materi.trim())
    if (capturedFoto) fd.append('foto', capturedFoto)

    try {
      persistDraft(block)
      if (capturedFoto) {
        const photoDataUrl = await fileToDataUrl(capturedFoto)
        saveAgendaDraft(draftKey, { penugasanId: block.penugasan_id, materi: materi.trim(), updatedAt: Date.now(), photoDataUrl, photoName: capturedFoto.name })
      }
      const result = await sendAgenda(fd)
      if (result.error) {
        setPesan({ tipe: 'error', teks: result.error })
      } else {
        // Bukti database dari respons, bukan asumsi "tidak ada error".
        setData(previous => ({ ...previous, blocks: previous.blocks.map(item => item.penugasan_id === block.penugasan_id
          ? { ...item, sudah_isi: true, agenda_id: result.agenda!.id, status: result.agenda!.status } : item) }))
        try { clearAgendaDraft(draftKey) } catch {
          setPesan({ tipe: 'error', teks: 'Agenda tersimpan, tetapi draft perangkat gagal dibersihkan. Muat ulang jadwal untuk memeriksa status.' })
          return
        }
        setPesan({ tipe: 'sukses', teks: result.success || 'Berhasil!' })
        setMateri('')
        setFotoFile(null)
        setFotoPreview(null)
        setExpandedBlock(null)
        setShowCamera(false)
        await handleRefresh({ clearMessage: false, failurePrefix: 'Agenda sudah tersimpan, tetapi jadwal gagal diperbarui. ' })
      }
    } catch (error: any) {
      setPesan({ tipe: 'error', teks: error?.message || 'Agenda gagal dikirim. Silakan coba lagi.' })
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const handleCameraCapture = async (file: File, block: JadwalBlock) => {
    if (captureRef.current || submittingRef.current) return
    captureRef.current = true
    restoreVersion.current += 1
    setPesan(null)
    setIsSubmitting(true)

    try {
      const compressed = await compressAgendaImage(file)
      setFotoFile(compressed)
      setFotoPreview(URL.createObjectURL(compressed))
      setShowCamera(false)
      await handleSubmit(block, compressed)
    } catch (error) {
      setPesan({ tipe: 'error', teks: error instanceof Error ? error.message : 'Foto gagal diproses. Materi tetap disimpan; ambil ulang foto.' })
      setFotoFile(null)
      setFotoPreview(null)
      throw error
    } finally {
      captureRef.current = false
      setIsSubmitting(false)
    }
  }

  const handleForgottenRequest = async (block: JadwalBlock) => {
    if (!forgottenMateri.trim()) {
      setPesan({ tipe: 'error', teks: 'Materi wajib diisi.' })
      return
    }
    if (!confirm('Pengajuan ini akan memakai satu kuota bulan berjalan, termasuk jika nantinya ditolak. Kirim pengajuan?')) return

    setIsSubmittingForgotten(true)
    setPesan(null)
    const formData = new FormData()
    formData.append('penugasan_id', block.penugasan_id)
    formData.append('tanggal', data.tanggal)
    formData.append('materi', forgottenMateri.trim())
    try {
      const result = await withTimeout(
        submitForgottenAgendaRequest(formData),
        'Pengajuan terlalu lama. Periksa koneksi lalu muat ulang halaman.',
      )
      if (result.error) setPesan({ tipe: 'error', teks: result.error })
      else {
        setPesan({ tipe: 'sukses', teks: result.success || 'Pengajuan berhasil dikirim.' })
        setForgottenBlock(null)
        setForgottenMateri('')
        await handleRefresh({ clearMessage: false })
      }
    } catch (error: any) {
      setPesan({ tipe: 'error', teks: error?.message || 'Pengajuan gagal dikirim.' })
    } finally {
      setIsSubmittingForgotten(false)
    }
  }

  const { blocks, tanggal, hari, error, calendarStatus } = data
  const activeExceptions = data.kbmExceptions || []
  const activeBlockCount = blocks.filter(block => !block.is_fully_excepted).length

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
        <p role="alert" className="text-sm text-amber-700">{pesan?.teks || error}</p>
        <Button type="button" variant="outline" className="mt-3" disabled={isRefreshing} onClick={() => handleRefresh()}>Coba Muat Jadwal Lagi</Button>
      </div>
    )
  }

  if (calendarStatus && !calendarStatus.isEffective) {
    return (
      <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50 p-10 text-center">
        <BookOpen className="h-10 w-10 text-rose-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-rose-700">Tanggal ini tidak efektif pembelajaran.</p>
        <p className="mt-1 text-xs text-rose-600">{calendarStatus.reason || 'Agenda guru tidak perlu diisi.'}</p>
      </div>
    )
  }

  if (hari === 7) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-10 text-center">
        <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Hari Minggu - tidak ada jadwal mengajar.</p>
      </div>
    )
  }

  if (blocks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-10 text-center">
        <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Tidak ada jadwal mengajar hari ini ({HARI_NAMA[hari]}).</p>
        {activeExceptions.length > 0 && (
          <p className="mt-2 text-xs text-sky-600">
            Ada pengecualian KBM: {activeExceptions.map(item => `${item.judul} (Jam ke-${item.jam_ke_mulai}-${item.jam_ke_selesai})`).join(', ')}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border bg-white dark:bg-slate-900 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {HARI_NAMA[hari]}, {new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{activeBlockCount} blok wajib agenda dari {blocks.length} jadwal</p>
          {data.forgottenRequestQuota && (
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Sisa kuota ajukan lupa isi: <span className="font-semibold text-slate-700 dark:text-slate-200">{data.forgottenRequestQuota.remaining} dari {data.forgottenRequestQuota.limit}</span> bulan ini
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => handleRefresh()} disabled={isRefreshing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {pesan && (
        <div className={`rounded-lg border px-4 py-3 ${pesan.tipe === 'sukses' ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : pesan.tipe === 'info' ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <div className="flex items-center gap-3">
            {pesan.tipe === 'sukses'
              ? <CheckCircle2 className="h-7 w-7 shrink-0" />
              : <AlertTriangle className="h-5 w-5 shrink-0" />}
            <div>
              {pesan.tipe === 'sukses' && <p className="font-bold">Agenda berhasil dikirim</p>}
              <p className="text-sm">{pesan.teks}</p>
              {pesan.tipe === 'info' && expandedBlock && !fotoFile && (
                <Button type="button" size="sm" variant="outline" className="mt-2" disabled={isSubmitting || !materi.trim()} onClick={() => setShowCamera('inline')}>
                  <Camera className="mr-2 h-4 w-4" /> Gunakan Kamera di Halaman
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeExceptions.length > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-700">
          Pengecualian KBM hari ini: {activeExceptions.map(item => `${item.judul} (Jam ke-${item.jam_ke_mulai}-${item.jam_ke_selesai})`).join(', ')}
        </div>
      )}

      {blocks.map((block) => {
        const isExpanded = expandedBlock === block.penugasan_id && !block.is_fully_excepted
        const style = STATUS_STYLE[block.status || 'ALFA'] || STATUS_STYLE.ALFA
        const StatusIcon = style.icon

        return (
          <div key={block.penugasan_id} className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3">
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <div className="flex flex-col gap-0.5 mb-1">
                  <span className="text-base font-bold text-slate-800 dark:text-slate-100">{block.kelas_label}</span>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{block.mapel_nama}</span>
                  {block.status === 'IZIN' && !block.sudah_didelegasi && block.deskripsi_ketidakhadiran && <p className="text-xs text-slate-500 whitespace-pre-wrap">{block.deskripsi_ketidakhadiran}</p>}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Jadwal jam ke-{block.jadwal_jam_ke_mulai === block.jadwal_jam_ke_selesai
                    ? block.jadwal_jam_ke_mulai
                    : `${block.jadwal_jam_ke_mulai}-${block.jadwal_jam_ke_selesai}`}
                  {block.exception_segments.length > 0 && !block.is_fully_excepted && <> &middot; KBM aktif jam ke-{block.jam_ke_mulai === block.jam_ke_selesai ? block.jam_ke_mulai : `${block.jam_ke_mulai}-${block.jam_ke_selesai}`} ({block.slot_mulai}-{block.slot_selesai})</>}
                </p>
                {block.exception_segments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {block.exception_segments.map(segment => (
                      <p key={`${segment.exception_id}-${segment.jam_ke_mulai}`} className="inline-flex mr-1.5 items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-medium text-sky-700">
                        <Ban className="h-3 w-3" /> Jam ke-{segment.jam_ke_mulai === segment.jam_ke_selesai ? segment.jam_ke_mulai : `${segment.jam_ke_mulai}-${segment.jam_ke_selesai}`} non-KBM: {segment.judul}
                      </p>
                    ))}
                    {!block.is_fully_excepted && <p className="text-[10px] text-emerald-600">Agenda dan absensi dimulai dari jam KBM aktif pertama.</p>}
                  </div>
                )}
              </div>

              <div className="flex min-w-0 max-w-[9rem] flex-wrap items-center justify-end gap-2 text-right [overflow-wrap:anywhere] sm:max-w-xs">
                {block.is_fully_excepted ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                    <Ban className="h-3.5 w-3.5" /> Tidak wajib
                  </span>
                ) : block.sudah_didelegasi && !block.sudah_isi ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                      <Send className="h-3.5 w-3.5 shrink-0" /> {block.alasan_ketidakhadiran === 'SAKIT' ? 'Sakit' : 'Izin'} — tugas terkirim
                    </span>
                  </>
                ) : block.sudah_isi ? (
                  <>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.text}`}>
                      <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                      {style.label}
                    </div>
                  </>
                ) : block.pengajuan_lupa_status === 'PENDING' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    <Clock className="h-3.5 w-3.5" /> Menunggu persetujuan
                  </span>
                ) : block.pengajuan_lupa_status === 'REJECTED' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                    <XCircle className="h-3.5 w-3.5" /> Pengajuan ditolak
                  </span>
                ) : block.pengajuan_lupa_status === 'CANCELLED' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                    <Ban className="h-3.5 w-3.5" /> Pengajuan dibatalkan
                  </span>
                ) : block.bisa_ajukan_lupa ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setForgottenBlock(forgottenBlock === block.penugasan_id ? null : block.penugasan_id)
                      setForgottenMateri('')
                      setExpandedBlock(null)
                      setPesan(null)
                    }}
                    className="border-amber-300 bg-amber-50 text-xs text-amber-800 hover:bg-amber-100"
                  >
                    <FileWarning className="mr-1 h-3.5 w-3.5" /> Ajukan Lupa Isi
                  </Button>
                ) : block.waktu_pengisian_berakhir ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                    <XCircle className="h-3.5 w-3.5" /> Alfa
                  </span>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      setExpandedBlock(isExpanded ? null : block.penugasan_id)
                      setMateri('')
                      setFotoFile(null)
                      setFotoPreview(null)
                      setPesan(null)
                      setShowCamera(false)
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  >
                    <ClipboardPen className="h-3.5 w-3.5 mr-1" />
                    Isi Agenda
                  </Button>
                )}
              </div>
            </div>

            {block.sudah_didelegasi && (
              <div className="mx-4 mb-3 rounded-md border border-violet-100 bg-violet-50/60 px-3 py-2.5 text-xs text-slate-700 dark:border-violet-900 dark:bg-violet-950/20 dark:text-slate-300">
                <p className="font-semibold text-violet-800 dark:text-violet-300">Tugas untuk kelas ini</p>
                {block.tugas_delegasi && <p className="mt-1 whitespace-pre-wrap leading-relaxed">{block.tugas_delegasi}</p>}
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-slate-500 dark:text-slate-400">
                  {block.alasan_delegasi && <span>Alasan: {block.alasan_delegasi}</span>}
                  {block.pelaksana_nama && <span>Pelaksana: {block.pelaksana_nama}</span>}
                  {block.delegasi_selesai && <span>Sudah dilaksanakan</span>}
                </div>
              </div>
            )}

            {block.pengajuan_lupa_status === 'REJECTED' && block.pengajuan_lupa_catatan && (
              <div className="border-t border-red-100 bg-red-50/60 px-4 py-2 text-xs text-red-700">
                Catatan reviewer: {block.pengajuan_lupa_catatan}
              </div>
            )}

            {forgottenBlock === block.penugasan_id && block.bisa_ajukan_lupa && (
              <div className="space-y-3 border-t border-amber-200 bg-amber-50/60 px-4 py-4">
                <div>
                  <Label htmlFor={`forgotten-materi-${block.penugasan_id}`} className="text-xs font-semibold text-slate-700">
                    Materi yang diajarkan
                  </Label>
                  <textarea
                    id={`forgotten-materi-${block.penugasan_id}`}
                    value={forgottenMateri}
                    onChange={event => setForgottenMateri(event.target.value)}
                    rows={3}
                    placeholder="Tuliskan materi pembelajaran pada jam tersebut..."
                    className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </div>
                <p className="text-xs text-amber-800">
                  Foto tidak diperlukan. Sisa kuota bulan ini: {data.forgottenRequestQuota?.remaining ?? 0} dari {data.forgottenRequestQuota?.limit ?? 0}. Pengajuan tetap memakai satu kuota walaupun ditolak.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleForgottenRequest(block)}
                    disabled={isSubmittingForgotten || !forgottenMateri.trim()}
                    className="bg-amber-600 text-white hover:bg-amber-700"
                  >
                    {isSubmittingForgotten ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                    Kirim Pengajuan
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setForgottenBlock(null)} disabled={isSubmittingForgotten}>
                    Batal
                  </Button>
                </div>
              </div>
            )}

            {isExpanded && !block.sudah_isi && !block.sudah_didelegasi && (
              <div className="border-t bg-slate-50 dark:bg-slate-800/50 px-4 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Mata Pelajaran</Label>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{block.mapel_nama}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Kelas</Label>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{block.kelas_label}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Jam Pelajaran</Label>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {block.jam_ke_mulai === block.jam_ke_selesai
                        ? `Jam ke-${block.jam_ke_mulai}`
                        : `Jam ke-${block.jam_ke_mulai} s/d ${block.jam_ke_selesai}`}
                      {block.exception_segments.length > 0 && <span className="ml-1 text-[11px] text-sky-600">({block.jumlah_jam_aktif} JP aktif setelah pengecualian)</span>}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Waktu</Label>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{block.slot_mulai} - {block.slot_selesai}</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="materi" className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Materi Pelajaran <span className="text-red-500">*</span>
                  </Label>
                  <textarea
                    id="materi"
                    value={materi}
                    disabled={isSubmitting}
                    onChange={(e) => {
                      setMateri(e.target.value)
                      try { persistDraft(block, e.target.value) } catch (error) {
                        setPesan({ tipe: 'error', teks: error instanceof Error ? error.message : 'Materi gagal disimpan sebagai draft.' })
                      }
                    }}
                    placeholder="Tuliskan materi yang diajarkan hari ini..."
                    rows={3}
                    className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none resize-none"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Foto Kegiatan {!isActingAs && <span className="text-red-500">*</span>}
                  </Label>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Setelah foto diambil, agenda langsung dikirim otomatis.
                  </p>

                  {showCamera ? (
                    <CameraCapture allowInlineFallback startInline={showCamera === 'inline'} onCapture={(file) => handleCameraCapture(file, block)} onClose={() => setShowCamera(false)}
                      onBeforeOpen={() => {
                        persistDraft(block); beginAgendaCamera(draftKey)
                        cameraOpenRef.current = true
                        restoreVersion.current += 1
                        scheduleVersion.current += 1
                      }}
                      onNativePhoto={photo => saveAgendaCameraPhoto(draftKey, photo)}
                      onFinished={() => { cameraOpenRef.current = false; finishAgendaCamera(draftKey) }} />
                  ) : fotoPreview ? (
                    <div className="mt-1 relative">
                      <img src={fotoPreview} alt="Preview" className="w-full max-h-64 object-contain rounded-lg border" />
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => {
                          setFotoFile(null); setFotoPreview(null)
                          try { saveAgendaDraft(draftKey, { penugasanId: block.penugasan_id, materi, updatedAt: Date.now() }) } catch (error) {
                            setPesan({ tipe: 'error', teks: error instanceof Error ? error.message : 'Draft foto gagal diperbarui.' })
                          }
                        }}
                        className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                      <p className="text-xs text-slate-400 mt-1">
                        {fotoFile && `${(fotoFile.size / 1024).toFixed(0)} KB`}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCamera('native')}
                      disabled={isSubmitting || !materi.trim()}
                      className="mt-1 w-full flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-300 disabled:hover:bg-white dark:disabled:hover:bg-slate-900"
                    >
                      <Camera className="h-8 w-8 text-slate-400" />
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {materi.trim() ? 'Ketuk untuk mengambil foto dan mengirim' : 'Isi materi terlebih dahulu'}
                      </span>
                    </button>
                  )}
                </div>

                {pesan?.tipe === 'error' && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{pesan.teks}</p>}
                {isSubmitting && (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Memproses foto dan mengirim agenda otomatis...
                  </div>
                )}

                {isActingAs && (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                    Input atas nama guru. Validasi waktu di-skip, foto opsional.
                  </div>
                )}

                {!isSubmitting && !isActingAs && fotoFile && pesan?.tipe === 'error' && (
                  <Button
                    onClick={() => handleSubmit(block)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" /> Coba Kirim Lagi
                  </Button>
                )}

                {isActingAs && !isSubmitting && (
                  <Button
                    onClick={() => handleSubmit(block)}
                    disabled={!materi.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Send className="h-4 w-4 mr-2" /> Kirim Agenda
                  </Button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
