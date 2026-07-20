// Lokasi: app/dashboard/agenda/components/agenda-client.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Camera, CheckCircle2, Clock, AlertTriangle, XCircle,
  Loader2, BookOpen, Send, RefreshCw, ClipboardPen, Ban,
} from 'lucide-react'
import { submitAgenda, getJadwalGuruHariIni } from '../actions'
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
  agenda_id?: string
  status?: string
}

interface AgendaClientProps {
  initialData: {
    error: string | null
    blocks: JadwalBlock[]
    slots: SlotJam[]
    tanggal: string
    hari: number
    kbmExceptions?: KbmException[]
    calendarStatus?: { isEffective: boolean; reason: string | null; category: string | null }
  }
  userRole: string
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

export function AgendaClient({ initialData, userRole, isActingAs = false }: AgendaClientProps) {
  const [data, setData] = useState(initialData)
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null)
  const [materi, setMateri] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleRefresh = async ({ clearMessage = true }: { clearMessage?: boolean } = {}) => {
    setIsRefreshing(true)
    if (clearMessage) setPesan(null)
    try {
      const result = await withTimeout(
        getJadwalGuruHariIni(),
        'Memuat ulang jadwal terlalu lama. Periksa koneksi lalu coba refresh lagi.'
      )
      setData(result)
    } catch (error: any) {
      setPesan({ tipe: 'error', teks: error?.message || 'Gagal memuat ulang jadwal.' })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleFotoCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPesan(null)
    try {
      const compressed = await compressAgendaImage(file)
      setFotoFile(compressed)
      setFotoPreview(URL.createObjectURL(compressed))
    } catch {
      setPesan({ tipe: 'error', teks: 'Foto gagal diproses. Silakan ambil ulang foto.' })
      setFotoFile(null)
      setFotoPreview(null)
    } finally {
      e.target.value = ''
    }
  }, [])

  const handleSubmit = async (block: JadwalBlock) => {
    if (!materi.trim()) { setPesan({ tipe: 'error', teks: 'Materi wajib diisi.' }); return }
    if (!fotoFile && !isActingAs) { setPesan({ tipe: 'error', teks: 'Foto wajib diambil.' }); return }

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
    if (fotoFile) fd.append('foto', fotoFile)

    try {
      const result = await withTimeout(
        submitAgenda(fd),
        'Pengiriman agenda terlalu lama. Periksa koneksi lalu tekan Refresh untuk memastikan status agenda.'
      )
      if (result.error) {
        setPesan({ tipe: 'error', teks: result.error })
      } else {
        setPesan({ tipe: 'sukses', teks: result.success || 'Berhasil!' })
        setMateri('')
        setFotoFile(null)
        setFotoPreview(null)
        setExpandedBlock(null)
        await handleRefresh({ clearMessage: false })
      }
    } catch (error: any) {
      setPesan({ tipe: 'error', teks: error?.message || 'Agenda gagal dikirim. Silakan coba lagi.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const { blocks, tanggal, hari, error, calendarStatus } = data
  const activeExceptions = data.kbmExceptions || []
  const activeBlockCount = blocks.filter(block => !block.is_fully_excepted).length

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
        <p className="text-sm text-amber-700">{error}</p>
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
        </div>
        <Button variant="outline" size="sm" onClick={() => handleRefresh()} disabled={isRefreshing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {pesan && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${pesan.tipe === 'sukses' ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {pesan.teks}
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
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{block.mapel_nama}</span>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">{block.kelas_label}</span>
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

              {block.is_fully_excepted ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                  <Ban className="h-3.5 w-3.5" /> Tidak wajib
                </span>
              ) : block.sudah_isi ? (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.text}`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {style.label}
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setExpandedBlock(isExpanded ? null : block.penugasan_id)
                    setMateri('')
                    setFotoFile(null)
                    setFotoPreview(null)
                    setPesan(null)
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  <ClipboardPen className="h-3.5 w-3.5 mr-1" />
                  Isi Agenda
                </Button>
              )}
            </div>

            {isExpanded && !block.sudah_isi && (
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
                    onChange={(e) => setMateri(e.target.value)}
                    placeholder="Tuliskan materi yang diajarkan hari ini..."
                    rows={3}
                    className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none resize-none"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Foto Kegiatan {!isActingAs && <span className="text-red-500">*</span>}
                  </Label>

                  {fotoPreview ? (
                    <div className="mt-1 relative">
                      <img src={fotoPreview} alt="Preview" className="w-full max-h-64 object-cover rounded-lg border" />
                      <button
                        type="button"
                        onClick={() => { setFotoFile(null); setFotoPreview(null) }}
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
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1 w-full flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50/50 transition-colors"
                    >
                      <Camera className="h-8 w-8 text-slate-400" />
                      <span className="text-sm text-slate-500 dark:text-slate-400">Ketuk untuk membuka kamera</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFotoCapture}
                    className="hidden"
                  />
                </div>

                {isActingAs && (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                    Input atas nama guru. Validasi waktu di-skip, foto opsional.
                  </div>
                )}

                <Button
                  onClick={() => handleSubmit(block)}
                  disabled={isSubmitting || !materi.trim() || (!fotoFile && !isActingAs)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mengirim...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Kirim Agenda</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
