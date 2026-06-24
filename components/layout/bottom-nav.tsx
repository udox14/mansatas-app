'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MENU_ITEMS } from '@/config/menu'
import { getIconComponent } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { House } from '@phosphor-icons/react'

type Props = {
  activeIds: string[] // dari konfigurasi admin atau override user
  allowedItems: string[] // list feature_id dari RBAC user (string)
  featureLabels?: Record<string, string>
}

export function BottomNav({ activeIds, allowedItems, featureLabels = {} }: Props) {
  const pathname = usePathname()

  // Filter menu: hanya ambil yang ada di activeIds DAN allowedItems, jangan ambil dashboard karena dashboard akan difix di tengah
  const navItems = activeIds
    .filter(id => allowedItems.includes(id) && id !== 'dashboard')
    .map(id => MENU_ITEMS.find(item => item.id === id))
    .filter(Boolean) as typeof MENU_ITEMS

  // Batasi max 4 (karena 1 untuk Home di tengah)
  const selectedFeatures = navItems.slice(0, 4)
  
  // Pisahkan kiri dan kanan agar Home bisa di tengah
  const leftItems = selectedFeatures.slice(0, 2)
  const rightItems = selectedFeatures.slice(2, 4)

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 safe-area-pb shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
      <nav className="flex items-end justify-around px-2 h-16 relative">
        
        {/* LEFT ITEMS */}
        {leftItems.map((item) => {
          const Icon = getIconComponent(item.icon)
          const isActive = pathname.startsWith(item.href) && item.href !== '/dashboard'

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-start w-16 h-14 gap-1 pt-1.5 transition-colors",
                isActive 
                  ? "text-emerald-600 dark:text-emerald-400" 
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              <div className={cn("relative flex items-center justify-center transition-all duration-300", isActive ? "-translate-y-0.5" : "")}>
                <Icon weight={isActive ? "fill" : "regular"} className="h-[22px] w-[22px] shrink-0" />
              </div>
              <span className={cn(
                "text-[9px] text-center leading-tight tracking-tight line-clamp-2 w-full px-0.5", 
                isActive ? "font-bold" : "font-medium"
              )}>
                {featureLabels[item.id] || item.title}
              </span>
            </Link>
          )
        })}

        {/* CENTER HOME BUTTON */}
        <Link
          href="/dashboard"
          className="flex flex-col items-center justify-end w-16 h-full relative group z-10"
        >
          <div className="absolute -top-5 flex items-center justify-center w-[52px] h-[52px] bg-emerald-600 hover:bg-emerald-700 rounded-full text-white shadow-[0_4px_12px_rgba(5,150,105,0.4)] border-[4px] border-white dark:border-slate-950 transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
            <House weight={pathname === '/dashboard' ? "fill" : "regular"} className="h-6 w-6" />
          </div>
          <span className={cn(
            "text-[9px] text-center leading-tight tracking-tight mb-1.5",
            pathname === '/dashboard' ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-medium text-slate-500 dark:text-slate-400"
          )}>
            HOME
          </span>
        </Link>

        {/* RIGHT ITEMS */}
        {rightItems.map((item) => {
          const Icon = getIconComponent(item.icon)
          const isActive = pathname.startsWith(item.href) && item.href !== '/dashboard'

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-start w-16 h-14 gap-1 pt-1.5 transition-colors",
                isActive 
                  ? "text-emerald-600 dark:text-emerald-400" 
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              <div className={cn("relative flex items-center justify-center transition-all duration-300", isActive ? "-translate-y-0.5" : "")}>
                <Icon weight={isActive ? "fill" : "regular"} className="h-[22px] w-[22px] shrink-0" />
              </div>
              <span className={cn(
                "text-[9px] text-center leading-tight tracking-tight line-clamp-2 w-full px-0.5", 
                isActive ? "font-bold" : "font-medium"
              )}>
                {featureLabels[item.id] || item.title}
              </span>
            </Link>
          )
        })}

      </nav>
    </div>
  )
}
