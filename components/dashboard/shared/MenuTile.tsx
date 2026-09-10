'use client'

import { getIconComponent } from '@/lib/icons'
import { MENU_ITEMS } from '@/config/menu'
import type { DashboardMenuItem } from '@/lib/dashboard-menu'

const MENU_ICONS = Object.fromEntries(MENU_ITEMS.map(item => [String(item.icon), getIconComponent(String(item.icon))]))

const COLORS = [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
]

export function MenuTile({ item }: { item: DashboardMenuItem }) {
  const Icon = MENU_ICONS[item.icon]
  const color = [...item.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % COLORS.length
  return <>
    <span className={`relative mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] sm:h-16 sm:w-16 ${COLORS[color]}`}>
      <Icon weight="duotone" className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
      {item.badge > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-5 text-white ring-2 ring-white dark:ring-slate-950">
        {item.badge > 99 ? '99+' : item.badge}<span className="sr-only"> pemberitahuan</span>
      </span>}
    </span>
    <span className="mt-2 block break-words text-center text-[11px] font-medium leading-4 text-slate-700 dark:text-slate-200 sm:text-xs">{item.title}</span>
  </>
}

export const menuTileClass = 'min-w-0 rounded-2xl px-1 py-2 text-center transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 motion-reduce:transition-none'
