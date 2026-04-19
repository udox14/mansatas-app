'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function TahfidzNav() {
  const pathname = usePathname()

  const links = [
    { name: 'Kelola Hafalan', href: '/dashboard/tahfidz', exact: true },
    { name: 'Analitik', href: '/dashboard/tahfidz/analitik', exact: false },
  ]

  return (
    <div className="flex space-x-1 border-b border-slate-200 dark:border-slate-800 mb-6 pb-px overflow-x-auto no-scrollbar">
      {links.map((link) => {
        const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
              isActive 
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" 
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            {link.name}
          </Link>
        )
      })}
    </div>
  )
}
