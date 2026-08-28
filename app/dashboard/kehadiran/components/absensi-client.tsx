// Lokasi: app/dashboard/kehadiran/components/absensi-client.tsx
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2, XCircle, Thermometer, ShieldAlert,
  Loader2, BookOpen, RefreshCw, CloudUpload, WifiOff,
  MessageSquare, Users, ArrowLeft, ClipboardCheck,
  CalendarRange, ListChecks, Ban,
} from 'lucide-react'
import {
  getBlokMengajarHariIni, loadSiswaAbsensi, simpanAbsensi,
  type BlokMengajar, type SiswaAbsensi,
} from '../actions'
import { AvatarSiswa } from '@/components/ui/avatar-siswa'
import type { KbmException } from '@/lib/kalender-pendidikan'
import { TeacherAttendanceReportPanel } from './teacher-attendance-grid-report'

interface Props {
  ownerId: string
  initialData: {
    error: string | null
    blocks: BlokMengajar[]
    tanggal: string
    hari: number
    hariNama: string
    kbmExceptions?: KbmException[]
    calendarStatus?: { isEffective: boolean; reason: string | null; category: string | null }
  }
}

const STATUS_CYCLE: Array<SiswaAbsensi['status']> = ['HADIR', 'SAKIT', 'ALFA', 'IZIN']
const AUTOSAVE_STORAGE_KEY = 'mansatas_absensi_autosave_v1'
const AUTOSAVE_INTERVAL_MS = 2_000

type PendingAttendance = {
  penugasanId: string
  tanggal: string
  slotMulai: string
  slotSelesai: string
  jamKeMulai: number
  jamKeSelesai: number
  jumlahJam: number
  siswa: SiswaAbsensi[]
  ownerId: string
  updatedAt: number
}

type PendingAttendanceQueue = Record<string, PendingAttendance>
let memoryPendingQueue: PendingAttendanceQueue = {}
let localStorageUnavailable = false

function attendanceKey(ownerId: string, penugasanId: string, tanggal: string) {
  return `${ownerId}::${penugasanId}::${tanggal}`
}

function readPendingQueue(): PendingAttendanceQueue {
  if (typeof window === 'undefined') return {}
  if (localStorageUnavailable) return memoryPendingQueue
  try {
    const parsed = JSON.parse(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY) || '{}')
    memoryPendingQueue = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    return memoryPendingQueue
  } catch {
    localStorageUnavailable = true
    return memoryPendingQueue
  }
}

function writePendingQueue(queue: PendingAttendanceQueue) {
  memoryPendingQueue = queue
  if (typeof window === 'undefined') return false
  try {
    if (Object.keys(queue).length === 0) window.localStorage.removeItem(AUTOSAVE_STORAGE_KEY)
    else window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(queue))
    localStorageUnavailable = false
    return true
  } catch {
    localStorageUnavailable = true
    return false
  }
}

function pendingCountForOwner(queue: PendingAttendanceQueue, ownerId: string) {
  return Object.values(queue).filter(item => item.ownerId === ownerId).length
}
const STATUS_UI: Record<string, { bg: string; text: string; icon: any; label: string; border: string }> = {
  HADIR: { bg: 'bg-emerald-50 dark:bg-emerald-950/50', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, label: 'Hadir', border: 'border-emerald-200 dark:border-emerald-800' },
  SAKIT: { bg: 'bg-amber-50', text: 'text-amber-700', icon: Thermometer, label: 'Sakit', border: 'border-amber-200' },
  ALFA:  { bg: 'bg-red-50', text: 'text-red-700', icon: XCircle, label: 'Alfa', border: 'border-red-200' },
  IZIN:  { bg: 'bg-blue-50', text: 'text-blue-700', icon: ShieldAlert, label: 'Izin', border: 'border-blue-200' },
}

export function AbsensiClient({ initialData, ownerId }: Props) {
  const [activeTab, setActiveTab] = useState<'input' | 'rekap'>('input')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950">
        <button
          type="button"
          onClick={() => setActiveTab('input')}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${activeTab === 'input' ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ListChecks className="h-4 w-4" /> Input Absensi
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rekap')}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${activeTab === 'rekap' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <CalendarRange className="h-4 w-4" /> Rekap Sesi Saya
        </button>
      </div>

      <div className={activeTab === 'input' ? 'block' : 'hidden'}>
        <AbsensiInputPanel initialData={initialData} ownerId={ownerId} />
      </div>
      {activeTab === 'rekap' && <TeacherAttendanceReportPanel />}
    </div>
  )
}

function AbsensiInputPanel({ initialData, ownerId }: Props) {
  const [data, setData] = useState(initialData)
  const [activeBlock, setActiveBlock] = useState<BlokMengajar | null>(null)
  const [siswaList, setSiswaList] = useState<SiswaAbsensi[]>([])
  const [isLoadingSiswa, setIsLoadingSiswa] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const syncInProgressRef = useRef(false)
  const activeAttendanceKeyRef = useRef<string | null>(null)

  const flushPending = useCallback(async () => {
    if (syncInProgressRef.current || (typeof navigator !== 'undefined' && !navigator.onLine)) return
    const initialQueue = readPendingQueue()
    const pendingEntries = Object.entries(initialQueue)
      .filter(([, item]) => item.ownerId === ownerId)
      .sort(([, a], [, b]) => a.updatedAt - b.updatedAt)
    if (pendingEntries.length === 0) {
      setPendingCount(0)
      return
    }

    syncInProgressRef.current = true
    setIsSyncing(true)
    try {
      for (const [key, pending] of pendingEntries) {
        if (!navigator.onLine) break
        try {
          const res = await simpanAbsensi(
            pending.penugasanId, pending.tanggal,
            pending.slotMulai, pending.slotSelesai,
            pending.jamKeMulai, pending.jamKeSelesai, pending.jumlahJam,
            pending.siswa.map(s => ({ siswa_id: s.siswa_id, status: s.status, catatan: s.catatan })),
          )
          if (res.error) {
            setPesan({ tipe: 'error', teks: `Belum dapat sinkron: ${res.error}` })
            continue
          }

          // Jangan hapus perubahan baru yang dibuat saat request sebelumnya masih berjalan.
          const latestQueue = readPendingQueue()
          if (latestQueue[key]?.updatedAt === pending.updatedAt) {
            delete latestQueue[key]
            writePendingQueue(latestQueue)
            if (activeAttendanceKeyRef.current === key) setHasChanges(false)
          }
          setData(prev => ({
            ...prev,
            blocks: prev.blocks.map(block => block.penugasan_id === pending.penugasanId
              ? {
                  ...block,
                  sudah_absen: true,
                  tidak_hadir: pending.siswa.filter(s => s.status !== 'HADIR').length,
                }
              : block),
          }))
        } catch {
          setPesan({ tipe: 'error', teks: 'Koneksi belum stabil. Data tetap aman di perangkat dan akan dicoba lagi otomatis.' })
          break
        }
      }
    } finally {
      const remaining = pendingCountForOwner(readPendingQueue(), ownerId)
      setPendingCount(remaining)
      setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
      setIsSyncing(false)
      syncInProgressRef.current = false
    }
  }, [ownerId])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setPendingCount(pendingCountForOwner(readPendingQueue(), ownerId))

    const handleOnline = () => {
      setIsOnline(true)
      void flushPending()
    }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    const timer = window.setInterval(() => void flushPending(), AUTOSAVE_INTERVAL_MS)
    void flushPending()
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [flushPending, ownerId])

  const refresh = async () => {
    setIsRefreshing(true)
    setData(await getBlokMengajarHariIni())
    setIsRefreshing(false)
  }

  const openBlock = useCallback(async (block: BlokMengajar) => {
    const key = attendanceKey(ownerId, block.penugasan_id, data.tanggal)
    activeAttendanceKeyRef.current = key
    setActiveBlock(block)
    setIsLoadingSiswa(true)
    setPesan(null)
    const localPending = readPendingQueue()[key]
    setHasChanges(Boolean(localPending))
    try {
      const res = await loadSiswaAbsensi(
        block.penugasan_id,
        block.kelas_id,
        data.tanggal,
        block.jam_ke_mulai,
        block.jam_ke_selesai,
      )
      if (res.error) {
        if (localPending) {
          setSiswaList(localPending.siswa)
          setPesan({ tipe: 'sukses', teks: 'Menampilkan data yang tersimpan aman di perangkat.' })
        } else setPesan({ tipe: 'error', teks: res.error })
      } else if (readPendingQueue()[key]) {
        const latestPending = readPendingQueue()[key]
        const localByStudent = new Map(latestPending.siswa.map(s => [s.siswa_id, s]))
        setSiswaList(res.siswa.map(s => {
          const local = localByStudent.get(s.siswa_id)
          return local ? { ...s, status: local.status, catatan: local.catatan } : s
        }))
        setHasChanges(true)
      } else {
        setSiswaList(res.siswa)
        setHasChanges(false)
      }
    } catch {
      if (localPending) {
        setSiswaList(localPending.siswa)
        setPesan({ tipe: 'sukses', teks: 'Sedang offline. Data terakhir dari perangkat berhasil dipulihkan.' })
      } else {
        setPesan({ tipe: 'error', teks: 'Data siswa belum tersedia offline. Buka kelas ini sekali saat terhubung ke internet.' })
      }
    }
    setIsLoadingSiswa(false)
  }, [data.tanggal, ownerId])

  const closeBlock = () => {
    activeAttendanceKeyRef.current = null
    setActiveBlock(null); setSiswaList([]); setHasChanges(false); setPesan(null)
  }

  const persistLocally = (nextSiswa: SiswaAbsensi[]) => {
    if (!activeBlock) return
    const key = attendanceKey(ownerId, activeBlock.penugasan_id, data.tanggal)
    const queue = readPendingQueue()
    queue[key] = {
      penugasanId: activeBlock.penugasan_id,
      tanggal: data.tanggal,
      slotMulai: activeBlock.slot_mulai,
      slotSelesai: activeBlock.slot_selesai,
      jamKeMulai: activeBlock.jam_ke_mulai,
      jamKeSelesai: activeBlock.jam_ke_selesai,
      jumlahJam: activeBlock.jumlah_jam,
      siswa: nextSiswa,
      ownerId,
      updatedAt: Date.now(),
    }
    const storedOnDevice = writePendingQueue(queue)
    setPendingCount(pendingCountForOwner(queue, ownerId))
    setHasChanges(true)
    if (!storedOnDevice) {
      setPesan({ tipe: 'error', teks: 'Penyimpanan perangkat tidak tersedia. Biarkan halaman ini tetap terbuka sampai data tersinkron.' })
    }
  }

  const updateAttendance = (updater: (current: SiswaAbsensi[]) => SiswaAbsensi[]) => {
    setSiswaList(current => {
      const next = updater(current)
      persistLocally(next)
      return next
    })
  }

  const toggleStatus = (siswaId: string) => {
    updateAttendance(prev => prev.map(s => {
      if (s.siswa_id !== siswaId) return s
      const idx = STATUS_CYCLE.indexOf(s.status)
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
      return { ...s, status: next }
    }))
  }

  const setStatus = (siswaId: string, status: SiswaAbsensi['status']) => {
    updateAttendance(prev => prev.map(s => s.siswa_id === siswaId ? { ...s, status } : s))
  }

  const setCatatan = (siswaId: string, catatan: string) => {
    updateAttendance(prev => prev.map(s => s.siswa_id === siswaId ? { ...s, catatan } : s))
  }

  const { blocks, tanggal, hariNama, error, calendarStatus } = data
  const activeExceptions = data.kbmExceptions || []
  const activeBlockCount = blocks.filter(block => !block.is_fully_excepted).length

  // Counts
  const counts = siswaList.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1; return acc
  }, {} as Record<string, number>)

  if (error) return (
    <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-6 text-center">
      <BookOpen className="h-8 w-8 text-amber-500 mx-auto mb-2" />
      <p className="text-sm text-amber-700">{error}</p>
    </div>
  )

  if (calendarStatus && !calendarStatus.isEffective) return (
    <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50 p-10 text-center">
      <BookOpen className="h-10 w-10 text-rose-300 mx-auto mb-3" />
      <p className="text-sm font-semibold text-rose-700">Tanggal ini tidak efektif pembelajaran.</p>
      <p className="mt-1 text-xs text-rose-600">{calendarStatus.reason || 'Tidak ada kewajiban absensi siswa.'}</p>
    </div>
  )

  // ── VIEW: DAFTAR SISWA (ABSENSI) ──
  if (activeBlock) {
    const hadir = counts.HADIR || 0
    const tidakHadir = siswaList.length - hadir
    return (
      <div className="space-y-2 pb-28 md:pb-20">
        {/* Header */}
        <div className="sticky -top-3 sm:-top-4 md:-top-5 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 pb-3 -mx-3 sm:-mx-4 md:-mx-5 -mt-3 sm:-mt-4 md:-mt-5 mb-4 px-3 sm:px-4 md:px-5 pt-3 sm:pt-4 md:pt-5 shadow-sm transition-all">
          <div className="flex items-start gap-3">
            <button
              onClick={closeBlock}
              className="mt-0.5 h-8 w-8 shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              aria-label="Kembali"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug break-words">{activeBlock.mapel_nama}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {activeBlock.kelas_label} &middot; Jam {activeBlock.jam_ke_mulai === activeBlock.jam_ke_selesai ? activeBlock.jam_ke_mulai : `${activeBlock.jam_ke_mulai}-${activeBlock.jam_ke_selesai}`} ({activeBlock.slot_mulai}—{activeBlock.slot_selesai})
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 font-semibold">Hadir {hadir}</span>
                {tidakHadir > 0 && (
                  <span className="text-[10px] px-2 py-1 rounded-md bg-rose-100 text-rose-700 font-semibold">Tidak hadir {tidakHadir}</span>
                )}
                {(counts.SAKIT || 0) > 0 && <span className="text-[10px] px-2 py-1 rounded-md bg-amber-100 text-amber-700 font-medium">Sakit {counts.SAKIT}</span>}
                {(counts.ALFA || 0) > 0 && <span className="text-[10px] px-2 py-1 rounded-md bg-red-100 text-red-700 font-medium">Alfa {counts.ALFA}</span>}
                {(counts.IZIN || 0) > 0 && <span className="text-[10px] px-2 py-1 rounded-md bg-blue-100 text-blue-700 font-medium">Izin {counts.IZIN}</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button onClick={() => updateAttendance(prev => prev.map(s => ({ ...s, status: 'HADIR' })))}
                  className="text-[10px] px-2.5 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 font-semibold">Semua Hadir</button>
                <button onClick={() => updateAttendance(prev => prev.map(s => ({ ...s, status: 'ALFA' })))}
                  className="text-[10px] px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-red-200 text-red-700 hover:bg-red-50 font-semibold">Semua Alfa</button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading */}
        {isLoadingSiswa && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        )}

        {/* Pesan */}
        {pesan && (
          <div className={`rounded-lg border px-3 py-2 text-xs ${pesan.tipe === 'sukses' ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {pesan.teks}
          </div>
        )}

        {/* Siswa List — Mobile optimized cards */}
        {!isLoadingSiswa && siswaList.map((s, idx) => {
          const ui = STATUS_UI[s.status]
          const Icon = ui.icon
          const noteOpen = expandedNote === s.siswa_id

          return (
            <div key={s.siswa_id} className={`rounded-lg border ${ui.border} ${ui.bg} overflow-hidden transition-colors`}>
              <div className="flex items-start gap-2 px-3 py-2.5">
                {/* Number */}
                <span className="text-[10px] text-slate-400 w-5 text-center shrink-0 pt-1">{idx + 1}</span>

                {/* Avatar */}
                <AvatarSiswa fotoUrl={s.foto_url} nama={s.nama_lengkap} size="sm" />

                {/* Name + info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 leading-snug break-words">{s.nama_lengkap}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className="text-[10px] text-slate-400">{s.nisn}</span>
                    {s.keterangan_wali_kelas && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                        <ClipboardCheck className="h-2.5 w-2.5" />
                        Keputusan wali: {s.keterangan_wali_kelas}
                      </span>
                    )}
                    {s.ada_izin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-200 text-blue-800 font-medium break-words">Izin: {s.alasan_izin}</span>
                    )}
                  </div>
                </div>

                {/* Status toggle — tap to cycle */}
                <button
                  onClick={() => toggleStatus(s.siswa_id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border ${ui.border} ${ui.bg} ${ui.text} text-xs font-semibold shrink-0 active:scale-95 transition-transform`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {ui.label}
                </button>

                {/* Note toggle */}
                <button
                  onClick={() => setExpandedNote(noteOpen ? null : s.siswa_id)}
                  className={`p-1.5 rounded-md shrink-0 ${s.catatan ? 'text-amber-500' : 'text-slate-300'} hover:bg-white dark:hover:bg-slate-900/50`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Quick status bar (mobile: tap specific status) */}
              <div className="flex border-t border-white/60 divide-x divide-white/60">
                {STATUS_CYCLE.map(st => {
                  const u = STATUS_UI[st]
                  const active = s.status === st
                  return (
                    <button
                      key={st}
                      onClick={() => setStatus(s.siswa_id, st)}
                      className={`flex-1 py-1.5 text-[10px] font-medium text-center transition-colors ${active ? `${u.text} font-bold` : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-400'}`}
                    >
                      {u.label}
                    </button>
                  )
                })}
              </div>

              {/* Note input */}
              {noteOpen && (
                <div className="px-3 py-2 border-t border-white/60">
                  <input
                    type="text"
                    value={s.catatan}
                    onChange={e => setCatatan(s.siswa_id, e.target.value)}
                    placeholder="Catatan (opsional)..."
                    className="w-full text-xs bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-md px-2.5 py-1.5 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Floating autosave status */}
        {siswaList.length > 0 && (
          <div className="fixed bottom-16 left-0 right-0 z-20 p-3 bg-gradient-to-t from-white via-white dark:from-slate-900 dark:via-slate-900 to-transparent pointer-events-none md:bottom-0">
            <div className="max-w-lg mx-auto pointer-events-auto">
              <div className={`flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-xs font-semibold shadow-lg ${
                !isOnline
                  ? 'border-amber-200 bg-amber-50 text-amber-700 shadow-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'
                  : hasChanges || pendingCount > 0 || isSyncing
                    ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
              }`}>
                {!isOnline ? <WifiOff className="h-4 w-4" /> : isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : hasChanges || pendingCount > 0 ? <CloudUpload className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {!isOnline
                  ? 'Tersimpan di perangkat · menunggu koneksi'
                  : isSyncing
                    ? 'Menyinkronkan ke database...'
                    : hasChanges || pendingCount > 0
                      ? 'Tersimpan lokal · autosync maksimal 2 detik'
                      : 'Semua perubahan sudah tersinkron'}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── VIEW: DAFTAR BLOK MENGAJAR ──
  if (blocks.length === 0) return (
    <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-10 text-center">
      <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
      <p className="text-sm text-slate-500 dark:text-slate-400">Tidak ada jadwal mengajar hari ini ({hariNama}).</p>
      {activeExceptions.length > 0 && (
        <p className="mt-2 text-xs text-sky-600">
          Ada pengecualian KBM: {activeExceptions.map(item => `${item.judul} (Jam ke-${item.jam_ke_mulai}-${item.jam_ke_selesai})`).join(', ')}
        </p>
      )}
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Date header */}
      <div className="flex items-center justify-between rounded-lg border bg-white dark:bg-slate-900 dark:bg-slate-800 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-slate-200">
            {hariNama}, {new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{activeBlockCount} kelas wajib diabsen dari {blocks.length} jadwal</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {pesan && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${pesan.tipe === 'sukses' ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {pesan.teks}
        </div>
      )}

      {activeExceptions.length > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-700">
          Pengecualian KBM hari ini: {activeExceptions.map(item => `${item.judul} (Jam ke-${item.jam_ke_mulai}-${item.jam_ke_selesai})`).join(', ')}
        </div>
      )}

      {/* Block cards */}
      {blocks.map(block => (
        <button
          key={block.penugasan_id}
          type="button"
          disabled={block.is_fully_excepted}
          onClick={() => !block.is_fully_excepted && openBlock(block)}
          className={`w-full text-left rounded-lg border p-4 transition-colors ${block.is_fully_excepted ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-80 dark:border-slate-800 dark:bg-slate-900' : 'bg-white hover:border-emerald-300 active:scale-[0.99] dark:bg-slate-900 dark:hover:border-emerald-700'}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-0.5 mb-1">
                <span className="text-base font-bold text-slate-800 dark:text-slate-100">{block.kelas_label}</span>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{block.mapel_nama}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Jadwal jam ke-{block.jadwal_jam_ke_mulai === block.jadwal_jam_ke_selesai ? block.jadwal_jam_ke_mulai : `${block.jadwal_jam_ke_mulai}-${block.jadwal_jam_ke_selesai}`}
                {block.exception_segments.length > 0 && !block.is_fully_excepted && <> &middot; Aktif jam ke-{block.jam_ke_mulai === block.jam_ke_selesai ? block.jam_ke_mulai : `${block.jam_ke_mulai}-${block.jam_ke_selesai}`} ({block.jumlah_jam} JP) &middot; {block.slot_mulai}—{block.slot_selesai}</>}
              </p>
              {block.exception_segments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {block.exception_segments.map(segment => (
                    <p key={`${segment.exception_id}-${segment.jam_ke_mulai}`} className="inline-flex mr-1.5 items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-medium text-sky-700">
                      <Ban className="h-3 w-3" /> Jam ke-{segment.jam_ke_mulai === segment.jam_ke_selesai ? segment.jam_ke_mulai : `${segment.jam_ke_mulai}-${segment.jam_ke_selesai}`} non-KBM: {segment.judul}
                    </p>
                  ))}
                  {!block.is_fully_excepted && <p className="text-[10px] text-emerald-600">Absensi dibuka mulai jam KBM aktif pertama.</p>}
                </div>
              )}
            </div>
            {block.is_fully_excepted ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">
                <Ban className="h-3 w-3" /> Tidak wajib
              </span>
            ) : block.sudah_absen ? (
              <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 font-medium border border-emerald-200 dark:border-emerald-800">
                {block.tidak_hadir > 0 ? `${block.tidak_hadir} tdk hadir` : '✓ Semua hadir'}
              </span>
            ) : (
              <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-medium border border-slate-200 dark:border-slate-800">
                Belum diabsen
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Users className="h-3 w-3 text-slate-400" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{block.total_siswa} siswa</span>
          </div>
        </button>
      ))}
    </div>
  )
}
