'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, HelpCircle } from 'lucide-react'

// ======================================================================
// 1. FUNGSI CONFIRM CUSTOM (Berbasis Promise Asinkron)
// Pengganti window.confirm bawaan browser
// ======================================================================
export let globalConfirmResolve: ((value: boolean) => void) | null = null;

export const confirmDialog = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    globalConfirmResolve = resolve;
    window.dispatchEvent(new CustomEvent('mansatas-confirm', { detail: { message } }));
  });
};

// ======================================================================
// 2. GLOBAL PROVIDER (Penyihir UI)
// ======================================================================
export function GlobalAlertProvider() {
  const [toasts, setToasts] = useState<{id: number, type: string, msg: string}[]>([])
  const [confirmState, setConfirmState] = useState<{isOpen: boolean, msg: string}>({isOpen: false, msg: ''})

  useEffect(() => {
    // SULAP 1: OVERRIDE WINDOW.ALERT BAWAAN BROWSER 
    // Mengubah semua alert() di seluruh aplikasi menjadi Toast melayang
    const originalAlert = window.alert
    window.alert = (msg: string) => {
      const lower = msg.toLowerCase()
      let type = 'info'
      
      // Deteksi pintar otomatis dari isi pesan
      if (lower.includes('gagal') || lower.includes('error') || lower.includes('peringatan') || lower.includes('wajib') || lower.includes('tidak bisa')) {
        type = 'error'
      } else if (lower.includes('berhasil') || lower.includes('sukses')) {
        type = 'success'
      }

      const id = Date.now()
      setToasts(prev => [...prev, { id, type, msg }])
      
      // Hilang otomatis setelah 4 detik
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
    }

    // SULAP 2: LISTENER UNTUK CONFIRM DIALOG
    const handleConfirm = (e: any) => {
      setConfirmState({ isOpen: true, msg: e.detail.message })
    }
    window.addEventListener('mansatas-confirm', handleConfirm)

    return () => {
      window.alert = originalAlert
      window.removeEventListener('mansatas-confirm', handleConfirm)
    }
  }, [])

  const handleConfirmResult = (result: boolean) => {
    setConfirmState({ isOpen: false, msg: '' })
    if (globalConfirmResolve) globalConfirmResolve(result)
  }

  return (
    <>
      {/* TOAST CONTAINER (Melayang di atas tengah) */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none w-full max-w-md px-4">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-start gap-3 p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border backdrop-blur-xl pointer-events-auto animate-in slide-in-from-top-4 fade-in duration-300 ${
            t.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800' :
            t.type === 'error' ? 'bg-rose-50/95 border-rose-200 text-rose-800' :
            'bg-blue-50/95 border-blue-200 text-blue-800'
          }`}>
            {t.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />}
            {t.type === 'error' && <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />}
            {t.type === 'info' && <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />}
            <span className="font-semibold text-sm leading-snug">{t.msg}</span>
          </div>
        ))}
      </div>

      {/* CONFIRM DIALOG CONTAINER (Tengah Layar) */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-surface w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mb-4 ring-4 ring-amber-50">
                <HelpCircle className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Konfirmasi Tindakan</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                {confirmState.msg}
              </p>
            </div>
            <div className="flex bg-surface-2 p-4 gap-3 border-t border-surface-2">
              <button 
                onClick={() => handleConfirmResult(false)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 dark:text-slate-600 bg-surface border border-surface hover:bg-surface-3 transition-colors shadow-sm"
              >
                Batal
              </button>
              <button 
                onClick={() => handleConfirmResult(true)}
                className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md transition-all"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}