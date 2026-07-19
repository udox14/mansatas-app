// Lokasi: components/layout/sidebar.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { DEFAULT_SIDEBAR_GROUPS, MENU_ITEMS, SIDEBAR_ROOT_ITEM_IDS, getSidebarFeatureIds, type SidebarGroupConfig } from '@/config/menu'
import { X, CaretLeft as ChevronLeft, CaretRight as ChevronRight, CaretDown as ChevronDown, Moon, Sun, MagnifyingGlass as Search } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { getIconComponent } from '@/lib/icons'

const SIDEBAR_THEMES = [
  { id: 'emerald', label: 'Hijau', sidebarBg: 'bg-emerald-950', sidebarDarkBg: 'dark:bg-[#02241b]', text: 'text-emerald-100', textMuted: 'text-emerald-400/80', activeBg: 'bg-emerald-500/30', activeText: 'text-white', hoverBg: 'hover:bg-emerald-500/15', hoverText: 'hover:text-white', border: 'border-emerald-800/50', swatch: 'bg-emerald-500', ring: 'ring-emerald-400', scrollbarThumb: '#34d399' },
  { id: 'blue', label: 'Biru', sidebarBg: 'bg-blue-950', sidebarDarkBg: 'dark:bg-[#0b1433]', text: 'text-blue-100', textMuted: 'text-blue-400/80', activeBg: 'bg-blue-500/30', activeText: 'text-white', hoverBg: 'hover:bg-blue-500/15', hoverText: 'hover:text-white', border: 'border-blue-800/50', swatch: 'bg-blue-500', ring: 'ring-blue-400', scrollbarThumb: '#60a5fa' },
  { id: 'slate', label: 'Hitam', sidebarBg: 'bg-slate-900', sidebarDarkBg: 'dark:bg-slate-950', text: 'text-slate-300', textMuted: 'text-slate-500', activeBg: 'bg-white/10', activeText: 'text-white', hoverBg: 'hover:bg-white/5', hoverText: 'hover:text-white', border: 'border-slate-800', swatch: 'bg-slate-500', ring: 'ring-slate-400', scrollbarThumb: '#94a3b8' },
  { id: 'purple', label: 'Ungu', sidebarBg: 'bg-purple-950', sidebarDarkBg: 'dark:bg-[#200b4a]', text: 'text-purple-100', textMuted: 'text-purple-400/80', activeBg: 'bg-purple-500/30', activeText: 'text-white', hoverBg: 'hover:bg-purple-500/15', hoverText: 'hover:text-white', border: 'border-purple-800/50', swatch: 'bg-purple-500', ring: 'ring-purple-400', scrollbarThumb: '#a78bfa' },
  { id: 'rose', label: 'Merah', sidebarBg: 'bg-rose-950', sidebarDarkBg: 'dark:bg-[#330311]', text: 'text-rose-100', textMuted: 'text-rose-400/80', activeBg: 'bg-rose-500/30', activeText: 'text-white', hoverBg: 'hover:bg-rose-500/15', hoverText: 'hover:text-white', border: 'border-rose-800/50', swatch: 'bg-rose-500', ring: 'ring-rose-400', scrollbarThumb: '#fb7185' },
  { id: 'white', label: 'Putih', sidebarBg: 'bg-white', sidebarDarkBg: 'dark:bg-slate-950', text: 'text-slate-700 dark:text-slate-300', textMuted: 'text-slate-500 dark:text-slate-400', activeBg: 'bg-slate-100 dark:bg-white/10', activeText: 'text-slate-900 dark:text-white', hoverBg: 'hover:bg-slate-50 dark:hover:bg-white/5', hoverText: 'hover:text-slate-900 dark:hover:text-white', border: 'border-slate-200 dark:border-slate-800', swatch: 'bg-slate-100 border border-slate-300', ring: 'ring-slate-400', scrollbarThumb: '#cbd5e1' },
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
  featureBadges?: Record<string, number>
  navEnabled?: boolean
}

export function Sidebar({
  userRoles = ['guru'],
  primaryRole = 'guru',
  userName = 'Pengguna',
  allowedFeatures = [],
  sidebarGroups = DEFAULT_SIDEBAR_GROUPS,
  featureLabels = {},
  featureBadges = {},
  navEnabled = false,
}: SidebarProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [themeId, setThemeId] = useState<ThemeKey>('slate')
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [openGroupIds, setOpenGroupIds] = useState<string[]>([])
  const [menuSearch, setMenuSearch] = useState('')
  const userCollapsedRef = useRef(false)
  const initializedAccordionRef = useRef(false)
  const prevActiveGroupIdRef = useRef<string | undefined>(undefined)

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
  const allowedSet = new Set(getSidebarFeatureIds(allowedFeatures))
  const allowedMenus = MENU_ITEMS.filter(item => allowedSet.has(item.id))
  const rootMenus = SIDEBAR_ROOT_ITEM_IDS
    .map(id => MENU_ITEMS.find(item => item.id === id))
    .filter((item): item is typeof MENU_ITEMS[number] => item !== undefined)
    .filter(item => allowedFeatures.includes(item.id))
  const rootIds = new Set<string>(SIDEBAR_ROOT_ITEM_IDS)
  const effectiveSidebarGroups = sidebarGroups
    .map(group => ({ ...group, items: group.items.filter(id => !rootIds.has(id)) }))
    .filter(group => group.items.length > 0)
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
    if (!mounted) return
    if (activeGroupId && activeGroupId !== prevActiveGroupIdRef.current) {
      setOpenGroupIds(prev => {
        if (prev.includes(activeGroupId)) return prev
        const next = [...prev, activeGroupId]
        localStorage.setItem('mansatas_sidebar_open_groups', JSON.stringify(next))
        return next
      })
    }
    prevActiveGroupIdRef.current = activeGroupId
  }, [mounted, activeGroupId])

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
          'h-12 flex items-center border-b shrink-0',
          theme.id === 'white' ? 'bg-slate-50 dark:bg-black/10' : 'bg-black/10',
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
                <p className={cn("text-[10px] leading-tight", theme.id === 'white' ? 'text-slate-500 dark:text-white/90' : 'text-white/90')}>MAN 1 Tasikmalaya</p>
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
        <nav className={cn('flex-1 overflow-y-auto py-3 sm:py-4 sidebar-scrollbar', collapsed ? 'px-2.5' : 'px-3')}>
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
                'flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors',
                theme.id === 'white' ? 'bg-slate-50 focus-within:bg-slate-100 dark:bg-black/15 dark:focus-within:bg-black/25' : 'bg-black/15 focus-within:bg-black/25',
                theme.border
              )}>
                <Search className={cn('h-4 w-4 shrink-0', theme.textMuted)} />
                <input
                  value={menuSearch}
                  onChange={(event) => setMenuSearch(event.target.value)}
                  placeholder="Cari menu..."
                  className={cn("min-w-0 flex-1 bg-transparent outline-none", mobile ? "text-[12px]" : "text-[13px]", theme.id === 'white' ? 'text-slate-900 placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/35' : 'text-white placeholder:text-white/35')}
                  aria-label="Cari menu sidebar"
                />
                {menuSearch && (
                  <button
                    type="button"
                    onClick={() => setMenuSearch('')}
                    className={cn('rounded-md p-1 transition-colors', theme.textMuted, theme.id === 'white' ? 'hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white' : 'hover:bg-white/10 hover:text-white')}
                    aria-label="Hapus pencarian menu"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {rootMenus.length > 0 && (
            <div className={cn(!collapsed && 'mb-3')}>
              {rootMenus.map(item => {
                const isActive = activeHref === item.href
                const Icon = getIconComponent(item.icon)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? (featureLabels[item.id] || item.title) : undefined}
                    className={cn(
                      'group flex items-center rounded-xl transition-all duration-300',
                      mobile ? 'text-[11.5px]' : 'text-[13px]',
                      collapsed ? 'mx-auto h-11 w-11 justify-center p-2.5' : (mobile ? 'gap-2 px-2.5 py-1.5' : 'gap-2.5 px-3 py-2.5'),
                      isActive
                        ? cn(theme.activeBg, theme.activeText, 'font-semibold shadow-sm ring-1', theme.id === 'white' ? 'ring-slate-200 dark:ring-white/5' : 'ring-white/5')
                        : cn(theme.text, theme.hoverBg, theme.hoverText, !collapsed && 'hover:translate-x-0.5')
                    )}
                  >
                    <Icon className={cn('shrink-0 transition-all duration-300', mobile ? 'h-3.5 w-3.5' : 'h-4 w-4', isActive ? 'opacity-100 scale-105 drop-shadow-sm' : 'opacity-70 group-hover:opacity-100')} />
                    {!collapsed && <><span className="min-w-0 flex-1 truncate leading-snug">{featureLabels[item.id] || item.title}</span>{featureBadges[item.id] > 0 && <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{featureBadges[item.id]}</span>}</>}
                  </Link>
                )
              })}
              {!collapsed && visibleGroups.length > 0 && <div className={cn('mt-3 border-t', theme.border)} />}
              {collapsed && visibleGroups.length > 0 && <div className={cn('mx-2 my-3 h-px border-t', theme.border)} />}
            </div>
          )}

          {visibleGroups.length === 0 && rootMenus.length === 0 && !collapsed && (
            <div className={cn('rounded-xl border border-dashed px-3 py-4 text-center text-[12px]', theme.border, theme.textMuted)}>
              Menu tidak ditemukan
            </div>
          )}

          {visibleGroups.map(({ group, groupItems }, gi) => {
            const GroupIcon = groupItems[0] ? getIconComponent(groupItems[0].icon) : null
            const isGroupOpen = collapsed || normalizedMenuSearch.length > 0 || openGroupIds.includes(group.id)
            const hasActiveItem = group.id === activeGroupId

            return (
              <div key={group.id || group.label} className={cn(gi > 0 && (mobile ? 'mt-0.5' : (collapsed ? 'mt-2' : 'mt-3')))}>
                {/* Section label */}
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={cn(
                      'group/header flex w-full items-center text-left transition-all duration-200 rounded-xl',
                      mobile ? 'gap-2 px-2.5 py-1' : 'gap-2.5 px-3 py-2',
                      hasActiveItem ? cn(theme.activeText, theme.id === 'white' ? 'hover:bg-slate-50 dark:hover:bg-white/5' : 'hover:bg-white/5') : cn(theme.text, theme.id === 'white' ? 'hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white' : 'hover:bg-white/5 hover:text-white')
                    )}
                    aria-expanded={isGroupOpen}
                    aria-controls={`sidebar-group-${group.id}`}
                  >
                    {GroupIcon && (
                      <GroupIcon className={cn(
                        'shrink-0 transition-all duration-300',
                        mobile ? 'h-3.5 w-3.5' : 'h-4 w-4',
                        hasActiveItem ? cn(theme.id === 'white' ? 'opacity-100 scale-105 text-slate-900 dark:text-white' : 'opacity-100 scale-105 text-white') : 'opacity-70 group-hover/header:opacity-100'
                      )} />
                    )}
                    <span className={cn("min-w-0 flex-1 font-semibold truncate leading-snug", mobile ? "text-[11.5px]" : "text-[13px]")}>
                      {group.label}
                    </span>
                    <ChevronDown className={cn(
                      'shrink-0 transition-transform duration-300',
                      theme.id === 'white' ? 'text-slate-400 group-hover/header:text-slate-600 dark:text-white/50 dark:group-hover/header:text-white/80' : 'text-white/50 group-hover/header:text-white/80',
                      isGroupOpen ? 'rotate-0' : '-rotate-90',
                      mobile ? 'h-3.5 w-3.5' : 'h-4 w-4'
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
                  <div className={cn('min-w-0 overflow-hidden', !collapsed && (mobile ? 'pt-1' : 'pt-2'))}>
                <div className={cn("space-y-0.5", !collapsed && "relative ml-5 mr-4 border-l border-white/10 pl-3")}>
                  {groupItems.map(item => {
                    const isActive = activeHref === item.href
                    const Icon = getIconComponent(item.icon)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? (featureLabels[item.id] || item.title) : undefined}
                        className={cn(
                          'group flex items-center rounded-lg transition-all duration-300',
                          mobile ? 'text-[11px]' : 'text-[13px]',
                          collapsed ? 'mx-auto h-11 w-11 justify-center p-2.5' : (mobile ? 'gap-2 px-2 py-1' : 'gap-2.5 px-2.5 py-2'),
                          isActive
                            ? cn(theme.activeBg, theme.activeText, 'font-semibold shadow-sm ring-1', theme.id === 'white' ? 'ring-slate-200 dark:ring-white/5' : 'ring-white/5')
                            : cn(theme.text, theme.hoverBg, theme.hoverText, !collapsed && 'hover:translate-x-0.5')
                        )}
                      >
                        <Icon className={cn('shrink-0 transition-all duration-300', mobile ? 'h-3.5 w-3.5' : 'h-4 w-4', isActive ? 'opacity-100 scale-105 drop-shadow-sm' : 'opacity-60 group-hover:opacity-100')} />
                        {!collapsed && <><span className="min-w-0 flex-1 truncate leading-snug">{featureLabels[item.id] || item.title}</span>{featureBadges[item.id] > 0 && <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{featureBadges[item.id]}</span>}</>}
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
        <div className={cn('border-t shrink-0 p-3 space-y-1', theme.border, (mobile && navEnabled) ? 'pb-20' : 'pb-3')}>

          {/* Tema + dark toggle */}
          {!collapsed && (
            <div className={cn("flex items-center gap-2 px-3 py-2 mb-2 rounded-xl", theme.id === 'white' ? 'bg-slate-50 dark:bg-black/20' : 'bg-black/10 dark:bg-black/20')}>
              <span className={cn("text-[10px] font-semibold uppercase tracking-widest mr-auto", theme.textMuted)}>Tema</span>
              {SIDEBAR_THEMES.map(c => (
                <button key={c.id} onClick={() => changeTheme(c.id as ThemeKey)} title={c.label}
                  className={cn(
                    'w-3.5 h-3.5 rounded-full transition-all duration-200 shadow-sm border', 
                    theme.id === 'white' ? 'border-slate-300 dark:border-white/20' : 'border-white/20', c.swatch,
                    themeId === c.id ? cn('ring-2 ring-offset-2 ring-offset-transparent', c.ring, 'scale-110') : 'opacity-60 hover:opacity-100 hover:scale-110'
                  )}
                />
              ))}
              <div className={cn("w-px h-4 mx-1.5", theme.border, "border-l")} />
              <button onClick={toggleDark} title={isDark ? 'Mode Terang' : 'Mode Gelap'}
                className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200',
                  isDark ? 'text-amber-300 hover:bg-black/20' : cn(theme.text, theme.id === 'white' ? 'hover:bg-slate-200 dark:hover:bg-black/10' : 'hover:bg-black/10')
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
                    <span className={cn("text-[9px] font-semibold px-1 py-px rounded leading-tight", theme.id === 'white' ? 'bg-slate-200 dark:bg-black/20' : 'bg-black/20', theme.text)}>
                      +{extraRoleCount}
                    </span>
                  )}
                </div>
              </div>
            )}
          </Link>
        </div>

      </div>
    )
  }

  return (
    <>
      {isOpen && <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[45] lg:hidden transition-opacity" />}

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
        'fixed top-0 left-0 z-50 h-[100dvh] w-56 border-r flex flex-col lg:hidden transition-transform duration-300 ease-in-out shadow-2xl',
        theme.sidebarBg, theme.sidebarDarkBg, theme.border,
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {renderNavContent(true)}
      </aside>

      <button id="mobile-sidebar-trigger" onClick={() => setIsOpen(true)} className="hidden" aria-label="Buka menu" />
    </>
  )
}
