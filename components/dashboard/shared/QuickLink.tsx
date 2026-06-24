// components/dashboard/shared/QuickLink.tsx
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

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
      className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 hover:shadow-md transition-all group active:scale-[0.98]"
    >
      <div className={`p-2 rounded-xl ${iconBg} ${iconColor} shrink-0`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{title}</p>
        {desc && <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">{desc}</p>}
      </div>
      {badge !== undefined && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${badgeColor ?? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
          {badge}
        </span>
      )}
      <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 shrink-0 transition-colors" />
    </Link>
  )
}
