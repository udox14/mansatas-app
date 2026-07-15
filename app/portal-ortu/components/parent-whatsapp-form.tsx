'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ChatCircle as MessageCircle, FloppyDisk as Save, Phone } from '@phosphor-icons/react'
import { updateOwnParentWhatsApp } from '../actions'

export function ParentWhatsAppForm({ initialNumber = '' }: { initialNumber?: string }) {
  const router = useRouter()
  const [nomorWhatsapp, setNomorWhatsapp] = useState(initialNumber || '')
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  const submit = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await updateOwnParentWhatsApp({ nomorWhatsapp })
      if ((res as any).error) {
        setMessage({ text: (res as any).error, error: true })
        return
      }
      setNomorWhatsapp((res as any).nomorWhatsapp || nomorWhatsapp)
      setMessage({ text: (res as any).success || 'Nomor WhatsApp berhasil diperbarui.' })
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-3 items-start">
        <div className="p-2 bg-teal-50 text-teal-700 rounded-lg shrink-0 mt-0.5">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Nomor WhatsApp Orang Tua</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Nomor ini tersimpan di data siswa dan dipakai sekolah untuk menghubungi orang tua/wali bila diperlukan.
          </p>
        </div>
      </div>

      <div className="space-y-3 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1.5">Nomor WhatsApp</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="tel"
              value={nomorWhatsapp}
              onChange={(e) => setNomorWhatsapp(e.target.value)}
              placeholder="Contoh: 081234567890"
              className="h-11 w-full rounded-lg border border-[#D8D4CC] bg-white pl-9 pr-3 text-sm text-[#1A1A18] outline-none transition-colors placeholder:text-[#8B877F] focus:border-[#C2522D] focus:ring-2 focus:ring-[#C2522D]/15"
            />
          </div>
          <p className="mt-2 text-[11px] font-medium text-slate-400">
            Bisa diisi 08..., 628..., atau +628...; sistem akan menyimpan dalam format 62.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex-1 pr-4">
          {message && (
            <span className={`text-xs font-semibold ${message.error ? 'text-rose-600' : 'text-teal-700'}`}>
              {message.text}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#C2522D] px-5 text-sm font-bold text-white transition-colors hover:bg-[#A8421F] disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Menyimpan...' : 'Simpan Nomor'}
        </button>
      </div>
    </div>
  )
}
