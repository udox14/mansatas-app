// Lokasi: components/layout/sidebar.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { MENU_ITEMS } from '@/config/menu'
import { LogOut, X, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCENT_COLORS = [
  { id: 'emerald', label: 'Hijau',  active: 'bg-emerald-600 text-white', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', swatch: 'bg-emerald-500', ring: 'ring-emerald-400' },
  { id: 'blue',    label: 'Biru',   active: 'bg-blue-600 text-white',    text: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-950/40',       swatch: 'bg-blue-500',   ring: 'ring-blue-400' },
  { id: 'violet',  label: 'Ungu',   active: 'bg-violet-600 text-white',  text: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-50 dark:bg-violet-950/40',   swatch: 'bg-violet-500', ring: 'ring-violet-400' },
  { id: 'rose',    label: 'Merah',  active: 'bg-rose-600 text-white',    text: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-50 dark:bg-rose-950/40',       swatch: 'bg-rose-500',   ring: 'ring-rose-400' },
  { id: 'amber',   label: 'Amber',  active: 'bg-amber-500 text-white',   text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-950/40',     swatch: 'bg-amber-400',  ring: 'ring-amber-300' },
  { id: 'cyan',    label: 'Cyan',   active: 'bg-cyan-600 text-white',    text: 'text-cyan-600 dark:text-cyan-400',       bg: 'bg-cyan-50 dark:bg-cyan-950/40',       swatch: 'bg-cyan-500',   ring: 'ring-cyan-400' },
]

type AccentKey = typeof ACCENT_COLORS[number]['id']

const getAccentHex = (id: AccentKey) => {
  const map: Record<string, string> = {
    emerald: '#10b981', blue: '#3b82f6', violet: '#8b5cf6',
    rose: '#f43f5e', amber: '#f59e0b', cyan: '#06b6d4'
  }
  return map[id as string] || '#cbd5e1'
}

const MENU_GROUPS = [
  { label: 'Utama', hrefs: ['/dashboard'] },
  { label: 'Data Master', hrefs: ['/dashboard/siswa', '/dashboard/guru', '/dashboard/kelas', '/dashboard/plotting'] },
  { label: 'Tugas Harian Guru', hrefs: ['/dashboard/agenda', '/dashboard/kehadiran', '/dashboard/nilai-harian', '/dashboard/penugasan'] },
  { label: 'Monitoring Akademik', hrefs: ['/dashboard/akademik', '/dashboard/akademik/nilai', '/dashboard/monitoring-agenda', '/dashboard/monitoring-penugasan'] },
  { label: 'Program Khusus', hrefs: ['/dashboard/tahfidz', '/dashboard/program-unggulan', '/dashboard/program-unggulan/kelola'] },
  { label: 'Kesiswaan & BK', hrefs: ['/dashboard/rekap-absensi', '/dashboard/jadwal-piket', '/dashboard/izin', '/dashboard/kedisiplinan', '/dashboard/bk', '/dashboard/psikotes'] },
  { label: 'Administrasi & HR', hrefs: ['/dashboard/presensi', '/dashboard/monitoring-presensi', '/dashboard/surat', '/dashboard/rapat', '/dashboard/sarpras', '/dashboard/kelola-ppl', '/dashboard/buku-tamu'] },
  { label: 'Sistem', hrefs: ['/dashboard/settings', '/dashboard/settings/notifications', '/dashboard/settings/jadwal-notif', '/dashboard/settings/fitur'] },
]

function getActiveMenu(pathname: string, menuItems: typeof MENU_ITEMS) {
  const sorted = [...menuItems].sort((a, b) => b.href.length - a.href.length)
  for (const item of sorted) {
    if (item.href === '/dashboard') {
      if (pathname === '/dashboard') return item.href
    } else {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) return item.href
    }
  }
  return null
}

interface SidebarProps {
  userRoles?: string[]
  primaryRole?: string
  userName?: string
  allowedFeatures?: string[]
}

export function Sidebar({
  userRoles = ['guru'],
  primaryRole = 'guru',
  userName = 'Pengguna',
  allowedFeatures = [],
}: SidebarProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [accentId, setAccentId] = useState<AccentKey>('emerald')
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)
  const userCollapsedRef = useRef(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('mansatas_accent') as AccentKey
    if (saved && ACCENT_COLORS.find(c => c.id === saved)) setAccentId(saved)
    const savedCollapsed = localStorage.getItem('mansatas_collapsed')
    if (savedCollapsed === 'true') { setIsCollapsed(true); userCollapsedRef.current = true }
    const savedDark = localStorage.getItem('mansatas_dark') === 'true'
    setIsDark(savedDark)
    if (savedDark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [])

  useEffect(() => { setIsOpen(false) }, [pathname])

  const accent = ACCENT_COLORS.find(c => c.id === accentId) ?? ACCENT_COLORS[0]
  const activeHref = getActiveMenu(pathname, MENU_ITEMS)

  // Filter menu berdasarkan allowedFeatures dari DB
  const allowedSet = new Set(allowedFeatures)
  const allowedMenus = MENU_ITEMS.filter(item => allowedSet.has(item.id))

  const changeAccent = (id: AccentKey) => { setAccentId(id); localStorage.setItem('mansatas_accent', id) }

  const toggleDark = () => {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem('mansatas_dark', String(next))
    if (next) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }

  const toggleCollapse = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    userCollapsedRef.current = next
    localStorage.setItem('mansatas_collapsed', String(next))
  }

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

  // Format role display
  const roleDisplay = primaryRole.replace(/_/g, ' ')
  const extraRoleCount = userRoles.length > 1 ? userRoles.length - 1 : 0

  const renderNavContent = (mobile = false) => {
    const collapsed = !mobile && isCollapsed
    return (
      <div className="flex flex-col h-full">

        {/* ── LOGO — h-12 sejajar header ── */}
        <div className={cn(
          'h-12 flex items-center border-b border-slate-100 dark:border-slate-700/60 shrink-0',
          collapsed ? 'justify-center px-3' : 'px-4 gap-2.5'
        )}>
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="relative w-6 h-6 shrink-0">
              <Image src="/logokemenag.png" alt="MAN 1 Tasikmalaya" fill className="object-contain" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 leading-tight tracking-tight">MANSATAS</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">MAN 1 Tasikmalaya</p>
              </div>
            )}
          </Link>
          {mobile && (
            <button onClick={() => setIsOpen(false)} className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── NAV ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 custom-scrollbar">
          <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 5px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background-color: ${getAccentHex(accentId)}80; border-radius: 10px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: ${getAccentHex(accentId)}; }
          `}</style>
          {MENU_GROUPS.map((group, gi) => {
            const groupItems = group.hrefs
              .map(href => allowedMenus.find(m => m.href === href))
              .filter(Boolean) as typeof MENU_ITEMS
            if (groupItems.length === 0) return null

            return (
              <div key={group.label} className={cn(gi > 0 && 'mt-4')}>
                {/* Section label */}
                {!collapsed && (
                  <p className="px-3 pt-1 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400/80 dark:text-slate-500 select-none">
                    {group.label}
                  </p>
                )}
                {/* Divider tipis antar grup saat collapsed */}
                {collapsed && gi > 0 && (
                  <div className="h-px bg-slate-100 dark:bg-slate-700/60 mx-2 my-2.5" />
                )}
                <div className="space-y-1">
                  {groupItems.map(item => {
                    const isActive = activeHref === item.href
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.title : undefined}
                        className={cn(
                          'group flex items-center rounded-xl text-[13px] transition-all duration-200',
                          collapsed ? 'justify-center p-2.5 mx-auto w-10 h-10' : 'gap-3 px-3 py-[9px]',
                          isActive
                            ? cn(accent.bg, accent.text, 'font-semibold shadow-sm ring-1 ring-black/5 dark:ring-white/5')
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100 hover:translate-x-0.5'
                        )}
                      >
                        <Icon className={cn('h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110', !isActive && 'opacity-70')} />
                        {!collapsed && <span className="truncate leading-snug">{item.title}</span>}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* ── FOOTER ── */}
        <div className={cn('border-t border-slate-100 dark:border-slate-700/60 shrink-0 p-2 space-y-0.5', mobile && 'pb-20')}>

          {/* Tema + dark toggle */}
          {!collapsed && (
            <div className="flex items-center gap-1.5 px-3 py-2">
              <span className="text-[10px] text-slate-400 dark:text-slate-600 font-medium uppercase tracking-widest mr-auto">Tema</span>
              {ACCENT_COLORS.map(c => (
                <button key={c.id} onClick={() => changeAccent(c.id as AccentKey)} title={c.label}
                  className={cn(
                    'w-3 h-3 rounded-full transition-all duration-150', c.swatch,
                    accentId === c.id ? cn('ring-2 ring-offset-1', c.ring, 'scale-125') : 'opacity-30 hover:opacity-60 hover:scale-110'
                  )}
                />
              ))}
              <button onClick={toggleDark} title={isDark ? 'Mode Terang' : 'Mode Gelap'}
                className={cn(
                  'ml-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-all duration-150',
                  isDark ? 'bg-slate-700 text-amber-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                )}
              >
                {isDark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
              </button>
            </div>
          )}

          {/* Dark toggle saat collapsed */}
          {collapsed && (
            <button onClick={toggleDark} title={isDark ? 'Mode Terang' : 'Mode Gelap'}
              className={cn(
                'w-full flex justify-center p-2.5 rounded-lg transition-colors',
                isDark ? 'text-amber-300 hover:bg-slate-700' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          )}

          {/* User */}
          <Link href="/dashboard/settings/profile"
            className={cn(
              'flex items-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
              collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
            )}
            title={collapsed ? userName : undefined}
          >
            <div className={cn('shrink-0 rounded-full flex items-center justify-center font-semibold text-[11px] text-white h-6 w-6', accent.active)}>
              {userName.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">{userName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-tight capitalize">{roleDisplay}</span>
                  {extraRoleCount > 0 && (
                    <span className="text-[9px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1 py-px rounded leading-tight">
                      +{extraRoleCount}
                    </span>
                  )}
                </div>
              </div>
            )}
          </Link>

          {/* Logout */}
          <button onClick={handleLogout} disabled={isLoggingOut}
            title={collapsed ? 'Keluar' : undefined}
            className={cn(
              'w-full flex items-center rounded-lg transition-colors text-slate-400 dark:text-slate-500 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400',
              collapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2'
            )}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span className="text-[12px] font-medium">{isLoggingOut ? 'Keluar...' : 'Keluar Aplikasi'}</span>}
          </button>
        </div>

      </div>
    )
  }

  return (
    <>
      {isOpen && <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/40 z-40 lg:hidden" />}

      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col h-[100dvh] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/60 shrink-0 sticky top-0 transition-all duration-300 relative',
        isCollapsed ? 'w-[52px]' : 'w-52'
      )}>
        {renderNavContent()}
        <button onClick={toggleCollapse}
          className="absolute -right-3 top-[24px] z-10 h-5 w-5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Mobile drawer */}
      <aside className={cn(
        'fixed top-0 left-0 z-50 h-[100dvh] w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/60 flex flex-col lg:hidden transition-transform duration-300 ease-in-out shadow-xl',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {renderNavContent(true)}
      </aside>

      <button id="mobile-sidebar-trigger" onClick={() => setIsOpen(true)} className="hidden" aria-label="Buka menu" />
    </>
  )
}