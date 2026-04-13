// components/dashboard/shared/WelcomeStrip.tsx
import Link from 'next/link'
import { UserCog, CalendarCheck } from 'lucide-react'

type Props = {
  nama: string
  namaDepan: string
  avatarUrl: string | null
  roleLabel: string
  roleColor?: string
  taAktif?: { nama: string; semester: number } | null
  sapaan: string
}

const AVATAR_BG: Record<string, string> = {
  blue: 'bg-blue-500', purple: 'bg-purple-500', cyan: 'bg-cyan-500',
  emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500',
  orange: 'bg-orange-500', sky: 'bg-sky-500',
}
const BADGE_CLS: Record<string, string> = {
  blue:    'text-blue-700 bg-blue-50 border-blue-200',
  purple:  'text-purple-700 bg-purple-50 border-purple-200',
  cyan:    'text-cyan-700 bg-cyan-50 border-cyan-200',
  emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  amber:   'text-amber-700 bg-amber-50 border-amber-200',
  rose:    'text-rose-700 bg-rose-50 border-rose-200',
  orange:  'text-orange-700 bg-orange-50 border-orange-200',
  sky:     'text-sky-700 bg-sky-50 border-sky-200',
}

export function WelcomeStrip({ nama, namaDepan, avatarUrl, roleLabel, roleColor = 'emerald', taAktif, sapaan }: Props) {
  const avatarBg = AVATAR_BG[roleColor] ?? AVATAR_BG.emerald
  const badgeCls = BADGE_CLS[roleColor] ?? BADGE_CLS.emerald

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-surface bg-surface px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`relative h-10 w-10 shrink-0 rounded-full ${avatarBg} flex items-center justify-center overflow-hidden shadow-sm`}>
          {avatarUrl
            ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            : <span className="text-base font-semibold text-white select-none">{namaDepan.charAt(0).toUpperCase()}</span>
          }
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-0.5">{sapaan}</p>
          <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-50 leading-snug truncate">{nama}</h1>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-[10px] font-semibold border px-1.5 py-0.5 rounded ${badgeCls}`}>
              {roleLabel}
            </span>
            {taAktif && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <CalendarCheck className="h-3 w-3" />
                TA {taAktif.nama} · Smt {taAktif.semester}
              </span>
            )}
          </div>
        </div>
      </div>
      <Link
        href="/dashboard/settings/profile"
        className="shrink-0 hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200 border border-surface hover:border-slate-300 px-3 py-1.5 rounded-md bg-surface-2 hover:bg-surface transition-colors"
      >
        <UserCog className="h-3.5 w-3.5" /> Profil saya
      </Link>
    </div>
  )
}
