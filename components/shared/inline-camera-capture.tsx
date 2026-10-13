'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { captureBrowserPhoto, openBrowserCamera } from '@/lib/browser-camera'

export function InlineCameraCapture({ onCapture, onClose }: {
  onCapture: (file: File) => void | Promise<void>
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const busyRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let stream: MediaStream | undefined
    setReady(false)
    setError('')
    const timer = setTimeout(() => {
      if (!active) return
      active = false
      stream?.getTracks().forEach(track => track.stop())
      setReady(false)
      setError('Gambar kamera belum tampil. Periksa izin kamera lalu coba lagi.')
    }, 25_000)
    void openBrowserCamera().then(result => {
      if (!active) { result.getTracks().forEach(track => track.stop()); return }
      stream = result
      streamRef.current = result
      if (videoRef.current) videoRef.current.srcObject = result
    }).catch(cause => {
      if (!active) return
      clearTimeout(timer)
      setError(cause instanceof Error && cause.name !== 'NotAllowedError'
        ? cause.message : 'Izin kamera belum diberikan. Izinkan akses kamera di pengaturan aplikasi atau browser lalu coba lagi.')
    })
    const video = videoRef.current
    const loaded = () => {
      if (!active || !video?.videoWidth || !video.videoHeight) return
      clearTimeout(timer)
      setReady(true)
    }
    video?.addEventListener('loadeddata', loaded)
    return () => {
      active = false
      clearTimeout(timer)
      video?.removeEventListener('loadeddata', loaded)
      stream?.getTracks().forEach(track => track.stop())
      if (video) video.srcObject = null
      streamRef.current = null
    }
  }, [attempt])

  const capture = async () => {
    if (busyRef.current || !ready || !videoRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const file = await captureBrowserPhoto(videoRef.current)
      await onCapture(file)
      streamRef.current?.getTracks().forEach(track => track.stop())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Foto gagal diproses. Coba ambil foto lagi.')
    } finally { busyRef.current = false; setBusy(false) }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Kamera di halaman menggunakan lensa yang tersedia di browser. Ambil foto untuk melanjutkan pengiriman.</p>
      <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" aria-label="Preview kamera kegiatan" />
        {!ready && !error && <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-white" />}
      </div>
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={capture} disabled={!ready || busy} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />} Ambil Foto
        </Button>
        {error && !ready && <Button type="button" variant="outline" onClick={() => setAttempt(value => value + 1)}>Coba Lagi</Button>}
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Batal</Button>
      </div>
    </div>
  )
}
