'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Mail, Lock, Loader2, ArrowRight, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react'

export default function LoginClient() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setPending(true)
    try {
      const res = await fetch('/api/auth/sign-in/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }), credentials: 'include' })
      if (!res.ok) { setError('Email atau password salah.'); setPending(false); return }
      window.location.href = '/dashboard'
    } catch { setError('Terjadi kesalahan jaringan. Coba lagi.'); setPending(false) }
  }

  const handleLupaSandi = (e: React.MouseEvent) => { e.preventDefault(); alert('Silakan hubungi Admin untuk melakukan reset kata sandi akun Anda.') }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:40px_40px] opacity-50" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-emerald-50/60 via-transparent to-slate-100/80" />

      <div className="relative w-full max-w-[360px]">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">

          {/* Logo + nama */}
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
            <div className="relative h-9 w-9 shrink-0">
              <Image src="/logokemenag.png" alt="MAN 1 Tasikmalaya" fill className="object-contain" priority />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">MANSATAS</h1>
              <p className="text-[10px] text-slate-400 tracking-wide uppercase mt-0.5">MAN 1 Tasikmalaya</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error && (
              <div className="flex items-start gap-2 p-2.5 text-[11px] text-rose-600 bg-rose-50 rounded-lg border border-rose-100">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                  placeholder="nama@man1tasikmalaya.sch.id" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kata Sandi</label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full h-9 pl-8 pr-9 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" className="h-3 w-3 rounded border-slate-300 accent-emerald-600" />
                <span className="text-[11px] text-slate-500">Ingat saya</span>
              </label>
              <button type="button" onClick={handleLupaSandi} className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                Lupa sandi?
              </button>
            </div>

            <button type="submit" disabled={pending}
              className="w-full h-9 flex items-center justify-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {pending
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Memproses...</>
                : <>Masuk Sistem <ArrowRight className="h-3.5 w-3.5" /></>
              }
            </button>
          </form>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <ShieldCheck className="h-3 w-3 text-emerald-500" /> Sistem terenkripsi & aman
          </div>
        </div>
      </div>
    </div>
  )
}