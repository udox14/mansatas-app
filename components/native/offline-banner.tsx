// Lokasi: components/native/offline-banner.tsx
'use client'

import { useState, useEffect } from 'react'
import { WifiOff, Wifi, RefreshCw, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface OfflineBannerProps {
  isOffline: boolean
  hasSwUpdate?: boolean
  onReloadSw?: () => void
}

export function OfflineBanner({ isOffline, hasSwUpdate = false, onReloadSw }: OfflineBannerProps) {
  const [showRestored, setShowRestored] = useState(false)
  const [prevOfflineState, setPrevOfflineState] = useState(isOffline)
  const [dismissedUpdate, setDismissedUpdate] = useState(false)

  useEffect(() => {
    // Jika berubah dari offline ke online -> tampilkan banner restored selama 3 detik
    if (prevOfflineState && !isOffline) {
      setShowRestored(true)
      const timer = setTimeout(() => {
        setShowRestored(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
    setPrevOfflineState(isOffline)
  }, [isOffline, prevOfflineState])

  return (
    <div className="fixed top-2 inset-x-0 z-50 pointer-events-none flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {/* Banner 1: Mode Offline */}
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 bg-amber-500/95 dark:bg-amber-600/95 text-white rounded-full shadow-lg backdrop-blur-md text-xs font-medium border border-amber-400/40"
          >
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
            <span>Mode Offline — Menampilkan data tersimpan</span>
          </motion.div>
        )}

        {/* Banner 2: Online Restored */}
        {!isOffline && showRestored && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 bg-emerald-600/95 text-white rounded-full shadow-lg backdrop-blur-md text-xs font-medium border border-emerald-500/40"
          >
            <Wifi className="w-4 h-4 shrink-0" />
            <span>Terhubung kembali ke internet</span>
          </motion.div>
        )}

        {/* Banner 3: Software Update Available */}
        {!isOffline && hasSwUpdate && !dismissedUpdate && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-2.5 bg-indigo-600/95 text-white rounded-full shadow-lg backdrop-blur-md text-xs font-medium border border-indigo-500/40"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
              <span>Versi aplikasi baru tersedia</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  if (onReloadSw) onReloadSw()
                  else window.location.reload()
                }}
                className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-full font-bold text-[11px] transition-colors"
              >
                Muat Ulang
              </button>
              <button
                onClick={() => setDismissedUpdate(true)}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
                title="Tutup"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
