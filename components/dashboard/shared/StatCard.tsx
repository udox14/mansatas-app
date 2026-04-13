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
      className="group flex flex-col gap-3 rounded-xl border border-surface bg-surface p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${iconBg} ${iconColor}`}>{icon}</div>
        <ArrowRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500 transition-colors" />
      </div>
      <div>
        <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-0.5 tracking-tight leading-none">{value}</p>
        {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
      </div>
    </Link>
  )
}
