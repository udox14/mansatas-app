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
      className="group flex flex-col gap-4 rounded-3xl bg-white dark:bg-slate-800 p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:-translate-y-1"
    >
      <div className="flex items-start justify-between">
        <div className={`p-3 rounded-2xl ${iconBg} ${iconColor} shadow-sm`}>{icon}</div>
        <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight className="h-4 w-4 text-slate-400 dark:text-slate-300" />
        </div>
      </div>
      <div className="mt-2">
        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-3xl font-extrabold text-slate-800 dark:text-slate-50 tracking-tight leading-none">{value}</p>
        {sub && <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">{sub}</p>}
      </div>
    </Link>
  )
}
