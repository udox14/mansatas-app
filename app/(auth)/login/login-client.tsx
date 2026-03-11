'use client'

// Lokasi: app/(auth)/login/login-client.tsx

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Mail, Lock, Loader2, ArrowRight, AlertCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { authClient } from '@/utils/auth/client'

export default function LoginClient() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPending(true)

    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: '/dashboard',
    })

    if (error) {
      setError('Email atau password salah.')
      setPending(false)
    }
    // Kalau sukses, Better Auth otomatis redirect ke callbackURL
  }

  const handleLupaSandi = (e: React.MouseEvent) => {
    e.preventDefault()
    alert('Silakan hubungi Admin untuk melakukan reset kata sandi akun Anda.')
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 font-sans selection:bg-emerald-100 selection:text-emerald-900 overflow-hidden">
      
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-emerald-400/20 blur-[120px] animate-pulse duration-10000" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[60%] w-[60%] rounded-full bg-blue-400/20 blur-[150px]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] px-6 py-12 lg:px-8 animate-in fade-in zoom-in-95 duration-700">
        
        <div className="rounded-[2.5rem] bg-white/90 backdrop-blur-2xl p-8 sm:p-10 shadow-2xl ring-1 ring-slate-100">
          
          <div className="flex flex-col items-center text-center mb-8">
            <div className="mb-5 relative h-16 w-16 drop-shadow-md transition-transform hover:scale-105">
              <Image 
                src="/logokemenag.png" 
                alt="Logo Kemenag" 
                fill 
                className="object-contain"
                priority
              />
            </div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900">
              MANSATAS <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">App</span>
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-500 uppercase tracking-widest">
              MAN 1 Tasikmalaya
            </p>
          </div>
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            
            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/80 p-4 text-sm font-medium text-rose-600 animate-in slide-in-from-top-2">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="leading-snug">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">
                Alamat Email
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 sm:text-sm font-medium transition-all"
                  placeholder="nama@man1tasikmalaya.sch.id"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">
                Kata Sandi
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-12 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 sm:text-sm font-medium transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-500 focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <input
                  id="remember"
                  name="remember"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="remember" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                  Ingat Saya
                </label>
              </div>
              <button
                type="button"
                onClick={handleLupaSandi}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors focus:outline-none"
              >
                Lupa sandi?
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={pending}
                className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-4 text-base font-bold text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02] hover:shadow-xl hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
              >
                {pending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Memproses...</>
                ) : (
                  <>Masuk Sistem <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center flex flex-col items-center justify-center gap-2 border-t border-slate-100 pt-6">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Sistem Terenkripsi Aman
            </div>
            <Link href="/" className="text-xs text-slate-400 hover:text-emerald-600 font-medium transition-colors mt-2">
              &larr; Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}