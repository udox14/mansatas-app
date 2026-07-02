'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle, Eye, EyeOff, Info, Loader2, LockKeyhole, MessageCircle, UserSquare2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export default function ParentLoginClient({
  helpEnabled = true,
  helpWhatsapp = '6282218943383',
  helpInfo = '',
}: {
  helpEnabled?: boolean
  helpWhatsapp?: string
  helpInfo?: string
}) {
  const [nisn, setNisn] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const helpNumber = String(helpWhatsapp || '').replace(/\D/g, '')
  const infoText = String(helpInfo || '').trim()

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
        // 403 = login diblokir admin (mis. pembatasan per tingkat) → tampilkan pesan dari server.
        if (res.status === 403) {
          const msg = (await res.text()).trim()
          setError(msg || 'Login Anda sedang dinonaktifkan oleh sekolah.')
        } else {
          setError('NISN atau password tidak sesuai.')
        }
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
    <div className="flex min-h-screen items-center justify-center bg-[#fafcfa] px-4 text-slate-900 relative overflow-hidden">
      
      {/* Custom Animation and Dot Grid styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blob-glow {
          0%, 100% { transform: scale(1) translate(0px, 0px); }
          33% { transform: scale(1.1) translate(30px, -40px); }
          66% { transform: scale(0.9) translate(-20px, 20px); }
        }
        .animate-blob-1 {
          animation: blob-glow 10s ease-in-out infinite;
        }
        .animate-blob-2 {
          animation: blob-glow 12s ease-in-out infinite alternate;
        }
        .bg-dots {
          background-image: radial-gradient(rgba(13, 148, 136, 0.06) 1.5px, transparent 1.5px);
          background-size: 24px 24px;
        }
      `}} />

      {/* Decorative Dot Grid Overlay */}
      <div className="absolute inset-0 bg-dots pointer-events-none z-10" />

      {/* Decorative Glowing Blur Blobs */}
      <div className="absolute -left-20 -top-20 w-96 h-96 rounded-full bg-teal-500/10 blur-[100px] pointer-events-none animate-blob-1 z-0" />
      <div className="absolute right-0 bottom-0 w-[500px] h-[500px] rounded-full bg-teal-500/5 blur-[120px] pointer-events-none animate-blob-2 z-0" />

      <main className="relative w-full max-w-[360px] z-20">
        <section className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-md">
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <Link href="/" className="flex min-w-0 items-center gap-2.5 group">
              <span className="relative h-8 w-8 shrink-0 flex items-center justify-center transition-transform group-hover:scale-105 duration-300">
                <Image src="/logokemenag.png" alt="MAN 1 Tasikmalaya" width={32} height={32} className="object-contain" priority />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-extrabold leading-none tracking-tight text-teal-950">
                  MANSATAS <span className="text-slate-500 font-bold">App</span>
                </span>
                <span className="block text-[9px] uppercase tracking-[0.08em] text-teal-700/80 font-medium mt-1">
                  Bangkit - Jaya - Juara
                </span>
              </span>
            </Link>
            <span className="shrink-0 rounded-lg border border-teal-150 bg-teal-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-800">
              Login Wali
            </span>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 p-2.5 text-[11px] text-rose-600">
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
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-500 focus:bg-white"
                  placeholder="Username (NISN Anak)"
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
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-9 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-teal-500 focus:bg-white"
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
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-xs font-bold text-white shadow-md shadow-teal-700/10 hover:bg-teal-800 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  <span className="whitespace-nowrap">Memproses...</span>
                </>
              ) : (
                'MASUK PORTAL'
              )}
            </button>

            {helpEnabled && helpNumber ? (
              <a
                href={`https://wa.me/${helpNumber}?text=Assalamu%27alaikum%2C%20saya%20orang%20tua%2Fwali%20siswa%20membutuhkan%20bantuan%20akun%20Portal%20Orang%20Tua.`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-3 text-[11px] font-bold text-teal-950 transition-all hover:bg-teal-50/50 hover:border-teal-400 shadow-sm"
              >
                <MessageCircle className="h-3.5 w-3.5 text-teal-600" />
                <span>Bantuan Akun? Hubungi Admin</span>
              </a>
            ) : infoText ? (
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-3 text-[11px] font-bold text-teal-950 transition-all hover:bg-teal-50/50 hover:border-teal-400 shadow-sm"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-teal-600" />
                    <span>Bantuan Akun? Hubungi Admin</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm rounded-2xl p-0 border-0 overflow-hidden bg-white">
                  <DialogHeader className="p-5 pb-3 border-b border-slate-100">
                    <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
                      <Info className="h-4 w-4 text-teal-600" />
                      Bantuan Akun
                    </DialogTitle>
                  </DialogHeader>
                  <div className="p-5">
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{infoText}</p>
                  </div>
                </DialogContent>
              </Dialog>
            ) : null}

            <Link href="/login" className="block text-center text-[11px] font-bold text-slate-500 transition-colors hover:text-teal-700">
              Login Pegawai / Guru
            </Link>
          </form>
        </section>
      </main>
    </div>
  )
}
