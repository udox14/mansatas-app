'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, CalendarDays, Eye, EyeOff, Loader2, UserSquare2 } from 'lucide-react'

export default function ParentLoginClient() {
  const [nisn, setNisn] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/parent/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nisn: nisn.trim(), password: password.trim() }),
        credentials: 'include',
      })
      if (!res.ok) {
        setError('NISN atau password tidak sesuai.')
        setPending(false)
        return
      }
      window.location.href = '/portal-ortu'
    } catch {
      setError('Terjadi kesalahan jaringan. Silakan coba lagi.')
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Portal Orang Tua</h1>
        <p className="mt-1 text-xs text-slate-500">Masuk dengan NISN. Password default awal: NISN (bisa diganti setelah login).</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-slate-600">NISN</label>
            <div className="relative mt-1">
              <UserSquare2 className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={nisn}
                onChange={(e) => setNisn(e.target.value.replace(/\D/g, ''))}
                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm"
                placeholder="Contoh: 0051234567"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600">Password</label>
            <div className="relative mt-1">
              <CalendarDays className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 20))}
                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-9 text-sm"
                placeholder="Password default: NISN"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="h-9 w-full rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Memproses</> : <>Masuk Portal <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/login" className="text-xs font-semibold text-slate-600 hover:text-slate-900">Kembali ke login pegawai</Link>
        </div>
      </div>
    </div>
  )
}
