// TIMPA SELURUH ISI FILE INI
// Lokasi: components/layout/sidebar.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MENU_ITEMS } from '@/config/menu'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname()
  // State untuk melipat sidebar
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Filter menu berdasarkan role user yang login
  const filteredMenu = MENU_ITEMS.filter((item) => item.roles.includes(userRole))

  return (
    <aside 
      className={cn(
        "hidden md:flex flex-col bg-slate-950 border-r border-slate-800 transition-all duration-300 relative text-slate-300 shadow-2xl z-40",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo Area */}
      <div className="flex h-16 items-center border-b border-slate-800/80 px-4 justify-center">
        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center font-black shadow-[0_0_15px_rgba(52,211,153,0.4)]">
            M
          </div>
          {!isCollapsed && (
            <span className="font-bold text-xl text-white tracking-tight whitespace-nowrap">
              MANSATAS
            </span>
          )}
        </Link>
      </div>

      {/* Tombol Toggle Fold/Unfold */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-slate-400 border border-slate-700 hover:bg-emerald-500 hover:text-slate-950 hover:border-emerald-400 transition-all shadow-md z-50 focus:outline-none"
        title={isCollapsed ? "Perlebar Menu" : "Lipat Menu"}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4 ml-0.5" /> : <ChevronLeft className="h-4 w-4 mr-0.5" />}
      </button>

      {/* Navigasi Menu */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar mt-2">
        {!isCollapsed && (
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 px-3 mt-2">
            Menu Utama
          </div>
        )}
        
        {filteredMenu.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.title : undefined}
              className={cn(
                "flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 group relative",
                isActive 
                  ? "bg-emerald-500/10 text-emerald-400 shadow-[inset_0_1px_0_rgba(52,211,153,0.1)]" 
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 shrink-0 transition-colors", 
                isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-emerald-300"
              )} />
              
              {!isCollapsed && (
                <span className="ml-3 truncate">{item.title}</span>
              )}
              
              {/* Indikator Titik Hijau untuk Menu Aktif */}
              {isActive && !isCollapsed && (
                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer Info (Tersembunyi jika dilipat) */}
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-800/80 text-xs text-slate-500 font-medium text-center">
          &copy; 2026 MAN 1 Tasikmalaya
        </div>
      )}
    </aside>
  )
}