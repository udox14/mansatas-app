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
  bgImageUrl?: string
  runningText?: string
  textColor?: string
}

const AVATAR_BG: Record<string, string> = {
  blue: 'bg-blue-500', purple: 'bg-purple-500', cyan: 'bg-cyan-500',
  emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500',
  orange: 'bg-orange-500', sky: 'bg-sky-500',
}

export function WelcomeStrip({ 
  nama, namaDepan, avatarUrl, roleLabel, roleColor = 'emerald', taAktif, sapaan,
  bgImageUrl, runningText, textColor = 'white'
}: Props) {
  const avatarBg = AVATAR_BG[roleColor] ?? AVATAR_BG.emerald

  // Fallback gradient if no background image is provided
  const fallbackGradient = {
    emerald: 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20',
    blue: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
    purple: 'from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20',
    cyan: 'from-cyan-50 to-sky-50 dark:from-cyan-900/20 dark:to-sky-900/20',
    amber: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20',
    rose: 'from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20',
    orange: 'from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20',
    sky: 'from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20',
  }[roleColor] ?? 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20'

  const containerStyle = bgImageUrl 
    ? { backgroundImage: `url(${bgImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } 
    : {}

  // We add a dark or light overlay based on text color so text remains readable
  const overlayClass = bgImageUrl 
    ? (textColor === 'white' 
        ? 'bg-gradient-to-t from-black/80 via-black/40 to-transparent' 
        : 'bg-gradient-to-t from-white/90 via-white/50 to-transparent')
    : `bg-gradient-to-r ${fallbackGradient}`

  const textClass = textColor === 'white' ? 'text-white' : 'text-slate-800 dark:text-slate-50'
  const subTextClass = textColor === 'white' ? 'text-slate-200' : 'text-slate-600 dark:text-slate-300'

  return (
    <div className="w-full flex flex-col">
      {/* Hero 16:9 Image Container */}
      <div 
        className="relative w-full aspect-video sm:aspect-[21/9] lg:aspect-[24/9] rounded-3xl overflow-hidden shadow-sm transition-all flex flex-col justify-end"
        style={containerStyle}
      >
        {/* Overlay for text readability */}
        <div className={`absolute inset-0 ${overlayClass} transition-all`} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 p-6 sm:p-8 w-full h-full">
          <div className="flex items-end gap-5 min-w-0 mt-auto">
            <div className={`relative h-20 w-20 shrink-0 rounded-full ${avatarBg} flex items-center justify-center overflow-hidden shadow-md ring-4 ring-white/50 dark:ring-slate-800/50`}>
              {avatarUrl
                ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                : <span className="text-3xl font-bold text-white select-none">{namaDepan.charAt(0).toUpperCase()}</span>
              }
              <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-800" />
            </div>
            <div className="min-w-0 pb-1">
              <p className={`text-xs font-semibold uppercase tracking-widest mb-1.5 ${subTextClass}`}>{sapaan}</p>
              <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight leading-none truncate mb-2.5 ${textClass}`}>
                {nama}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white shadow-sm">
                  {roleLabel}
                </span>
                {taAktif && (
                  <span className="text-xs font-medium flex items-center gap-1.5 bg-black/20 backdrop-blur-md text-white px-3 py-1 rounded-full shadow-sm">
                    <CalendarCheck className="h-4 w-4" weight="duotone" />
                    TA {taAktif.nama} • Smt {taAktif.semester}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <Link
            href="/dashboard/settings/profile"
            className="shrink-0 inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md hover:bg-white dark:hover:bg-slate-800 px-4 py-2.5 rounded-2xl shadow-sm hover:shadow transition-all"
          >
            <UserCog className="h-5 w-5" weight="duotone" /> 
            <span>Profil Saya</span>
          </Link>
        </div>
      </div>

      {/* Running Text / Marquee directly beneath the hero */}
      {runningText && (
        <div className="w-full mt-2 overflow-hidden bg-emerald-500 text-white text-xs font-medium py-1.5 px-4 rounded-full shadow-sm flex items-center whitespace-nowrap">
          <span className="shrink-0 mr-2 uppercase tracking-wider font-bold opacity-80">Info:</span>
          <div className="w-full overflow-hidden relative flex items-center">
            {/* Simple CSS animation would require adding keyframes to global.css, so we'll use a direct inline style logic or framer motion if available, but a basic CSS marque works if defined, or we can just let it scroll natively. */}
            <marquee className="w-full h-full" scrollamount="5">{runningText}</marquee>
          </div>
        </div>
      )}
    </div>
  )
}
