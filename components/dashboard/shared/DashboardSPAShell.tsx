'use client'

import Link from 'next/link'
import { ArrowUpRight, SlidersHorizontal } from 'lucide-react'
import { useDashboardNavigation } from '@/components/layout/dashboard-navigation'
import { MenuTile, menuTileClass } from './MenuTile'
import { PeriodChip } from './PeriodChip'
import type { LessonPattern } from '@/lib/dashboard-period'

const EMPTY_PATTERNS: LessonPattern[] = []

export function DashboardSPAShell({ children, heroNode, polaJam = EMPTY_PATTERNS }: { children: React.ReactNode; heroNode?: React.ReactNode; polaJam?: LessonPattern[] }) {
  const { menus, shortcutIds, openMenu, editShortcuts } = useDashboardNavigation()
  return <div className="dashboard-home">
    {heroNode}
    <div className="dashboard-home-content relative mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
      <section aria-labelledby="dashboard-favorites-title" className="max-w-[560px] py-5 sm:py-6 lg:max-w-none">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2">
          <h2 id="dashboard-favorites-title" className="sr-only">Menu favorit</h2>
          <PeriodChip patterns={polaJam} />
          <div className="flex items-center gap-1">
            <button onClick={openMenu} className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-400">Semua menu<ArrowUpRight size={14} /></button>
            <button onClick={editShortcuts} className="flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-slate-500 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-300"><SlidersHorizontal size={14} />Atur</button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-x-2 gap-y-2 sm:gap-x-4 lg:grid-cols-8">
          {shortcutIds.map(id => {
            const item = menus.find(item => item.id === id)
            return item ? <Link key={id} href={item.href} className={menuTileClass}><MenuTile item={item} /></Link> : null
          })}
        </div>
        {!shortcutIds.length && <button onClick={editShortcuts} className="min-h-24 w-full rounded-2xl border border-dashed border-emerald-200 p-5 text-sm text-emerald-700 dark:border-emerald-900 dark:text-emerald-400">Tambahkan menu yang paling sering Anda gunakan.</button>}
      </section>
      <div className="dashboard-widgets">{children}</div>
    </div>
  </div>
}
