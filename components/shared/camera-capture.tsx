'use client'

import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Camera, Loader2 } from 'lucide-react'
import { photoToFile } from '@/lib/agenda-draft'

interface CameraProps {
  onCapture: (file: File) => void | Promise<void>
  onClose: () => void
  onBeforeOpen?: () => void
  onFinished?: () => void
}

export function CameraCapture({ onCapture, onClose, onBeforeOpen, onFinished }: CameraProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    const input = inputRef.current
    const cancelled = () => {
      setError('Pengambilan foto dibatalkan. Agenda belum dikirim; buka kamera untuk melanjutkan.')
      onFinished?.()
    }
    input?.addEventListener('cancel', cancelled)
    return () => input?.removeEventListener('cancel', cancelled)
  }, [onFinished])

  const openCamera = async () => {
    setError('')
    try { onBeforeOpen?.() } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Draft gagal disimpan. Kamera belum dibuka; coba lagi.')
      return
    }
    // Browser membutuhkan klik input saat aktivasi pengguna masih berlangsung.
    if (!Capacitor.isNativePlatform()) {
      inputRef.current?.click()
      return
    }
    setOpening(true)
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
      const photo = await Camera.getPhoto({
        quality: 85,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        allowEditing: false,
        width: 1600,
        height: 1600,
      })
      await onCapture(await photoToFile(photo))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : typeof cause === 'object' && cause && 'message' in cause ? String(cause.message) : ''
      setError(/cancel|batal|closed/i.test(message)
        ? 'Pengambilan foto dibatalkan. Agenda belum dikirim; buka kamera untuk melanjutkan.'
        : `Kamera atau pembacaan foto gagal${message ? `: ${message}` : '.'} Materi tetap disimpan; periksa izin kamera lalu coba lagi.`)
    } finally {
      onFinished?.()
      setOpening(false)
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Ambil foto kegiatan"
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) void Promise.resolve(onCapture(file)).catch(cause => setError(cause instanceof Error ? cause.message : 'Foto gagal diproses. Ambil ulang foto.'))
          else setError('Tidak ada foto yang diambil. Agenda belum dikirim.')
          onFinished?.()
          event.target.value = ''
        }}
      />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Kamera bawaan ponsel menyediakan pilihan lensa yang tersedia di perangkat. Foto akan langsung mengirim agenda.
      </p>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-rose-700" role="alert">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" onClick={openCamera} disabled={opening} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700">
          {opening ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
          Buka Kamera
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={opening}>Batal</Button>
      </div>
    </div>
  )
}
