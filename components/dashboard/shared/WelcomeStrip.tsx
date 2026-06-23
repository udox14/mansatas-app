// components/dashboard/shared/WelcomeStrip.tsx
import Link from 'next/link'
import { UserGear as UserCog, CalendarCheck, Bell } from '@phosphor-icons/react/dist/ssr'

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

export function WelcomeStrip({ nama, namaDepan, avatarUrl, roleLabel, roleColor = 'emerald', taAktif, sapaan }: Props) {
  const avatarBg = AVATAR_BG[roleColor] ?? AVATAR_BG.emerald

  return (
    <div className="space-y-4">
      {/* Greeting Header Row */}
      <div className="flex items-center justify-between px-1 py-1">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">
            {sapaan}
          </p>
          <h1 className="text-xl font-extrabold text-emerald-950 dark:text-emerald-400 tracking-tight leading-snug">
            Hi, {namaDepan}!
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Notification Bell (Pure/Clean) */}
          <Link
            href="/dashboard/settings/notifications"
            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 transition-colors"
            title="Broadcast"
          >
            <Bell className="h-5 w-5" />
          </Link>
          
          <Link href="/dashboard/settings/profile" className="group">
            <div className={`relative h-10 w-10 shrink-0 rounded-full ${avatarBg} flex items-center justify-center overflow-hidden ring-2 ring-emerald-800/10 group-hover:ring-emerald-800/30 transition-all`}>
              {avatarUrl
                ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                : <span className="text-base font-semibold text-white select-none">{namaDepan.charAt(0).toUpperCase()}</span>
              }
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-white" />
            </div>
          </Link>
        </div>
      </div>

      {/* Welcome Premium Gradient Banner Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-[#01241b] to-emerald-900 text-white p-5 shadow-sm border border-emerald-900/40">
        {/* Decorative elements */}
        <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-emerald-500/15 blur-xl pointer-events-none" />
        <div className="absolute right-12 -top-4 w-20 h-20 rounded-full bg-emerald-400/10 blur-lg pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <div className="space-y-1">
            <h2 className="text-sm font-bold tracking-wide text-emerald-200/90 uppercase">MADRASAH DIGITAL</h2>
            <p className="text-xs text-white/95 font-medium leading-relaxed max-w-md">
              Kelola tugas, absensi, dan monitoring operasional madrasah hari ini dengan cepat dan praktis.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 pt-1.5">
            <span className="text-[9px] font-bold bg-emerald-500/25 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/35 uppercase tracking-wider">
              {roleLabel}
            </span>
            {taAktif && (
              <span className="text-[10px] text-emerald-200/80 font-medium flex items-center gap-1">
                <CalendarCheck className="h-3.5 w-3.5" />
                TA {taAktif.nama} · Semester {taAktif.semester}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
