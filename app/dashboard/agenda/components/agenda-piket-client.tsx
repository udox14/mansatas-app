// Lokasi: app/dashboard/agenda/components/agenda-piket-client.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Camera, CheckCircle2, Clock, XCircle, AlertTriangle,
  Loader2, ShieldCheck, Send, RefreshCw, UserCheck,
} from 'lucide-react'
import { submitAgendaPiket, getJadwalPiketHariIni } from '../actions-piket'
import type { PiketShiftData } from '../actions-piket'

interface AgendaPiketClientProps {
  initialData: {
    error: string | null
    shifts: PiketShiftData[]
    tanggal: string
    hari: number
  }
  isActingAs?: boolean
}

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  HADIR:    { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: CheckCircle2, label: 'Hadir' },
  TELAT:    { bg: 'bg-amber-50 border-amber-200',    text: 'text-amber-700',   icon: Clock,         label: 'Telat' },
  ALFA:     { bg: 'bg-red-50 border-red-200',        text: 'text-red-700',     icon: XCircle,       label: 'Alfa' },
  SAKIT:    { bg: 'bg-blue-50 border-blue-200',      text: 'text-blue-700',    icon: AlertTriangle, label: 'Sakit' },
  IZIN:     { bg: 'bg-sky-50 border-sky-200',        text: 'text-sky-700',     icon: AlertTriangle, label: 'Izin' },
}

const HARI_NAMA = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

// ============================================================
// COMPRESS IMAGE — target < 500KB, WebP preferred
// ============================================================
async function compressImage(file: File, maxWidth = 1280, quality = 0.75): Promise<File> {
  return new Promise((resolve) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width
      let h = img.height
      if (w > maxWidth) { h = Math.round(h * (maxWidth / w)); w = maxWidth }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          const compressed = new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' })
          if (compressed.size > 1024 * 1024 && quality > 0.3) {
            canvas.toBlob(
              (blob2) => {
                if (!blob2) { resolve(compressed); return }
                resolve(new File([blob2], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' }))
              },
              'image/webp', 0.4
            )
          } else {
            resolve(compressed)
          }
        },
        'image/webp', quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

export function AgendaPiketClient({ initialData, isActingAs = false }: AgendaPiketClientProps) {
  const [data, setData] = useState(initialData)
  const [expandedShift, setExpandedShift] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'sukses' | 'error'; teks: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    const result = await getJadwalPiketHariIni()
    setData(result)
    setIsRefreshing(false)
  }

  const handleFotoCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPesan(null)
    const compressed = await compressImage(file)
    setFotoFile(compressed)
    setFotoPreview(URL.createObjectURL(compressed))
  }, [])

  const handleSubmit = async (shift: PiketShiftData) => {
    if (!fotoFile && !isActingAs) {
      setPesan({ tipe: 'error', teks: 'Foto wajib diambil sebagai bukti kehadiran.' })
      return
    }
    setIsSubmitting(true); setPesan(null)

    const fd = new FormData()
    fd.append('jadwal_id', shift.jadwal_id)
    fd.append('shift_id', String(shift.shift_id))
    fd.append('tanggal', data.tanggal)
    fd.append('slot_mulai', shift.slot_mulai)
    fd.append('slot_selesai', shift.slot_selesai)
    if (fotoFile) fd.append('foto', fotoFile)

    const result = await submitAgendaPiket(fd)
    if (result.error) {
      setPesan({ tipe: 'error', teks: result.error })
    } else {
      setPesan({ tipe: 'sukses', teks: result.success || 'Berhasil!' })
      setFotoFile(null); setFotoPreview(null); setExpandedShift(null)
      handleRefresh()
    }
    setIsSubmitting(false)
  }

  const { shifts, tanggal, hari, error } = data

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
        <p className="text-sm text-amber-700">{error}</p>
      </div>
    )
  }

  if (hari === 7) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
        <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Hari Minggu — tidak ada jadwal piket.</p>
      </div>
    )
  }

  if (shifts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
        <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Tidak ada jadwal piket hari ini ({HARI_NAMA[hari]}).</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header Info */}
      <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-700">
            {HARI_NAMA[hari]},{' '}
            {new Date(tanggal + 'T00:00:00').toLocaleDateString('id-ID', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
          <p className="text-xs text-slate-500">{shifts.length} shift piket</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Pesan global */}
      {pesan && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${pesan.tipe === 'sukses' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {pesan.teks}
        </div>
      )}

      {/* Shift Cards */}
      {shifts.map((shift) => {
        const isExpanded = expandedShift === shift.jadwal_id
        const style = STATUS_STYLE[shift.status || 'ALFA'] || STATUS_STYLE.ALFA
        const StatusIcon = style.icon

        return (
          <div key={shift.jadwal_id} className="rounded-lg border bg-white overflow-hidden">
            {/* Card Header */}
            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">{shift.shift_nama}</span>
                  <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                    Guru Piket
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Jam ke-{shift.jam_mulai} s/d {shift.jam_selesai}
                  {' '}·{' '}
                  {shift.slot_mulai !== '??:??' ? `${shift.slot_mulai} — ${shift.slot_selesai}` : 'Waktu belum dikonfigurasi'}
                </p>
              </div>

              {shift.sudah_isi ? (
                <div className="flex flex-col items-end gap-1">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.text}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {style.label}
                  </div>
                  {shift.waktu_submit && (
                    <span className="text-[10px] text-slate-400">
                      {new Date(shift.waktu_submit).toLocaleTimeString('id-ID', {
                        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
                      })} WIB
                    </span>
                  )}
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setExpandedShift(isExpanded ? null : shift.jadwal_id)
                    setFotoFile(null); setFotoPreview(null); setPesan(null)
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs"
                >
                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                  Isi Kehadiran
                </Button>
              )}
            </div>

            {/* Preview foto jika sudah isi */}
            {shift.sudah_isi && shift.foto_url && (
              <div className="border-t px-4 pb-3 pt-2">
                <p className="text-[11px] text-slate-400 mb-1.5">Foto Kehadiran</p>
                <img
                  src={shift.foto_url}
                  alt="Foto kehadiran piket"
                  className="w-full max-h-40 object-cover rounded-lg border"
                />
              </div>
            )}

            {/* Expanded Form */}
            {isExpanded && !shift.sudah_isi && (
              <div className="border-t bg-slate-50/50 px-4 py-4 space-y-4">
                {/* Info shift (readonly) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500">Shift</Label>
                    <p className="text-sm font-medium text-slate-700">{shift.shift_nama}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Waktu</Label>
                    <p className="text-sm font-medium text-slate-700">
                      {shift.slot_mulai !== '??:??' ? `${shift.slot_mulai} — ${shift.slot_selesai}` : `Jam ke-${shift.jam_mulai} s/d ${shift.jam_selesai}`}
                    </p>
                  </div>
                </div>

                {/* Foto (camera only) */}
                <div>
                  <Label className="text-xs text-slate-600 font-medium">
                    Foto Kehadiran <span className="text-red-500">*</span>
                    <span className="text-slate-400 font-normal ml-1">(wajib, kamera saja)</span>
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
                      className="mt-1 w-full flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-slate-300 bg-white hover:border-teal-400 hover:bg-teal-50/50 transition-colors"
                    >
                      <Camera className="h-8 w-8 text-slate-400" />
                      <span className="text-sm text-slate-500">Ketuk untuk membuka kamera</span>
                      <span className="text-xs text-slate-400">Foto akan tercatat sebagai bukti kehadiran</span>
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

                {/* Waktu otomatis — info */}
                <div className="text-[11px] text-slate-500 bg-slate-100 rounded-lg px-3 py-2">
                  ⏱ Waktu submit akan dicatat otomatis saat Anda klik kirim.
                </div>

                {/* Notice act-as */}
                {isActingAs && (
                  <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚠️ Input atas nama guru. Validasi waktu di-skip, foto opsional.
                  </div>
                )}

                {/* Submit */}
                <Button
                  onClick={() => handleSubmit(shift)}
                  disabled={isSubmitting || (!fotoFile && !isActingAs)}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mengirim...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Catat Kehadiran</>
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
