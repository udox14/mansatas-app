// components/dashboard/shared/QuickLink.tsx
import Link from 'next/link'
import { CaretRight as ChevronRight } from '@phosphor-icons/react/dist/ssr'

type Props = {
  href: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  title: string
  desc?: string
  badge?: string | number
  badgeColor?: string
}

export function QuickLink({ href, icon, iconBg, iconColor, title, desc, badge, badgeColor }: Props) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-850/40 transition-colors group"
    >
      <div className={`h-9 w-9 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0 shadow-sm`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{title}</p>
        {desc && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{desc}</p>}
      </div>
      {badge !== undefined && (
        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ${badgeColor ?? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
          {badge}
        </span>
      )}
      <div className="h-6 w-6 rounded-full bg-transparent group-hover:bg-slate-100 dark:group-hover:bg-slate-800 flex items-center justify-center text-slate-350 group-hover:text-slate-500 transition-all">
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
      </div>
    </Link>
  )
}
