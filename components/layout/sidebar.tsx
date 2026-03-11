// Lokasi: components/layout/sidebar.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { MENU_ITEMS } from '@/config/menu'
import { LogOut, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCENT_COLORS = [
  { id: 'emerald', label: 'Hijau',  active: 'bg-emerald-600 text-white', swatch: 'bg-emerald-500', ring: 'ring-emerald-400' },
  { id: 'blue',    label: 'Biru',   active: 'bg-blue-600 text-white',    swatch: 'bg-blue-500',    ring: 'ring-blue-400' },
  { id: 'violet',  label: 'Ungu',   active: 'bg-violet-600 text-white',  swatch: 'bg-violet-500',  ring: 'ring-violet-400' },
  { id: 'rose',    label: 'Merah',  active: 'bg-rose-600 text-white',    swatch: 'bg-rose-500',    ring: 'ring-rose-400' },
  { id: 'amber',   label: 'Amber',  active: 'bg-amber-500 text-white',   swatch: 'bg-amber-400',   ring: 'ring-amber-300' },
  { id: 'cyan',    label: 'Cyan',   active: 'bg-cyan-600 text-white',    swatch: 'bg-cyan-500',    ring: 'ring-cyan-400' },
]

type AccentKey = typeof ACCENT_COLORS[number]['id']

export function Sidebar({ userRole = 'guru', userName = 'Pengguna' }: { userRole?: string, userName?: string }) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [accentId, setAccentId] = useState<AccentKey>('emerald')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('mansatas_accent') as AccentKey
    if (saved && ACCENT_COLORS.find(c => c.id === saved)) setAccentId(saved)
  }, [])

  const accent = ACCENT_COLORS.find(c => c.id === accentId) ?? ACCENT_COLORS[0]

  const changeAccent = (id: AccentKey) => {
    setAccentId(id)
    localStorage.setItem('mansatas_accent', id)
  }

  useEffect(() => setIsOpen(false), [pathname])

  const allowedMenus = MENU_ITEMS.filter(item => item.roles.includes(userRole))

  const handleLogout = async () => {
    if (!confirm('Yakin ingin keluar dari aplikasi?')) return
    setIsLoggingOut(true)
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include',
    })
    window.location.href = '/login'
  }

  if (!mounted) return null

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        "flex items-center border-b border-slate-100 shrink-0",
        (!mobile && isCollapsed) ? "justify-center px-3 py-4" : "gap-2.5 px-4 py-3.5"
      )}>
        <Link href="/dashboard" className="flex items-center gap-2.5 group min-w-0 flex-1">
          <div className="relative w-7 h-7 shrink-0">
            <Image src="/logokemenag.png" alt="MANSATAS" fill className="object-contain" />
          </div>
          {(mobile || !isCollapsed) && (
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-slate-900 leading-tight">MANSATAS</p>
              <p className="text-[10px] text-slate-400 leading-tight">MAN 1 Tasikmalaya</p>
            </div>
          )}
        </Link>
        {mobile && (
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {allowedMenus.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          const collapsed = !mobile && isCollapsed

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.title : undefined}
              className={cn(
                "flex items-center rounded-md text-[13px] transition-colors duration-150",
                collapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2",
                isActive
                  ? cn(accent.active, "font-medium shadow-sm")
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "opacity-100" : "opacity-60")} />
              {!collapsed && <span className="truncate">{item.title}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className={cn(
        "border-t border-slate-100 shrink-0 p-2 space-y-1",
        (!mobile && isCollapsed) && "px-2"
      )}>
        {/* Accent picker */}
        {(mobile || !isCollapsed) && (
          <div className="flex items-center gap-1 px-2 py-1.5">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mr-auto">Tema</span>
            {ACCENT_COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => changeAccent(c.id as AccentKey)}
                title={c.label}
                className={cn(
                  "w-3 h-3 rounded-full transition-all duration-200",
                  c.swatch,
                  accentId === c.id
                    ? cn("ring-2 ring-offset-1", c.ring, "scale-125")
                    : "opacity-40 hover:opacity-70 hover:scale-110"
                )}
              />
            ))}
          </div>
        )}

        {/* User */}
        <Link
          href="/dashboard/settings/profile"
          className={cn(
            "flex items-center rounded-md hover:bg-slate-100 transition-colors",
            (!mobile && isCollapsed) ? "justify-center p-2.5" : "gap-2.5 px-2 py-2"
          )}
          title={(!mobile && isCollapsed) ? userName : undefined}
        >
          <div className={cn(
            "shrink-0 rounded-full flex items-center justify-center font-semibold text-[11px] text-white h-6 w-6",
            accent.active
          )}>
            {userName.charAt(0).toUpperCase()}
          </div>
          {(mobile || !isCollapsed) && (
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-slate-800 truncate leading-tight">{userName}</p>
              <p className="text-[10px] text-slate-400 truncate leading-tight capitalize">{userRole.replace(/_/g, ' ')}</p>
            </div>
          )}
        </Link>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          title={(!mobile && isCollapsed) ? "Keluar" : undefined}
          className={cn(
            "w-full flex items-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors",
            (!mobile && isCollapsed) ? "justify-center p-2.5" : "gap-2.5 px-2 py-2"
          )}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          {(mobile || !isCollapsed) && (
            <span className="text-[12px] font-medium">{isLoggingOut ? 'Keluar...' : 'Keluar Aplikasi'}</span>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/40 z-40 lg:hidden" />
      )}

      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col h-[100dvh] bg-white border-r border-slate-200 shrink-0 sticky top-0 transition-all duration-300 relative",
        isCollapsed ? "w-[52px]" : "w-52"
      )}>
        <NavContent />
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-14 z-10 h-5 w-5 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
        >
          {isCollapsed
            ? <ChevronRight className="h-3 w-3" />
            : <ChevronLeft className="h-3 w-3" />
          }
        </button>
      </aside>

      {/* Mobile drawer */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-[100dvh] w-56 bg-white border-r border-slate-200 flex flex-col lg:hidden transition-transform duration-300 ease-in-out shadow-xl",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <NavContent mobile />
      </aside>

      {/* Mobile trigger (used by header) */}
      <button
        id="mobile-sidebar-trigger"
        onClick={() => setIsOpen(true)}
        className="hidden"
        aria-label="Buka menu"
      />
    </>
  )
}