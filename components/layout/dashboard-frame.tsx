'use client'

import { usePathname } from 'next/navigation'

export function DashboardFrame({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const isHome = usePathname() === '/dashboard'
  return <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
    {!isHome && <div className="shrink-0 bg-white dark:bg-slate-950" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>{header}</div>}
    <main id="dashboard-main" className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain ${isHome ? 'dashboard-home-main' : 'p-3 sm:p-4 md:p-5'}`}>
      <div className={`${isHome ? '' : 'mx-auto max-w-7xl'} dashboard-page-content`}>
        {children}
      </div>
    </main>
  </div>
}
