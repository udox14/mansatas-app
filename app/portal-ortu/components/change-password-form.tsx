'use client'

import { useState, useTransition } from 'react'
import { changeOwnParentPassword } from '../actions'
import { KeyRound, ShieldCheck } from 'lucide-react'

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

  const InputClass = "w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all placeholder:text-slate-400"

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
            <span className={`text-xs font-medium ${message.error ? 'text-rose-600' : 'text-emerald-600'}`}>
              {message.text}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center gap-2 shrink-0 shadow-sm"
        >
          <KeyRound className="w-4 h-4" />
          {isPending ? 'Menyimpan...' : 'Simpan Password'}
        </button>
      </div>
    </div>
  )
}
