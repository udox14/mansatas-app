// components/dashboard/shared/WelcomeStrip.tsx
import Link from 'next/link'
import { UserGear as UserCog, CalendarCheck } from '@phosphor-icons/react/dist/ssr'

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

  // A soft pastel gradient based on the role color
  const gradientBg = {
    emerald: 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20',
    blue: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
    purple: 'from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20',
    cyan: 'from-cyan-50 to-sky-50 dark:from-cyan-900/20 dark:to-sky-900/20',
    amber: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20',
    rose: 'from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20',
    orange: 'from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20',
    sky: 'from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20',
  }[roleColor] ?? 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20'

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-6 rounded-3xl bg-gradient-to-r ${gradientBg} p-6 sm:p-8 shadow-sm transition-all`}>
      <div className="flex items-center gap-5 min-w-0">
        <div className={`relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-full ${avatarBg} flex items-center justify-center overflow-hidden shadow-md ring-4 ring-white/50 dark:ring-slate-800/50`}>
          {avatarUrl
            ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            : <span className="text-2xl font-bold text-white select-none">{namaDepan.charAt(0).toUpperCase()}</span>
          }
          <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-800" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">{sapaan}</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-slate-50 tracking-tight leading-none truncate mb-2.5">
            {nama}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeCls.replace('border-', 'border-none ')} shadow-sm`}>
              {roleLabel}
            </span>
            {taAktif && (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-white/50 dark:bg-slate-800/50 px-2.5 py-1 rounded-full shadow-sm">
                <CalendarCheck className="h-4 w-4" weight="duotone" />
                TA {taAktif.nama} • Smt {taAktif.semester}
              </span>
            )}
          </div>
        </div>
      </div>
      <Link
        href="/dashboard/settings/profile"
        className="shrink-0 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 px-4 py-2.5 rounded-2xl shadow-sm hover:shadow transition-all"
      >
        <UserCog className="h-5 w-5" weight="duotone" /> 
        <span>Profil Saya</span>
      </Link>
    </div>
  )
}
