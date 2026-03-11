// Lokasi: components/layout/page-header.tsx
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  iconColor?: string   // e.g. "text-blue-600"
  children?: React.ReactNode
  className?: string
}

/**
 * PageHeader — clean, compact page title block.
 * Menggantikan pola lama: icon dibungkus badge kotak warna.
 * Icon sekarang inline dengan warna halus, tanpa background norak.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  iconColor = 'text-slate-400',
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3", className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon className={cn("h-5 w-5 shrink-0", iconColor)} />}
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-slate-900 leading-tight tracking-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="text-[12px] text-slate-500 leading-tight mt-0.5 truncate">
              {description}
            </p>
          )}
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-wrap">
          {children}
        </div>
      )}
    </div>
  )
}