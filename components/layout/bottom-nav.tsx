'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, User } from '@phosphor-icons/react'
import { getIconComponent } from '@/lib/icons'
import { useDashboardNavigation } from './dashboard-navigation'

export function BottomNav({ activeIds }: { activeIds: string[] }) {
  const pathname = usePathname()
  const { menus, openMenu } = useDashboardNavigation()
  const selected = [...new Set(activeIds)].flatMap(id => menus.find(item => item.id === id) ?? []).slice(0, 4)
  function item(index: number) {
    const menu = selected[index]
    if (!menu) return <span aria-hidden="true" />
    const Icon = getIconComponent(menu.icon)
    const active = pathname === menu.href || pathname.startsWith(`${menu.href}/`)
    return <Link href={menu.href} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 focus-visible:ring-2 focus-visible:ring-emerald-500 ${active ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
      <span className="relative"><Icon weight={active ? 'fill' : 'regular'} className="h-[22px] w-[22px]" />{menu.badge > 0 && <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-rose-500"><span className="sr-only">{menu.badge} pemberitahuan</span></span>}</span>
      <span className="line-clamp-2 text-center text-[10px] leading-3">{menu.title}</span>
    </Link>
  }
  return <div className="dashboard-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white/95 px-2 pt-1 shadow-[0_-4px_24px_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
    <nav aria-label="Navigasi utama" className="mx-auto grid max-w-xl grid-cols-5 items-end gap-1">
      {item(0)}{item(1)}
      <button onClick={openMenu} aria-label="Home, buka semua menu" aria-haspopup="dialog" className="group flex min-h-16 flex-col items-center justify-end gap-1 rounded-xl pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        <span className="-mt-4 flex h-[52px] w-[52px] items-center justify-center rounded-[18px] border-4 border-white bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 transition-transform group-active:scale-95 motion-reduce:transition-none dark:border-slate-950"><House weight={pathname === '/dashboard' ? 'fill' : 'regular'} className="h-6 w-6" /></span>
        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Home</span>
      </button>
      {item(2)}
      {selected.length ? item(3) : <Link href="/dashboard/settings/profile" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-slate-500 focus-visible:ring-2 focus-visible:ring-emerald-500"><User className="h-[22px] w-[22px]" /><span className="text-[10px]">Profil</span></Link>}
    </nav>
  </div>
}
