'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck, UserSquare2 } from 'lucide-react'

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
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:flex sm:items-center sm:justify-center">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:40px_40px] opacity-40" />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-emerald-50/80 via-white/20 to-sky-50/70" />

      <main className="relative mx-auto flex min-h-[calc(100dvh-48px)] w-full max-w-md flex-col justify-center sm:min-h-0">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-900/10 bg-white shadow-sm">
              <Image src="/logokemenag.png" alt="MAN 1 Tasikmalaya" fill className="object-contain p-1.5" priority />
            </span>
            <span>
              <span className="block text-sm font-black uppercase tracking-[0.18em] text-emerald-900">MANSATAS</span>
              <span className="block text-xs font-semibold text-slate-500">MAN 1 Tasikmalaya</span>
            </span>
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:border-emerald-700 hover:text-emerald-900"
          >
            Login Pegawai
          </Link>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-950 px-6 py-7 text-white">
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-emerald-200 ring-1 ring-white/10">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Portal Orang Tua</p>
            <h1 className="mt-2 text-2xl font-black tracking-normal">Pantau perkembangan anak dari satu tempat.</h1>
          </div>

          <form onSubmit={onSubmit} className="space-y-4 p-6">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="nisn" className="text-xs font-bold uppercase tracking-wide text-slate-500">Username</label>
            <div className="relative">
              <UserSquare2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="nisn"
                inputMode="numeric"
                autoComplete="username"
                value={nisn}
                onChange={(e) => setNisn(e.target.value.replace(/\D/g, ''))}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-base font-semibold text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white"
                placeholder="Username"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-bold uppercase tracking-wide text-slate-500">Password</label>
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                inputMode="numeric"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 20))}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-12 text-base font-semibold text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white"
                placeholder="Password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-black text-white shadow-[0_14px_30px_rgba(4,120,87,0.22)] transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</> : <>Masuk Portal <ArrowRight className="h-4 w-4" /></>}
          </button>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium leading-5 text-slate-600">
              Setelah masuk, orang tua dapat melihat pengumuman, jadwal, kehadiran, nilai, catatan kedisiplinan, dan informasi keuangan siswa.
            </div>
          </form>
        </section>
      </main>
    </div>
  )
}
