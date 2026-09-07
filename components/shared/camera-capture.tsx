'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Camera, Loader2, SwitchCamera } from 'lucide-react'
interface CameraProps {
  onCapture: (file: File) => void
  onClose: () => void
}

export function CameraCapture({ onCapture, onClose }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  useEffect(() => {
    let active = true
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }

    (navigator.mediaDevices ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices) : () => Promise.reject(new Error('Kamera tidak tersedia')))
      ({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => setReady(true)
        }
      })
      .catch(() => setError('Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan di browser Anda.'))
    return () => {
      active = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [facingMode])

  const capture = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (blob) {
        streamRef.current?.getTracks().forEach(t => t.stop())
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' })
        onCapture(file)
      }
    }, 'image/jpeg', 0.85)
  }, [onCapture])

  const handleFallbackUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onCapture(file)
    }
  }, [onCapture])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-rose-50 rounded-lg border border-rose-200 text-center mt-1">
        <AlertTriangle className="h-8 w-8 text-rose-500 mb-2" />
        <p className="text-sm text-rose-700">{error}</p>
        <div className="mt-4 w-full flex flex-col gap-2">
          <Label htmlFor="fallback-camera" className="cursor-pointer flex items-center justify-center gap-2 py-2 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors">
            <Camera className="h-4 w-4" /> Buka Aplikasi Kamera
          </Label>
          <input 
            id="fallback-camera" 
            type="file" 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            onChange={handleFallbackUpload} 
          />
          <Button variant="outline" onClick={onClose} className="w-full">Batal</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 mt-1">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
        {!ready && <Loader2 className="h-8 w-8 text-slate-400 animate-spin absolute" />}
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={capture} disabled={!ready} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Camera className="h-4 w-4 mr-2" /> Ambil Foto
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => { setReady(false); setError(''); setFacingMode(prev => prev === 'environment' ? 'user' : 'environment') }} title="Ganti Kamera" className="shrink-0">
          <SwitchCamera className="h-4 w-4 text-slate-700 dark:text-slate-300" />
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Batal
        </Button>
      </div>
    </div>
  )
}

