import Link from 'next/link'
import { UserGear as UserCog, CalendarCheck, Gear } from '@phosphor-icons/react/dist/ssr'

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
  
  const runningTextBg = textColor === 'white' ? 'bg-black/30 border-white/10 text-white' : 'bg-white/40 border-black/10 text-slate-800 dark:text-slate-100'
  const runningTextLabel = textColor === 'white' ? 'text-emerald-400' : 'text-emerald-600 dark:text-emerald-400'

  return (
    <div 
      className="relative w-full rounded-[2rem] overflow-hidden shadow-sm transition-all flex flex-col justify-end h-40 md:h-56 lg:h-64"
      style={containerStyle}
    >
      {/* Overlay for text readability */}
      <div className={`absolute inset-0 ${overlayClass} transition-all`} />

      {/* Settings / Gear Button (Top Right) */}
      <Link 
        href="/dashboard/settings/profile" 
        className={`absolute top-4 right-4 z-20 p-2.5 rounded-full backdrop-blur-md transition-all shadow-sm active:scale-95 ${textColor === 'white' ? 'bg-black/20 hover:bg-black/40 text-white' : 'bg-white/50 hover:bg-white/80 text-slate-700'}`}
        title="Pengaturan Profil"
      >
        <Gear className="h-5 w-5" weight="fill" />
      </Link>

      <div className={`relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-5 md:px-8 py-5 md:py-8 w-full h-full ${runningText ? 'pb-12 md:pb-16' : ''}`}>
        <div className="flex items-center md:items-end gap-3 md:gap-5 min-w-0 mt-auto">
          {/* Avatar (Hidden on small screens) */}
          <div className={`hidden md:flex relative h-16 w-16 md:h-20 md:w-20 shrink-0 rounded-full ${avatarBg} items-center justify-center overflow-hidden shadow-md ring-4 ring-white/50 dark:ring-slate-800/50`}>
            {avatarUrl
              ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              : <span className="text-2xl md:text-3xl font-bold text-white select-none">{namaDepan.charAt(0).toUpperCase()}</span>
            }
            <span className="absolute bottom-1 right-1 h-3 md:h-3.5 w-3 md:w-3.5 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-800" />
          </div>
          
          <div className="min-w-0 pb-0.5 md:pb-1">
            <p className={`text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mb-1 md:mb-1.5 ${subTextClass}`}>{sapaan}</p>
            <h1 className={`text-xl sm:text-2xl md:text-3xl font-black tracking-tight leading-none truncate mb-2 md:mb-2.5 ${textClass}`}>
              {nama}
            </h1>
            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
              <span className={`text-[10px] md:text-xs font-bold px-2.5 py-0.5 md:px-3 md:py-1 rounded-full backdrop-blur-md shadow-sm ${textColor === 'white' ? 'bg-white/20 text-white' : 'bg-black/10 text-slate-700 dark:text-slate-200'}`}>
                {roleLabel}
              </span>
              {taAktif && (
                <span className={`text-[10px] md:text-xs font-semibold flex items-center gap-1 md:gap-1.5 backdrop-blur-md px-2.5 py-0.5 md:px-3 md:py-1 rounded-full shadow-sm ${textColor === 'white' ? 'bg-black/20 text-white' : 'bg-white/40 text-slate-800 dark:text-slate-100'}`}>
                  <CalendarCheck className="h-3.5 w-3.5 md:h-4 md:w-4" weight="duotone" />
                  TA {taAktif.nama} • Smt {taAktif.semester}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Running Text / Marquee directly overlay at bottom */}
      {runningText && (
        <div className={`absolute bottom-0 left-0 w-full overflow-hidden text-[10px] md:text-xs font-medium py-1.5 md:py-2 px-5 flex items-center whitespace-nowrap z-20 border-t ${runningTextBg}`}>
          <span className={`shrink-0 mr-3 md:mr-4 uppercase tracking-widest font-black ${runningTextLabel}`}>Info</span>
          <div className="w-full overflow-hidden relative flex items-center">
            {/* @ts-ignore - marquee is deprecated but still works fine for simple needs */}
            <marquee className="w-full h-full font-semibold" scrollamount="4">{runningText}</marquee>
          </div>
        </div>
      )}
    </div>
  )
}
