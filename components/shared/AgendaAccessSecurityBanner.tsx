import Link from 'next/link'
import { AlertTriangle, LockKeyhole } from 'lucide-react'
import type { AgendaAccessWarning } from '@/lib/agenda-access-audit'

export function AgendaAccessSecurityBanner({ warning }: { warning: AgendaAccessWarning | null }) {
  if (!warning) return null
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${warning.isBlocked
      ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-100'
      : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100'
    }`}>
      <div className="flex items-start gap-3">
        {warning.isBlocked ? <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
        <div className="space-y-1">
          <p className="font-semibold">{warning.isBlocked ? 'Pengisian Agenda Guru diblokir' : 'Peringatan keamanan akun'}</p>
          <p>
            {warning.isBlocked
              ? `Akun Anda sementara tidak dapat mengisi Agenda Guru.${warning.blockReason ? ` Alasan: ${warning.blockReason}` : ''}`
              : 'Sistem mendeteksi akun berbeda digunakan pada perangkat yang sama. Jangan berbagi akun. Jika aktivitas ini bukan dilakukan oleh Anda, segera ganti kata sandi dan hubungi pengelola.'}
          </p>
          <Link href="/dashboard/settings/profile" className="inline-flex font-semibold underline underline-offset-2">
            Buka pengaturan kata sandi
          </Link>
        </div>
      </div>
    </div>
  )
}
