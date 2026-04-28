import Link from 'next/link'
import Image from 'next/image'
import { getCurrentUser } from '@/utils/auth/server'
import { ArrowRight, LayoutDashboard, LogIn, ShieldCheck } from 'lucide-react'

export const metadata = {
  title: 'MANSATAS App',
  description: 'Gerbang digital MAN 1 Tasikmalaya.',
}

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const user = await getCurrentUser()
  const href = user ? '/dashboard' : '/login'
  const label = user ? 'Buka Dashboard' : 'Masuk Aplikasi'
  const Icon = user ? LayoutDashboard : LogIn

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#eef4ed] text-slate-950">
      <div className="relative flex min-h-[100dvh] items-center justify-center px-5 py-8">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'linear-gradient(#d8e4d5 1px, transparent 1px), linear-gradient(90deg, #d8e4d5 1px, transparent 1px)',
            backgroundSize: '34px 34px',
          }}
        />

        <div className="relative w-full max-w-sm">
          <div className="mb-5 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-900/10 bg-white shadow-sm">
              <Image
                src="/logokemenag.png"
                alt="Logo Kementerian Agama"
                width={58}
                height={58}
                className="h-14 w-14 object-contain"
                priority
              />
            </div>
          </div>

          <section className="rounded-2xl border border-emerald-950/10 bg-white px-6 py-7 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-800">
              <ShieldCheck className="h-4 w-4" />
              Portal Resmi
            </div>

            <h1 className="text-4xl font-black tracking-normal text-slate-950">
              MANSATAS App
            </h1>

            <p className="mx-auto mt-3 max-w-xs text-sm font-semibold leading-6 text-slate-600">
              Gerbang digital MAN 1 Tasikmalaya.
            </p>

            <Link
              href={href}
              className="group mt-7 inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white shadow-[0_16px_34px_rgba(4,120,87,0.24)] transition hover:-translate-y-0.5 hover:bg-emerald-800"
            >
              <Icon className="h-5 w-5" />
              {label}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </section>

          <p className="mt-5 text-center text-xs font-bold text-emerald-950/60">
            MAN 1 Tasikmalaya
          </p>
        </div>
      </div>
    </main>
  )
}
