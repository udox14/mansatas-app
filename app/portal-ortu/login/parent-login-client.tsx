'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle, Eye, EyeOff, Loader2, LockKeyhole, MessageCircle, UserSquare2 } from 'lucide-react'

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:40px_40px] opacity-50" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-emerald-50/60 via-transparent to-slate-100/80" />

      <main className="relative w-full max-w-[360px]">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <span className="relative h-9 w-9 shrink-0">
                <Image src="/logokemenag.png" alt="MAN 1 Tasikmalaya" fill className="object-contain" priority />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight text-slate-900">MANSATAS</span>
                <span className="block text-[10px] uppercase tracking-wide text-slate-400">MAN 1 Tasikmalaya</span>
              </span>
            </Link>
            <span className="shrink-0 rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
              Login Orang Tua
            </span>
          </div>

          <form onSubmit={onSubmit} className="space-y-3.5">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-100 bg-rose-50 p-2.5 text-[11px] text-rose-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="nisn" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Username</label>
            <div className="relative">
              <UserSquare2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                id="nisn"
                inputMode="numeric"
                autoComplete="username"
                value={nisn}
                onChange={(e) => setNisn(e.target.value.replace(/\D/g, ''))}
                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white"
                placeholder="Username"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Password</label>
            <div className="relative">
              <LockKeyhole className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 20))}
                className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-9 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white"
                placeholder="Password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                <span className="whitespace-nowrap">Memproses...</span>
              </>
            ) : (
              'MASUK'
            )}
          </button>

            <a
              href="https://wa.me/6282218943383?text=Assalamu%27alaikum%2C%20saya%20orang%20tua%2Fwali%20siswa%20membutuhkan%20bantuan%20akun%20Portal%20Orang%20Tua."
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Lupa password atau akun? Hubungi Admin
            </a>
            <Link href="/login" className="block text-center text-[11px] font-semibold text-slate-500 transition-colors hover:text-emerald-700">
              Login Pegawai
            </Link>
          </form>
        </section>
      </main>
    </div>
  )
}
