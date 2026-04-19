// Lokasi: components/layout/sidebar.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { MENU_ITEMS } from '@/config/menu'
import { LogOut, X, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

const SIDEBAR_THEMES = [
  { id: 'emerald', label: 'Hijau', sidebarBg: 'bg-emerald-950', sidebarDarkBg: 'dark:bg-[#02241b]', text: 'text-emerald-100', textMuted: 'text-emerald-400/80', activeBg: 'bg-emerald-500/30', activeText: 'text-white', hoverBg: 'hover:bg-emerald-500/15', hoverText: 'hover:text-white', border: 'border-emerald-800/50', swatch: 'bg-emerald-500', ring: 'ring-emerald-400', scrollbarThumb: '#34d399' },
  { id: 'blue', label: 'Biru', sidebarBg: 'bg-blue-950', sidebarDarkBg: 'dark:bg-[#0b1433]', text: 'text-blue-100', textMuted: 'text-blue-400/80', activeBg: 'bg-blue-500/30', activeText: 'text-white', hoverBg: 'hover:bg-blue-500/15', hoverText: 'hover:text-white', border: 'border-blue-800/50', swatch: 'bg-blue-500', ring: 'ring-blue-400', scrollbarThumb: '#60a5fa' },
  { id: 'slate', label: 'Hitam', sidebarBg: 'bg-slate-900', sidebarDarkBg: 'dark:bg-slate-950', text: 'text-slate-300', textMuted: 'text-slate-500', activeBg: 'bg-white/10', activeText: 'text-white', hoverBg: 'hover:bg-white/5', hoverText: 'hover:text-white', border: 'border-slate-800', swatch: 'bg-slate-500', ring: 'ring-slate-400', scrollbarThumb: '#94a3b8' },
  { id: 'purple', label: 'Ungu', sidebarBg: 'bg-purple-950', sidebarDarkBg: 'dark:bg-[#200b4a]', text: 'text-purple-100', textMuted: 'text-purple-400/80', activeBg: 'bg-purple-500/30', activeText: 'text-white', hoverBg: 'hover:bg-purple-500/15', hoverText: 'hover:text-white', border: 'border-purple-800/50', swatch: 'bg-purple-500', ring: 'ring-purple-400', scrollbarThumb: '#a78bfa' },
  { id: 'rose', label: 'Merah', sidebarBg: 'bg-rose-950', sidebarDarkBg: 'dark:bg-[#330311]', text: 'text-rose-100', textMuted: 'text-rose-400/80', activeBg: 'bg-rose-500/30', activeText: 'text-white', hoverBg: 'hover:bg-rose-500/15', hoverText: 'hover:text-white', border: 'border-rose-800/50', swatch: 'bg-rose-500', ring: 'ring-rose-400', scrollbarThumb: '#fb7185' },
  { id: 'teal', label: 'Teal', sidebarBg: 'bg-teal-950', sidebarDarkBg: 'dark:bg-[#022120]', text: 'text-teal-100', textMuted: 'text-teal-400/80', activeBg: 'bg-teal-500/30', activeText: 'text-white', hoverBg: 'hover:bg-teal-500/15', hoverText: 'hover:text-white', border: 'border-teal-800/50', swatch: 'bg-teal-500', ring: 'ring-teal-400', scrollbarThumb: '#2dd4bf' },
]

type ThemeKey = typeof SIDEBAR_THEMES[number]['id']

const MENU_GROUPS = [
  { label: 'Utama', hrefs: ['/dashboard'] },
  { label: 'Data Master', hrefs: ['/dashboard/siswa', '/dashboard/guru', '/dashboard/kelas', '/dashboard/plotting'] },
  { label: 'Tugas Harian Guru', hrefs: ['/dashboard/agenda', '/dashboard/kehadiran', '/dashboard/nilai-harian', '/dashboard/penugasan'] },
  { label: 'Monitoring Akademik', hrefs: ['/dashboard/akademik', '/dashboard/akademik/nilai', '/dashboard/monitoring-agenda', '/dashboard/monitoring-penugasan', '/dashboard/analitik'] },
  { label: 'Program Khusus', hrefs: ['/dashboard/tahfidz'] },
  { label: 'Kesiswaan & BK', hrefs: ['/dashboard/rekap-absensi', '/dashboard/jadwal-piket', '/dashboard/izin', '/dashboard/kedisiplinan', '/dashboard/bk', '/dashboard/psikotes', '/dashboard/tka', '/dashboard/penerimaan-pt'] },
  { label: 'Administrasi & HR', hrefs: ['/dashboard/surat', '/dashboard/rapat', '/dashboard/sarpras', '/dashboard/kelola-ppl', '/dashboard/buku-tamu'] },
  { label: 'Keuangan', hrefs: ['/dashboard/keuangan', '/dashboard/keuangan/daftar-ulang', '/dashboard/keuangan/dspt', '/dashboard/keuangan/spp', '/dashboard/keuangan/koperasi', '/dashboard/keuangan/kas-keluar', '/dashboard/keuangan/laporan'] },
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
  const [themeId, setThemeId] = useState<ThemeKey>('slate')
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)
  const userCollapsedRef = useRef(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('mansatas_sidebar_theme') as ThemeKey
    if (saved && SIDEBAR_THEMES.find(c => c.id === saved)) setThemeId(saved)
    const savedCollapsed = localStorage.getItem('mansatas_collapsed')
    if (savedCollapsed === 'true') { setIsCollapsed(true); userCollapsedRef.current = true }
    const savedDark = localStorage.getItem('mansatas_dark') === 'true'
    setIsDark(savedDark)
    if (savedDark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [])

  useEffect(() => { setIsOpen(false) }, [pathname])

  const theme = SIDEBAR_THEMES.find(c => c.id === themeId) ?? SIDEBAR_THEMES[2]
  const activeHref = getActiveMenu(pathname, MENU_ITEMS)

  // Filter menu berdasarkan allowedFeatures dari DB
  const allowedSet = new Set(allowedFeatures)
  const allowedMenus = MENU_ITEMS.filter(item => allowedSet.has(item.id))

  const changeTheme = (id: ThemeKey) => { setThemeId(id); localStorage.setItem('mansatas_sidebar_theme', id) }

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
          'h-12 flex items-center border-b shrink-0 bg-black/10',
          theme.border,
          collapsed ? 'justify-center px-3' : 'px-4 gap-2.5'
        )}>
          <Link href="/dashboard" className={cn("flex items-center min-w-0", collapsed ? "justify-center w-full" : "gap-2.5 flex-1")}>
            <div className="relative w-8 h-8 shrink-0">
              <Image src="/logokemenag.png" alt="MAN 1 Tasikmalaya" fill className="object-contain drop-shadow-sm" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className={cn("text-[14px] font-bold leading-tight tracking-tight", theme.activeText)}>MANSATAS App</p>
                <p className="text-[10px] text-white/90 leading-tight">MAN 1 Tasikmalaya</p>
              </div>
            )}
          </Link>
          {mobile && (
            <button onClick={() => setIsOpen(false)} className={cn("p-1.5 rounded-lg transition-colors", theme.textMuted, theme.hoverBg, theme.activeText)}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── NAV ── */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 sidebar-scrollbar">
          <style>{`
            .sidebar-scrollbar {
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
            }
            .sidebar-scrollbar::-webkit-scrollbar { width: 4px; }
            .sidebar-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .sidebar-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.15); border-radius: 10px; }
            .sidebar-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.25); }
          `}</style>
          {MENU_GROUPS.map((group, gi) => {
            const groupItems = group.hrefs
              .map(href => allowedMenus.find(m => m.href === href))
              .filter(Boolean) as typeof MENU_ITEMS
            if (groupItems.length === 0) return null

            return (
              <div key={group.label} className={cn(gi > 0 && 'mt-5')}>
                {/* Section label */}
                {!collapsed && (
                  <p className={cn("px-3 pt-1 pb-2 text-[10px] font-extrabold uppercase tracking-widest select-none", theme.textMuted)}>
                    {group.label}
                  </p>
                )}
                {/* Divider tipis antar grup saat collapsed */}
                {collapsed && gi > 0 && (
                  <div className={cn("h-px mx-3 my-3", theme.border, "border-t")} />
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
                          'group flex items-center rounded-xl text-[13px] transition-all duration-300',
                          collapsed ? 'justify-center p-2.5 mx-auto w-[42px] h-[42px]' : 'gap-3 px-3 py-[9px]',
                          isActive
                            ? cn(theme.activeBg, theme.activeText, 'font-semibold shadow-sm ring-1 ring-white/5')
                            : cn(theme.text, theme.hoverBg, theme.hoverText, !collapsed && 'hover:translate-x-1')
                        )}
                      >
                        <Icon className={cn('h-[18px] w-[18px] shrink-0 transition-all duration-300', isActive ? 'opacity-100 scale-110 drop-shadow-sm' : 'opacity-70 group-hover:scale-110 group-hover:opacity-100')} />
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
        <div className={cn('border-t shrink-0 p-3 space-y-1', theme.border, mobile && 'pb-20')}>

          {/* Tema + dark toggle */}
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-black/10 dark:bg-black/20 rounded-xl">
              <span className={cn("text-[10px] font-semibold uppercase tracking-widest mr-auto", theme.textMuted)}>Tema</span>
              {SIDEBAR_THEMES.map(c => (
                <button key={c.id} onClick={() => changeTheme(c.id as ThemeKey)} title={c.label}
                  className={cn(
                    'w-3.5 h-3.5 rounded-full transition-all duration-200 shadow-sm border border-white/20', c.swatch,
                    themeId === c.id ? cn('ring-2 ring-offset-2 ring-offset-transparent', c.ring, 'scale-110') : 'opacity-60 hover:opacity-100 hover:scale-110'
                  )}
                />
              ))}
              <div className={cn("w-px h-4 mx-1.5", theme.border, "border-l")} />
              <button onClick={toggleDark} title={isDark ? 'Mode Terang' : 'Mode Gelap'}
                className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200',
                  isDark ? 'text-amber-300 hover:bg-black/20' : cn(theme.text, 'hover:bg-black/10')
                )}
              >
                {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}

          {/* Dark toggle saat collapsed */}
          {collapsed && (
            <button onClick={toggleDark} title={isDark ? 'Mode Terang' : 'Mode Gelap'}
              className={cn(
                'w-full flex justify-center p-2.5 rounded-xl transition-all duration-200 mb-2',
                theme.hoverBg,
                isDark ? 'text-amber-300' : theme.text
              )}
            >
              {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
          )}

          {/* User */}
          <Link href="/dashboard/settings/profile"
            className={cn(
              'flex items-center rounded-xl transition-all duration-200',
              theme.hoverBg,
              collapsed ? 'justify-center p-2.5 mx-auto w-[42px] h-[42px]' : 'gap-3 px-3 py-2.5'
            )}
            title={collapsed ? userName : undefined}
          >
            <div className={cn('shrink-0 rounded-full flex items-center justify-center font-bold text-[11px] shadow-sm h-7 w-7 border border-white/5', theme.swatch, theme.activeText)}>
              {userName.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className={cn("text-[12px] font-semibold truncate leading-tight", theme.activeText)}>{userName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={cn("text-[10px] truncate leading-tight capitalize", theme.textMuted)}>{roleDisplay}</span>
                  {extraRoleCount > 0 && (
                    <span className={cn("text-[9px] font-semibold px-1 py-px rounded leading-tight bg-black/20", theme.text)}>
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
              'w-full flex items-center rounded-xl transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 group',
              theme.textMuted,
              collapsed ? 'justify-center p-2.5 mx-auto w-[42px] h-[42px]' : 'gap-3 px-3 py-2.5'
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0 transition-transform duration-300 group-hover:-translate-x-1" />
            {!collapsed && <span className="text-[12px] font-medium">{isLoggingOut ? 'Keluar...' : 'Keluar Aplikasi'}</span>}
          </button>
        </div>

      </div>
    )
  }

  return (
    <>
      {isOpen && <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity" />}

      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col h-[100dvh] border-r shrink-0 sticky top-0 transition-all duration-300 ease-in-out relative',
        theme.sidebarBg, theme.sidebarDarkBg, theme.border,
        isCollapsed ? 'w-[72px]' : 'w-64'
      )}>
        {renderNavContent()}
        <button onClick={toggleCollapse}
          className={cn(
            "absolute -right-3 top-[22px] z-10 h-6 w-6 rounded-full border shadow-sm flex items-center justify-center transition-all duration-300 hover:scale-110",
            theme.sidebarBg, theme.sidebarDarkBg, theme.border, theme.text, theme.hoverText
          )}
        >
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* Mobile drawer */}
      <aside className={cn(
        'fixed top-0 left-0 z-50 h-[100dvh] w-64 border-r flex flex-col lg:hidden transition-transform duration-300 ease-in-out shadow-2xl',
        theme.sidebarBg, theme.sidebarDarkBg, theme.border,
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {renderNavContent(true)}
      </aside>

      <button id="mobile-sidebar-trigger" onClick={() => setIsOpen(true)} className="hidden" aria-label="Buka menu" />
    </>
  )
}