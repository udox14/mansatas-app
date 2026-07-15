'use client'

import { useState, useTransition } from 'react'
import { changeOwnParentPassword } from '../actions'
import { Key, ShieldCheck } from '@phosphor-icons/react'

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  const submit = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await changeOwnParentPassword({ currentPassword, newPassword, confirmPassword })
      if ((res as any).error) setMessage({ text: (res as any).error, error: true })
      else {
        setMessage({ text: (res as any).success || 'Password berhasil diperbarui.' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    })
  }

  const InputClass = "h-11 w-full rounded-lg border border-[#D8D4CC] bg-white px-3 text-sm text-[#1A1A18] outline-none transition-colors placeholder:text-[#8B877F] focus:border-[#C2522D] focus:ring-2 focus:ring-[#C2522D]/15"

  return (
    <div className="space-y-5">
      <div className="flex gap-3 items-start">
        <div className="p-2 bg-slate-100 text-slate-600 rounded-lg shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Keamanan Akun</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">Sangat disarankan untuk segera mengubah password default (NISN anak) Anda ke password pribadi yang lebih aman demi kerahasiaan data.</p>
        </div>
      </div>

      <div className="space-y-3 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1.5">Password Saat Ini</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Masukkan password saat ini..."
            className={InputClass}
          />
        </div>
        
        <div className="pt-2 border-t border-slate-50">
          <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1.5">Password Baru</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimal 6 karakter..."
            className={InputClass}
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1.5">Konfirmasi Password Baru</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Ulangi password baru..."
            className={InputClass}
          />
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
          <Key className="w-4 h-4" />
          {isPending ? 'Menyimpan...' : 'Simpan Password'}
        </button>
      </div>
    </div>
  )
}
