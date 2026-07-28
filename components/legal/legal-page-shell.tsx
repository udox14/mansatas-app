import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'

type LegalPageShellProps = {
  title: string
  description: string
  updatedAt: string
  children: ReactNode
}

export function LegalPageShell({
  title,
  description,
  updatedAt,
  children,
}: LegalPageShellProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/logokemenag.png"
              alt="Logo MAN 1 Tasikmalaya"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">MANSATAS App</p>
              <p className="truncate text-xs text-slate-500">MAN 1 Tasikmalaya</p>
            </div>
          </Link>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-teal-300 hover:text-teal-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali
          </Link>
        </div>
      </div>

      <article className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-6 sm:p-8">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          <p className="mt-4 text-xs font-medium text-slate-500">Terakhir diperbarui: {updatedAt}</p>
        </div>

        <div className="legal-content space-y-8 text-sm leading-7 text-slate-700">
          {children}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
            <div>
              <p className="font-semibold text-slate-900">Kontak pengelola data</p>
              <p className="mt-1 text-sm text-slate-600">
                Hubungi MAN 1 Tasikmalaya melalui{' '}
                <a
                  href="mailto:admin@man1tasikmalaya.sch.id"
                  className="font-semibold text-teal-700 underline underline-offset-2"
                >
                  admin@man1tasikmalaya.sch.id
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </article>
    </main>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold text-slate-950">{title}</h2>
      {children}
    </section>
  )
}
