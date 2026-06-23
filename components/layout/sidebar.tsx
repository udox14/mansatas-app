// Lokasi: components/layout/sidebar.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { DEFAULT_SIDEBAR_GROUPS, MENU_ITEMS, type SidebarGroupConfig } from '@/config/menu'
import { SignOut as LogOut, X, CaretLeft as ChevronLeft, CaretRight as ChevronRight, CaretDown as ChevronDown, Moon, Sun, MagnifyingGlass as Search } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { getIconComponent } from '@/lib/icons'

const SIDEBAR_THEMES = [
  { id: 'emerald', label: 'Hijau', sidebarBg: 'bg-emerald-950', sidebarDarkBg: 'dark:bg-[#02241b]', text: 'text-emerald-100', textMuted: 'text-emerald-400/80', activeBg: 'bg-emerald-500/30', activeText: 'text-white', hoverBg: 'hover:bg-emerald-500/15', hoverText: 'hover:text-white', border: 'border-emerald-800/50', swatch: 'bg-emerald-500', ring: 'ring-emerald-400', scrollbarThumb: '#34d399' },
  { id: 'blue', label: 'Biru', sidebarBg: 'bg-blue-950', sidebarDarkBg: 'dark:bg-[#0b1433]', text: 'text-blue-100', textMuted: 'text-blue-400/80', activeBg: 'bg-blue-500/30', activeText: 'text-white', hoverBg: 'hover:bg-blue-500/15', hoverText: 'hover:text-white', border: 'border-blue-800/50', swatch: 'bg-blue-500', ring: 'ring-blue-400', scrollbarThumb: '#60a5fa' },
  { id: 'slate', label: 'Hitam', sidebarBg: 'bg-slate-900', sidebarDarkBg: 'dark:bg-slate-950', text: 'text-slate-300', textMuted: 'text-slate-500', activeBg: 'bg-white/10', activeText: 'text-white', hoverBg: 'hover:bg-white/5', hoverText: 'hover:text-white', border: 'border-slate-800', swatch: 'bg-slate-500', ring: 'ring-slate-400', scrollbarThumb: '#94a3b8' },
  { id: 'purple', label: 'Ungu', sidebarBg: 'bg-purple-950', sidebarDarkBg: 'dark:bg-[#200b4a]', text: 'text-purple-100', textMuted: 'text-purple-400/80', activeBg: 'bg-purple-500/30', activeText: 'text-white', hoverBg: 'hover:bg-purple-500/15', hoverText: 'hover:text-white', border: 'border-purple-800/50', swatch: 'bg-purple-500', ring: 'ring-purple-400', scrollbarThumb: '#a78bfa' },
  { id: 'rose', label: 'Merah', sidebarBg: 'bg-rose-950', sidebarDarkBg: 'dark:bg-[#330311]', text: 'text-rose-100', textMuted: 'text-rose-400/80', activeBg: 'bg-rose-500/30', activeText: 'text-white', hoverBg: 'hover:bg-rose-500/15', hoverText: 'hover:text-white', border: 'border-rose-800/50', swatch: 'bg-rose-500', ring: 'ring-rose-400', scrollbarThumb: '#fb7185' },
  { id: 'amber', label: 'Senja', sidebarBg: 'bg-orange-950', sidebarDarkBg: 'dark:bg-[#2e1005]', text: 'text-orange-100', textMuted: 'text-orange-400/80', activeBg: 'bg-orange-500/30', activeText: 'text-white', hoverBg: 'hover:bg-orange-500/15', hoverText: 'hover:text-white', border: 'border-orange-800/50', swatch: 'bg-orange-500', ring: 'ring-orange-400', scrollbarThumb: '#fb923c' },
]

type ThemeKey = typeof SIDEBAR_THEMES[number]['id']

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
  sidebarGroups?: SidebarGroupConfig[]
  featureLabels?: Record<string, string>
}

export function Sidebar({
  userRoles = ['guru'],
  primaryRole = 'guru',
  userName = 'Pengguna',
  allowedFeatures = [],
  sidebarGroups = DEFAULT_SIDEBAR_GROUPS,
  featureLabels = {},
}: SidebarProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [themeId, setThemeId] = useState<ThemeKey>('slate')
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [openGroupIds, setOpenGroupIds] = useState<string[]>([])
  const [menuSearch, setMenuSearch] = useState('')
  const userCollapsedRef = useRef(false)
  const initializedAccordionRef = useRef(false)

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
  const allowedMenus = MENU_ITEMS.filter(item =>
    allowedSet.has(item.id) ||
    (item.id === 'keuangan-transaksi' && allowedSet.has('keuangan-laporan')) ||
    (item.id === 'keuangan-export' && (allowedSet.has('keuangan-dspt') || allowedSet.has('keuangan-spp')))
  )
  const configuredMenuIds = new Set(sidebarGroups.flatMap(group => group.items))
  const unconfiguredAllowedIds = allowedMenus
    .map(item => item.id)
    .filter(id => !configuredMenuIds.has(id))
  const effectiveSidebarGroups = unconfiguredAllowedIds.length > 0
    ? [...sidebarGroups, { id: 'lainnya', label: 'Lainnya', items: unconfiguredAllowedIds }]
    : sidebarGroups
  const effectiveGroupIds = effectiveSidebarGroups.map(group => group.id)
  const activeGroupId = effectiveSidebarGroups.find(group =>
    group.items.some(id => allowedMenus.find(item => item.id === id)?.href === activeHref)
  )?.id
  const normalizedMenuSearch = menuSearch.trim().toLowerCase()

  useEffect(() => {
    if (!mounted || initializedAccordionRef.current) return

    const savedRaw = localStorage.getItem('mansatas_sidebar_open_groups')
    let savedGroups: string[] = []

    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw)
        if (Array.isArray(parsed)) savedGroups = parsed.filter(id => typeof id === 'string')
      } catch {}
    }

    const validSavedGroups = savedGroups.filter(id => effectiveGroupIds.includes(id))
    const defaultGroups = validSavedGroups.length > 0
      ? validSavedGroups
      : effectiveSidebarGroups.slice(0, 2).map(group => group.id)

    if (activeGroupId && !defaultGroups.includes(activeGroupId)) defaultGroups.push(activeGroupId)

    setOpenGroupIds(defaultGroups)
    initializedAccordionRef.current = true
  }, [mounted, activeGroupId, effectiveGroupIds, effectiveSidebarGroups])

  useEffect(() => {
    if (!mounted || !activeGroupId || openGroupIds.includes(activeGroupId)) return
    setOpenGroupIds(prev => {
      const next = [...prev, activeGroupId]
      localStorage.setItem('mansatas_sidebar_open_groups', JSON.stringify(next))
      return next
    })
  }, [mounted, activeGroupId, openGroupIds])

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
    window.location.href = '/'
  }

  const toggleGroup = (groupId: string) => {
    setOpenGroupIds(prev => {
      const next = prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
      localStorage.setItem('mansatas_sidebar_open_groups', JSON.stringify(next))
      return next
    })
  }

  if (!mounted) return null

  // Format role display
  const roleDisplay = primaryRole.replace(/_/g, ' ')
  const extraRoleCount = userRoles.length > 1 ? userRoles.length - 1 : 0

  const renderNavContent = (mobile = false) => {
    const collapsed = !mobile && isCollapsed
    const visibleGroups = effectiveSidebarGroups
      .map(group => {
        const allGroupItems = group.items
          .map(id => allowedMenus.find(m => m.id === id))
          .filter(Boolean) as typeof MENU_ITEMS
        const groupMatchesSearch = normalizedMenuSearch.length > 0 &&
          group.label.toLowerCase().includes(normalizedMenuSearch)
        const groupItems = normalizedMenuSearch.length > 0
          ? allGroupItems.filter(item => {
              const label = (featureLabels[item.id] || item.title).toLowerCase()
              return groupMatchesSearch || label.includes(normalizedMenuSearch) || item.id.toLowerCase().includes(normalizedMenuSearch)
            })
          : allGroupItems

        return { group, groupItems }
      })
      .filter(({ groupItems }) => groupItems.length > 0)

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
          {!collapsed && (
            <div className="mb-3">
              <div className={cn(
                'flex items-center gap-2 rounded-xl border bg-black/15 px-3 py-2 transition-colors focus-within:bg-black/25',
                theme.border
              )}>
                <Search className={cn('h-4 w-4 shrink-0', theme.textMuted)} />
                <input
                  value={menuSearch}
                  onChange={(event) => setMenuSearch(event.target.value)}
                  placeholder="Cari menu..."
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-white/35 outline-none"
                  aria-label="Cari menu sidebar"
                />
                {menuSearch && (
                  <button
                    type="button"
                    onClick={() => setMenuSearch('')}
                    className={cn('rounded-md p-1 transition-colors', theme.textMuted, 'hover:bg-white/10 hover:text-white')}
                    aria-label="Hapus pencarian menu"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {visibleGroups.length === 0 && !collapsed && (
            <div className={cn('rounded-xl border border-dashed px-3 py-4 text-center text-[12px]', theme.border, theme.textMuted)}>
              Menu tidak ditemukan
            </div>
          )}

          {visibleGroups.map(({ group, groupItems }, gi) => {
            const GroupIcon = groupItems[0] ? getIconComponent(groupItems[0].icon) : null
            const isGroupOpen = collapsed || normalizedMenuSearch.length > 0 || openGroupIds.includes(group.id)
            const hasActiveItem = group.id === activeGroupId

            return (
              <div key={group.id || group.label} className={cn(gi > 0 && (collapsed ? 'mt-2' : 'mt-3'))}>
                {/* Section label */}
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={cn(
                      'group/header flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200',
                      hasActiveItem ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/5' : cn(theme.text, 'hover:bg-white/5 hover:text-white')
                    )}
                    aria-expanded={isGroupOpen}
                    aria-controls={`sidebar-group-${group.id}`}
                  >
                    <span className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                      hasActiveItem ? cn(theme.activeBg, theme.activeText) : 'bg-black/15 text-white/70 group-hover/header:bg-white/10 group-hover/header:text-white'
                    )}>
                      {GroupIcon && <GroupIcon className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-snug text-white/90 group-hover/header:text-white">
                        {group.label}
                      </span>
                      <span className={cn("mt-0.5 block text-[10px] font-medium leading-tight", theme.textMuted)}>
                        {groupItems.length} menu
                      </span>
                    </span>
                    <ChevronDown className={cn(
                      'mt-2 h-4 w-4 shrink-0 text-white/50 transition-transform duration-300 group-hover/header:text-white/80',
                      isGroupOpen ? 'rotate-0' : '-rotate-90'
                    )} />
                  </button>
                )}
                {/* Divider tipis antar grup saat collapsed */}
                {collapsed && gi > 0 && (
                  <div className={cn("h-px mx-3 my-3", theme.border, "border-t")} />
                )}
                <div
                  id={`sidebar-group-${group.id}`}
                  className={cn(
                    'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out',
                    isGroupOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  )}
                >
                  <div className={cn('min-h-0 overflow-hidden', !collapsed && 'pt-2')}>
                <div className={cn("space-y-0.5", !collapsed && "relative ml-7 border-l border-white/10 pl-3")}>
                  {groupItems.map(item => {
                    const isActive = activeHref === item.href
                    const Icon = getIconComponent(item.icon)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? (featureLabels[item.id] || item.title) : undefined}
                        className={cn(
                          'group flex items-center rounded-lg text-[13px] transition-all duration-300',
                          collapsed ? 'justify-center p-2.5 mx-auto w-[42px] h-[42px]' : 'gap-2.5 px-2.5 py-2',
                          isActive
                            ? cn(theme.activeBg, theme.activeText, 'font-semibold shadow-sm ring-1 ring-white/5')
                            : cn(theme.text, theme.hoverBg, theme.hoverText, !collapsed && 'hover:translate-x-0.5')
                        )}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0 transition-all duration-300', isActive ? 'opacity-100 scale-105 drop-shadow-sm' : 'opacity-60 group-hover:opacity-100')} />
                        {!collapsed && <span className="truncate leading-snug">{featureLabels[item.id] || item.title}</span>}
                      </Link>
                    )
                  })}
                </div>
                  </div>
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
        isCollapsed ? 'w-[60px]' : 'w-64'
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
        'fixed top-0 left-0 z-50 h-[100dvh] w-60 border-r flex flex-col lg:hidden transition-transform duration-300 ease-in-out shadow-2xl',
        theme.sidebarBg, theme.sidebarDarkBg, theme.border,
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {renderNavContent(true)}
      </aside>

      <button id="mobile-sidebar-trigger" onClick={() => setIsOpen(true)} className="hidden" aria-label="Buka menu" />
    </>
  )
}
