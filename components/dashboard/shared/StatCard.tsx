// components/dashboard/shared/StatCard.tsx
import Link from 'next/link'
import { CaretRight as ChevronRight } from '@phosphor-icons/react/dist/ssr'

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
      className="group block rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 p-4 shadow-sm hover:shadow hover:border-emerald-800/20 transition-all active:scale-[0.98]"
    >
      <div className="flex items-start justify-between">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-sm ${iconBg} ${iconColor}`}>{icon}</div>
        <div className="h-6 w-6 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-slate-100 dark:group-hover:bg-slate-700 transition-colors">
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</p>
        <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-0.5 tracking-tight leading-none tabular-nums">{value}</p>
        {sub && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{sub}</p>}
      </div>
    </Link>
  )
}
