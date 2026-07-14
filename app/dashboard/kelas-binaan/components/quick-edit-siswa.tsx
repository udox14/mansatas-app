'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Loader2, Save } from 'lucide-react'
import { updateStudentQuickDataFromKelasBinaan } from '../actions'

export const DOMISILI_OPTIONS = [
  'Pesantren Sukamanah',
  'Pesantren Sukahideng',
  'Pesantren Sukaguru',
  "Pesantren Al-Ma'mur",
  'Warga Desa Sukarapih',
  'Warga Desa Wargakerta',
  'KELUAR DARI PESANTREN',
] as const

export function QuickEditSiswa({
  siswaId,
  initialTempatTinggal,
  initialPhone,
  className = '',
}: {
  siswaId: string
  initialTempatTinggal: string | null
  initialPhone: string | null
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tempatTinggal, setTempatTinggal] = useState(initialTempatTinggal || '')
  const [phone, setPhone] = useState(initialPhone || '')
  const [savedValue, setSavedValue] = useState({
    tempatTinggal: initialTempatTinggal || '',
    phone: initialPhone || '',
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const isLegacyValue = Boolean(tempatTinggal && !DOMISILI_OPTIONS.includes(tempatTinggal as (typeof DOMISILI_OPTIONS)[number]))
  const isViolation = tempatTinggal === 'KELUAR DARI PESANTREN'
  const hasChanges = tempatTinggal !== savedValue.tempatTinggal || phone !== savedValue.phone

  function save() {
    setMessage(null)
    startTransition(async () => {
      const result = await updateStudentQuickDataFromKelasBinaan({
        siswaId,
        tempatTinggal,
        nomorWhatsapp: phone,
      })

      if (result.error) {
        setMessage({ type: 'error', text: result.error })
        return
      }

      const nextPhone = result.nomorWhatsapp || ''
      setPhone(nextPhone)
      setSavedValue({ tempatTinggal, phone: nextPhone })
      setMessage({ type: 'success', text: result.success || 'Data berhasil disimpan.' })
      router.refresh()
    })
  }

  return (
    <div className={`rounded-lg border p-3 ${isViolation ? 'border-rose-300 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/20' : 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/10'} ${className}`}>
      <div className="grid gap-2.5 lg:grid-cols-[minmax(220px,1.2fr)_minmax(190px,1fr)_auto] lg:items-end">
        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Status Domisili / Pesantren</span>
          <select
            value={tempatTinggal}
            onChange={event => {
              setTempatTinggal(event.target.value)
              setMessage(null)
            }}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="" disabled>Pilih domisili...</option>
            {isLegacyValue ? <option value={tempatTinggal}>{tempatTinggal} (data lama)</option> : null}
            {DOMISILI_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">WhatsApp Orang Tua</span>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={event => {
              setPhone(event.target.value)
              setMessage(null)
            }}
            placeholder="08... / 628..."
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </label>

        <button
          type="button"
          onClick={save}
          disabled={isPending || !hasChanges || !tempatTinggal}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-amber-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {isPending ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>

      {isViolation ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Flag pelanggaran: siswa tercatat keluar dari pesantren.
        </p>
      ) : null}
      {message ? (
        <p className={`mt-2 flex items-center gap-1.5 text-[11px] ${message.type === 'error' ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
          {message.type === 'error' ? <AlertTriangle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
