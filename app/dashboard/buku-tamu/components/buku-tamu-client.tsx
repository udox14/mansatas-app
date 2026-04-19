'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { simpanEntriTamu } from '../actions'
import type { EntriTamu } from '../actions'
import { cn } from '@/lib/utils'
import {
  User, Building2, Camera, CheckCircle2, Clock, Calendar,
  FileText, Loader2, X, AlertCircle, BookOpen, RotateCcw,
  UserCheck, List,
} from 'lucide-react'

type Kategori = 'INDIVIDU' | 'INSTANSI'

interface Props {
  tamuHariIni: EntriTamu[]
  userRoles: string[]
}

// ─── LIVE CLOCK ───────────────────────────────────────────────
function useLiveClock() {
  const [time, setTime] = useState({ jam: '--:--', tanggal: '', hari: '' })
  useEffect(() => {
    const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
    const hari  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']
    const update = () => {
      const now = new Date(Date.now() + 7 * 3600 * 1000)
      const jam = now.toISOString().substring(11, 16)
      const tgl = now.toISOString().split('T')[0]
      const [y, m, d] = tgl.split('-')
      setTime({
        jam,
        tanggal: `${parseInt(d)} ${bulan[parseInt(m) - 1]} ${y}`,
        hari: hari[new Date(tgl).getDay()],
      })
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

// ─── KAMERA COUNTDOWN ─────────────────────────────────────────
interface CameraProps {
  onCapture: (blob: Blob, contentType: string) => void
  onClose: () => void
}
function CameraCapture({ onCapture, onClose }: CameraProps) {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [captured, setCaptured]   = useState(false)
  const [error, setError]         = useState('')
  const [ready, setReady]         = useState(false)

  useEffect(() => {
    let active = true
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 }, audio: false })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => setReady(true)
        }
      })
      .catch(() => setError('Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.'))
    return () => {
      active = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const startCountdown = useCallback(() => {
    setCountdown(3)
    let count = 3
    const iv = setInterval(() => {
      count--
      if (count <= 0) {
        clearInterval(iv)
        setCountdown(null)
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas) return
        canvas.width  = video.videoWidth  || 640
        canvas.height = video.videoHeight || 480
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(video, 0, 0)
        canvas.toBlob(blob => {
          if (blob) {
            setCaptured(true)
            streamRef.current?.getTracks().forEach(t => t.stop())
            onCapture(blob, 'image/jpeg')
          }
        }, 'image/jpeg', 0.82)
      } else {
        setCountdown(count)
      }
    }, 1000)
  }, [onCapture])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <AlertCircle className="h-10 w-10 text-rose-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
          Tutup
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Video preview — full height */}
      <div className="relative flex-1 rounded-2xl overflow-hidden bg-black min-h-0">
        <video ref={videoRef} autoPlay playsInline muted
          className={cn('w-full h-full object-cover', captured && 'opacity-0')} />
        <canvas ref={canvasRef}
          className={cn('absolute inset-0 w-full h-full object-cover', !captured && 'opacity-0')} />

        {/* Countdown overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-white font-black drop-shadow-[0_0_24px_rgba(0,0,0,0.6)]"
              style={{ fontSize: '6rem', lineHeight: 1 }}>
              {countdown}
            </span>
          </div>
        )}
        {captured && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 gap-2">
            <CheckCircle2 className="h-14 w-14 text-emerald-400 drop-shadow-lg" />
            <span className="text-white font-semibold">Foto berhasil diambil!</span>
          </div>
        )}

        {/* Corner hint */}
        {!captured && ready && countdown === null && (
          <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/50 text-white text-xs font-medium">
            Posisikan wajah di dalam frame
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2 shrink-0">
        {!captured && (
          <button onClick={startCountdown} disabled={!ready || countdown !== null}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all',
              ready && countdown === null
                ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            )}>
            <Camera className="h-4 w-4" />
            {countdown !== null ? `Mengambil... ${countdown}` : ready ? 'Ambil Foto (3 detik)' : 'Memuat kamera...'}
          </button>
        )}
        <button onClick={onClose}
          className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-700 text-slate-600 dark:text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
          <X className="h-4 w-4" />{captured ? 'Tutup' : 'Batal'}
        </button>
      </div>
    </div>
  )
}

// ─── SUCCESS SCREEN ───────────────────────────────────────────
function SuccessScreen({ onNew, onList }: { onNew: () => void; onList: () => void }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-5 text-center max-w-xs">
        <div className="p-5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 dark:bg-emerald-950/40">
          <CheckCircle2 className="h-16 w-16 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 dark:text-slate-100">Terima Kasih!</h2>
          <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            Data kunjungan Anda berhasil dicatat.
          </p>
        </div>
        <div className="flex gap-3 w-full">
          <button onClick={onNew}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-lg shadow-emerald-200 dark:shadow-emerald-900/40 transition-all active:scale-[0.97]">
            <RotateCcw className="h-4 w-4" /> Tamu Baru
          </button>
          <button onClick={onList}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
            <List className="h-4 w-4" /> Lihat Daftar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────
export function BukuTamuClient({ tamuHariIni: initialTamu, userRoles }: Props) {
  const clock = useLiveClock()
  const [view, setView] = useState<'form' | 'list'>('form')

  // Form
  const [kategori, setKategori]         = useState<Kategori>('INDIVIDU')
  const [nama, setNama]                 = useState('')
  const [instansi, setInstansi]         = useState('')
  const [maksudTujuan, setMaksudTujuan] = useState('')

  // Kamera
  const [showCamera, setShowCamera]         = useState(false)
  const [fotoBlob, setFotoBlob]             = useState<Blob | null>(null)
  const [fotoContentType, setFotoContentType] = useState('image/jpeg')
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null)

  // Submit
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const [tamuList, setTamuList] = useState<EntriTamu[]>(initialTamu)

  useEffect(() => {
    return () => { if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl) }
  }, [fotoPreviewUrl])

  const handleCapture = useCallback((blob: Blob, ct: string) => {
    setFotoBlob(blob)
    setFotoContentType(ct)
    setFotoPreviewUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(blob)
    })
    setShowCamera(false)
  }, [])

  const resetFoto = () => {
    if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl)
    setFotoBlob(null)
    setFotoPreviewUrl(null)
  }

  const resetForm = () => {
    setKategori('INDIVIDU'); setNama(''); setInstansi(''); setMaksudTujuan('')
    resetFoto(); setError(''); setSuccess(false); setShowCamera(false)
  }

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      let foto_base64: string | undefined
      if (fotoBlob) {
        const ab = await fotoBlob.arrayBuffer()
        const bytes = new Uint8Array(ab)
        let binary = ''
        bytes.forEach(b => binary += String.fromCharCode(b))
        foto_base64 = btoa(binary)
      }

      const res = await simpanEntriTamu({
        kategori,
        nama:     kategori === 'INDIVIDU' ? nama     : undefined,
        instansi: kategori === 'INSTANSI' ? instansi : undefined,
        maksud_tujuan: maksudTujuan,
        foto_base64,
        foto_content_type: fotoBlob ? fotoContentType : undefined,
      })

      if (res.error) { setError(res.error); setLoading(false); return }

      // Tambah ke list live
      const now = new Date(Date.now() + 7 * 3600 * 1000)
      const baru: EntriTamu = {
        id: res.id!, tanggal: now.toISOString().split('T')[0],
        waktu: now.toISOString().substring(11, 16), kategori,
        nama: kategori === 'INDIVIDU' ? nama : null,
        instansi: kategori === 'INSTANSI' ? instansi : null,
        maksud_tujuan: maksudTujuan,
        foto_url: fotoPreviewUrl,
        dicatat_oleh: null, pencatat_nama: null, created_at: now.toISOString(),
      }
      setTamuList(prev => [baru, ...prev])
      setSuccess(true)
      setLoading(false)
      setTimeout(resetForm, 5000)
    } catch { setError('Terjadi kesalahan. Coba lagi.'); setLoading(false) }
  }

  // ─── LAYOUT LANDSCAPE ─────────────────────────────────────────
  // Kolom kiri (55%): form input
  // Kolom kanan (45%): kamera / foto preview / daftar hari ini
  // Header: strip tipis di atas, full-width

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">

      {/* ── TOP HEADER STRIP ────────────────────────────────────── */}
      <div className="shrink-0 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-6 py-3 mb-4 flex items-center justify-between text-white shadow-lg shadow-indigo-200/40 dark:shadow-indigo-900/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900/10">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="font-black text-base leading-tight">Buku Tamu</p>
            <p className="text-indigo-200 text-xs">{clock.hari}, {clock.tanggal}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Tab switcher */}
          <div className="flex gap-1 p-0.5 bg-white dark:bg-slate-900/10 rounded-lg">
            {[
              { id: 'form', label: 'Form Kunjungan', icon: FileText },
              { id: 'list', label: `Hari Ini (${tamuList.length})`, icon: List },
            ].map(t => (
              <button key={t.id} onClick={() => setView(t.id as any)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                  view === t.id ? 'bg-white dark:bg-slate-900 text-violet-700 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white dark:hover:bg-slate-900/10'
                )}>
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
          {/* Jam */}
          <div className="text-right">
            <div className="text-2xl font-black tabular-nums leading-none">{clock.jam}</div>
          </div>
        </div>
      </div>

      {/* ── MAIN 2-COLUMN BODY ──────────────────────────────────── */}
      {view === 'form' ? (
        success ? (
          <SuccessScreen onNew={resetForm} onList={() => { resetForm(); setView('list') }} />
        ) : (
          <div className="flex gap-4 items-start">

            {/* ── KOLOM KIRI: FORM ── */}
            <div className="w-[52%] flex flex-col gap-3">
              <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #a78bfa80; border-radius: 99px }
              `}</style>

              {/* Kategori */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Kategori Tamu</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    { value: 'INDIVIDU', label: 'Individu', sub: 'Perorangan', icon: User, c: 'violet' },
                    { value: 'INSTANSI', label: 'Instansi', sub: 'Lembaga / Organisasi', icon: Building2, c: 'blue' },
                  ] as const).map(opt => (
                    <button key={opt.value}
                      onClick={() => { setKategori(opt.value); setNama(''); setInstansi('') }}
                      className={cn(
                        'flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-200',
                        kategori === opt.value
                          ? opt.c === 'violet'
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                            : 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-800 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-700 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                      )}>
                      <div className={cn(
                        'p-2.5 rounded-xl shrink-0',
                        kategori === opt.value
                          ? opt.c === 'violet' ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-800 text-slate-400'
                      )}>
                        <opt.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className={cn('font-bold text-sm leading-tight',
                          kategori === opt.value
                            ? opt.c === 'violet' ? 'text-violet-700 dark:text-violet-300' : 'text-blue-700 dark:text-blue-300'
                            : 'text-slate-700 dark:text-slate-300'
                        )}>{opt.label}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5 truncate">{opt.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nama / Instansi + Tujuan */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3.5">
                {kategori === 'INDIVIDU' ? (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Nama Lengkap</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input type="text" value={nama} onChange={e => setNama(e.target.value)}
                        placeholder="Masukkan nama lengkap tamu..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-50 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Nama Instansi</label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input type="text" value={instansi} onChange={e => setInstansi(e.target.value)}
                        placeholder="Nama instansi atau lembaga..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-50 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Maksud &amp; Tujuan</label>
                  <textarea value={maksudTujuan} onChange={e => setMaksudTujuan(e.target.value)}
                    placeholder="Jelaskan keperluan atau tujuan kunjungan Anda..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-50 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition resize-none" />
                </div>
              </div>

              {/* Error + Submit */}
              {error && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />{error}
                </div>
              )}

              <button onClick={handleSubmit} disabled={loading}
                className={cn(
                  'w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-base transition-all duration-200',
                  loading
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-xl shadow-violet-200/50 dark:shadow-violet-900/30 active:scale-[0.98]'
                )}>
                {loading
                  ? <><Loader2 className="h-5 w-5 animate-spin" /> Menyimpan...</>
                  : <><CheckCircle2 className="h-5 w-5" /> Simpan Data Kunjungan</>
                }
              </button>
            </div>

            {/* ── KOLOM KANAN: KAMERA / FOTO ── */}
            <div className="flex-1 self-stretch flex flex-col">
              {showCamera ? (
                <CameraCapture onCapture={handleCapture} onClose={() => setShowCamera(false)} />
              ) : fotoPreviewUrl ? (
                /* Foto sudah diambil */
                <div className="flex flex-col h-full gap-3">
                  <div className="relative flex-1 rounded-2xl overflow-hidden bg-black min-h-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fotoPreviewUrl} alt="Foto tamu" className="w-full h-full object-cover" />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Foto siap
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setShowCamera(true)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                      <RotateCcw className="h-4 w-4" /> Ambil Ulang
                    </button>
                    <button onClick={resetFoto}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-sm font-semibold hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-all">
                      <X className="h-4 w-4" /> Hapus
                    </button>
                  </div>
                </div>
              ) : (
                /* Prompt aktifkan kamera */
                <div className="flex flex-col h-full rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 dark:border-slate-700 overflow-hidden">
                  <button onClick={() => setShowCamera(true)}
                    className="flex-1 flex flex-col items-center justify-center gap-4 hover:bg-violet-50 dark:hover:bg-violet-950/10 hover:border-violet-400 dark:hover:border-violet-500 transition-all group">
                    <div className="p-5 rounded-full bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-800 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 transition-colors">
                      <Camera className="h-10 w-10 text-slate-300 dark:text-slate-600 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors" />
                    </div>
                    <div className="text-center px-4">
                      <p className="font-bold text-slate-500 dark:text-slate-400 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                        Foto Tamu (Opsional)
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                        Klik untuk mengaktifkan kamera.<br />Foto diambil otomatis dalam 3 detik.
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

          </div>
        )
      ) : (
        /* ── VIEW: DAFTAR HARI INI ── */
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 4px }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #a78bfa80; border-radius: 99px }
          `}</style>
          {tamuList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="p-5 rounded-full bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-800">
                <UserCheck className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-600 dark:text-slate-400">Belum ada tamu hari ini</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                  Data kunjungan akan muncul di sini.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 content-start">
              {tamuList.map((tamu, i) => (
                <div key={tamu.id}
                  className="flex gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-shadow">
                  {/* Foto / Icon */}
                  <div className="shrink-0">
                    {tamu.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tamu.foto_url} alt="foto" className="w-14 h-14 rounded-xl object-cover" />
                    ) : (
                      <div className={cn(
                        'w-14 h-14 rounded-xl flex items-center justify-center',
                        tamu.kategori === 'INDIVIDU' ? 'bg-violet-50 dark:bg-violet-950/30' : 'bg-blue-50 dark:bg-blue-950/30'
                      )}>
                        {tamu.kategori === 'INDIVIDU'
                          ? <User className="h-6 w-6 text-violet-400" />
                          : <Building2 className="h-6 w-6 text-blue-400" />
                        }
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-bold text-slate-900 dark:text-slate-50 dark:text-slate-100 text-sm truncate leading-tight">
                        {tamu.nama || tamu.instansi || '—'}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0">#{tamuList.length - i}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 mb-1.5">
                      <span className={cn(
                        'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full',
                        tamu.kategori === 'INDIVIDU'
                          ? 'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                          : 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                      )}>{tamu.kategori}</span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />{tamu.waktu}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {tamu.maksud_tujuan}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
