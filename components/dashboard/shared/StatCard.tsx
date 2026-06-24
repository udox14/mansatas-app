// components/dashboard/shared/StatCard.tsx
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type Props = {
  title: string
  value: number | string
  sub?: string
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  href: string
}

export function StatCard({ title, value, sub, icon, iconBg, iconColor, href }: Props) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-800 p-3 sm:p-4 shadow-sm border border-slate-100 dark:border-slate-700/50 hover:shadow-md transition-all active:scale-[0.98]"
    >
      <div className={`p-2.5 rounded-xl ${iconBg} ${iconColor} shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 truncate">{title}</p>
        <div className="flex items-end gap-2">
          <p className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-50 tracking-tight leading-none tabular-nums">{value}</p>
          {sub && <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate mb-0.5">{sub}</p>}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
    </Link>
  )
}
