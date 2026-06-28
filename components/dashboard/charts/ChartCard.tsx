// components/dashboard/charts/ChartCard.tsx
// Wrapper kartu untuk grafik dashboard. Presentational, aman di server.
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'

type Props = {
  title: string
  subtitle?: string
  icon?: ReactNode
  iconBg?: string
  iconColor?: string
  href?: string
  hrefLabel?: string
  className?: string
  children: ReactNode
}

export function ChartCard({
  title,
  subtitle,
  icon,
  iconBg = 'bg-slate-50 dark:bg-slate-800',
  iconColor = 'text-slate-600 dark:text-slate-300',
  href,
  hrefLabel = 'Detail',
  className = '',
  children,
}: Props) {
  return (
    <div className={`rounded-xl border border-surface bg-surface shadow-sm overflow-hidden flex flex-col ${className}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-2">
        {icon && (
          <div className={`p-1.5 rounded-md ${iconBg} ${iconColor}`}>
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{title}</p>
          {subtitle && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 shrink-0">
            {hrefLabel} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="p-3 flex-1">{children}</div>
    </div>
  )
}
