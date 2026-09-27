'use client'

import { useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Camera, Loader2 } from 'lucide-react'

interface CameraProps {
  onCapture: (file: File) => void
  onClose: () => void
}

export function CameraCapture({ onCapture, onClose }: CameraProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [opening, setOpening] = useState(false)

  const openCamera = async () => {
    setError('')
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
      })
      if (!photo.webPath) throw new Error('Foto tidak dapat dibaca. Silakan ambil ulang.')
      const response = await fetch(photo.webPath)
      if (!response.ok) throw new Error('Foto tidak dapat dibaca. Silakan ambil ulang.')
      const blob = await response.blob()
      const format = photo.format === 'png' ? 'png' : 'jpg'
      onCapture(new File([blob], `agenda_${Date.now()}.${format}`, { type: blob.type || `image/${format === 'jpg' ? 'jpeg' : format}` }))
    } catch (cause) {
      // Menutup kamera tanpa mengambil foto tidak perlu menampilkan pesan kesalahan.
      const message = cause instanceof Error ? cause.message : ''
      if (!/cancel|batal|closed/i.test(message)) {
        setError('Kamera tidak dapat dibuka atau foto tidak dapat dibaca. Silakan coba lagi.')
      }
    } finally {
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
          if (file) onCapture(file)
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
