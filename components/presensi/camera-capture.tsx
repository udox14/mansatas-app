'use client'

import { useRef, useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Camera, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'


export function CameraCapture({ onCapture, onClose }: { onCapture: (file: File) => void, onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [countdown, setCountdown] = useState<number | null>(3)
  const [error, setError] = useState<string | null>(null)
  const [captured, setCaptured] = useState(false)
  const [isVideoReady, setIsVideoReady] = useState(false)

  // Start Camera
  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user', 
            width: { ideal: 1280 }, 
            height: { ideal: 960 } 
          } 
        })
        setStream(s)
        if (videoRef.current) {
          videoRef.current.srcObject = s
          // Explicitly call play to ensure it starts
          videoRef.current.play().catch(e => console.error("Play error:", e))
        }
      } catch (err: any) {
        console.error('Camera error:', err)
        setError('Gagal mengakses kamera. Mohon berikan izin akses kamera di browser Anda.')
      }
    }
    startCamera()
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  // Auto Countdown Logic
  useEffect(() => {
    // Only start countdown if stream is active AND video is actually playing/ready
    if (stream && isVideoReady && countdown !== null && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (stream && isVideoReady && countdown === 0 && !captured) {
      capturePhoto()
    }
  }, [stream, isVideoReady, countdown])

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || captured || !isVideoReady) return

    
    // Safety check: video must have dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.warn("Video not ready for capture, dimensions 0")
      // Force ready state to try capturing anyway after a slight delay
      setTimeout(capturePhoto, 300)
      return
    }


    setCaptured(true)
    
    // Target resolution: 800x600 (approx 4:3)
    const targetWidth = 800
    const ratio = video.videoHeight / video.videoWidth
    const targetHeight = targetWidth * ratio
    
    canvas.width = targetWidth
    canvas.height = targetHeight

    const ctx = canvas.getContext('2d')
    if (ctx) {
      try {
        // Mirror horizontal to match preview
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `presensi_${Date.now()}.jpg`, { type: 'image/jpeg' })
            onCapture(file)
          } else {
            console.error("Canvas toBlob returned null")
            setError("Gagal memproses foto. Silakan coba lagi.")
            setCaptured(false)
          }
        }, 'image/jpeg', 0.85) // 85% quality for "sedikit lebih bagus"
      } catch (err: any) {
        console.error("Canvas draw error:", err)
        setError("Gagal merender foto. Silakan coba lagi.")
        setCaptured(false)
      }
    } else {
      setError("Gagal menginisialisasi context kamera.")
      setCaptured(false)
    }
  }



  return (
    <Dialog open onOpenChange={(o) => { if (!o && !captured) onClose() }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none bg-transparent shadow-none flex items-center justify-center">
        <div className="relative w-[320px] sm:w-[480px] aspect-[3/4] bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border-[6px] border-white/10 ring-1 ring-white/5 flex items-center justify-center">
          {/* CAMERA VIEWPORT */}
          {error ? (
            <div className="p-8 text-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-rose-500/20 rounded-2xl flex items-center justify-center mx-auto ring-1 ring-rose-500/30">
                <Camera className="h-8 w-8 text-rose-500" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-white">Oops! Kamera Error</h3>
                <p className="text-xs text-slate-400 leading-relaxed max-w-[200px] mx-auto">{error}</p>
              </div>
              <Button onClick={onClose} variant="secondary" className="h-9 px-6 text-xs font-bold rounded-xl bg-white text-slate-900 hover:bg-slate-100 transition-all">
                Ganti Metode / Tutup
              </Button>
            </div>
          ) : (
            <>
              {/* LIVE PREVIEW (Always Rendered Behind Loading State) */}
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                onLoadedMetadata={() => {
                  console.log("Video metadata loaded")
                  setIsVideoReady(true)
                }}
                onCanPlay={() => {
                  console.log("Video can play")
                  setIsVideoReady(true)
                }}

                className={cn(
                  "absolute inset-0 w-full h-full object-cover -scale-x-100 transition-opacity duration-300",
                  isVideoReady ? "opacity-100" : "opacity-0"
                )}
              />

              {!isVideoReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white font-sans bg-slate-900 z-10">
                  <div className="relative">
                    <Loader2 className="h-10 w-10 animate-spin text-teal-400/50" />
                    <Camera className="h-4 w-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-teal-400" />
                  </div>
                  <div className="text-center font-sans">
                    <p className="text-xs font-semibold text-teal-400/80 uppercase tracking-widest animate-pulse">Initializing</p>
                    <p className="text-[10px] text-slate-500 italic mt-0.5">Membuka kamera depan...</p>
                  </div>
                </div>
              )}
              
              {/* OVERLAY: SCANNING EFFECT */}

              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-[10%] border-2 border-white/20 rounded-3xl" />
                <div className="absolute top-[20px] left-1/2 -translate-x-1/2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-1.5 whitespace-nowrap">
                  <Sparkles className="h-3 w-3 text-teal-400" />
                  <span className="text-[9px] font-bold text-white uppercase tracking-wider">Face Recognition Active</span>
                </div>
              </div>

              {/* COUNTDOWN OVERLAY */}
              {isVideoReady && countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 backdrop-blur-[2px] transition-all z-20">
                  <div className="relative flex items-center justify-center h-32 w-32">
                    <div className="absolute inset-0 border-4 border-teal-400/30 rounded-full animate-ping" />
                    <div className="absolute inset-4 border-2 border-teal-400/40 rounded-full animate-ping [animation-delay:200ms]" />
                    <span className="text-8xl font-black text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] animate-in zoom-in duration-300">
                      {countdown}
                    </span>
                  </div>
                  <p className="mt-8 text-xs font-bold text-white uppercase tracking-[0.2em] drop-shadow-md">Stay Position...</p>
                </div>
              )}


              {/* UPLOADING STATE */}
              {captured && (
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500 z-30">
                  <div className="relative">
                    <div className="h-16 w-16 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
                    <Camera className="h-6 w-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-teal-400" />

                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white tracking-wide">Processing Photo</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Uploading to Cloud...</p>
                  </div>
                </div>
              )}
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
