'use client'

import { useState, useTransition } from 'react'
import { changeOwnParentPassword } from '../actions'

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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-bold text-slate-900">Keamanan Akun Orang Tua</h2>
      <p className="text-xs text-slate-500 mt-1">Disarankan ganti password default NISN ke password pribadi.</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Password saat ini"
          className="h-9 rounded-md border border-slate-200 px-3 text-xs"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Password baru (min. 6)"
          className="h-9 rounded-md border border-slate-200 px-3 text-xs"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Konfirmasi password"
          className="h-9 rounded-md border border-slate-200 px-3 text-xs"
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-60"
        >
          {isPending ? 'Menyimpan...' : 'Simpan Password'}
        </button>
        {message ? (
          <span className={`text-xs ${message.error ? 'text-rose-600' : 'text-emerald-700'}`}>{message.text}</span>
        ) : null}
      </div>
    </div>
  )
}

