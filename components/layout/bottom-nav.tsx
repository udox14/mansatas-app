'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MENU_ITEMS } from '@/config/menu'

type Props = {
  activeIds: string[] // dari konfigurasi admin
  allowedItems: string[] // list feature_id dari RBAC user (string)
}

export function BottomNav({ activeIds, allowedItems }: Props) {
  const pathname = usePathname()

  // Filter menu: hanya ambil yang ada di activeIds DAN allowedItems
  // Urutannya mengikuti activeIds (konfigurasi admin)
  // Dan item tersebut harus ada di allowedItems (RBAC user punya hak akse)
  const navItems = activeIds
    .filter(id => allowedItems.includes(id))
    .map(id => MENU_ITEMS.find(item => item.id === id))
    .filter((item) => item !== undefined)

  if (navItems.length === 0) return null

  // Batasi max 5 (meskipun admin set di UI max 5, kita pastikan lagi)
  const displayItems = navItems.slice(0, 5)

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 safe-area-pb">
      <nav className="flex items-center justify-around px-1 min-h-[64px] py-1">
        {displayItems.map((item) => {
          const Icon = item.icon
          // Deteksi aktif: kalau href === pathname, atau pathname startswith href/ (tapi hati2 dashboard '/')
          let isActive = false
          if (item.href === '/dashboard') {
            isActive = pathname === '/dashboard'
          } else {
            isActive = pathname.startsWith(item.href)
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full gap-0.5 px-0.5 transition-colors ${
                isActive 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <div className={`relative p-1 rounded-xl transition-all ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/30' : ''}`}>
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'stroke-[2.5px]' : ''}`} />
              </div>
              <span className={`text-[9px] text-center leading-[1.1] tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.title}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
