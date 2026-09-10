'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, House, Search, Settings } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { MenuTile, menuTileClass } from '@/components/dashboard/shared/MenuTile'
import { ShortcutEditor } from '@/components/dashboard/shared/ShortcutEditor'
import { searchDashboardMenus, type DashboardMenuGroup, type DashboardMenuItem } from '@/lib/dashboard-menu'

type Overlay = 'menu' | 'shortcuts' | null
type Navigation = { menus: DashboardMenuItem[]; shortcutIds: string[]; openMenu: () => void; editShortcuts: () => void }
const NavigationContext = createContext<Navigation | null>(null)
const HISTORY_KEY = 'mansatasDashboardOverlay'
function locationOverlay(): Overlay {
  if (window.location.hash === '#shortcuts') return 'shortcuts'
  if (window.location.hash === '#menu' || window.location.hash.startsWith('#group-')) return 'menu'
  return null
}

export function useDashboardNavigation() {
  const value = useContext(NavigationContext)
  if (!value) throw new Error('Dashboard navigation provider missing')
  return value
}

export function DashboardNavigationProvider({ children, menus, groups, initialShortcutIds, readOnly = false }: {
  children: React.ReactNode; menus: DashboardMenuItem[]; groups: DashboardMenuGroup[]; initialShortcutIds: string[]; readOnly?: boolean
}) {
  const router = useRouter()
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [query, setQuery] = useState('')
  const [shortcutIds, setShortcutIds] = useState(initialShortcutIds)
  const [viewportHeight, setViewportHeight] = useState<number>()
  const [viewportBottom, setViewportBottom] = useState(0)
  const opener = useRef<HTMLElement | null>(null)
  const pendingHref = useRef<string | null>(null)
  const closing = useRef(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setShortcutIds(initialShortcutIds), 0)
    return () => window.clearTimeout(timer)
  }, [initialShortcutIds])

  useEffect(() => {
    function sync() {
      setOverlay(locationOverlay())
      closing.current = false
      if (pendingHref.current) {
        const href = pendingHref.current
        pendingHref.current = null
        router.push(href)
      }
    }
    const timer = window.setTimeout(sync, 0)
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.clearTimeout(timer); window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [router])

  useEffect(() => {
    const viewport = window.visualViewport
    const resize = () => {
      setViewportHeight(viewport?.height ?? window.innerHeight)
      setViewportBottom(viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0)
    }
    const timer = window.setTimeout(resize, 0)
    viewport?.addEventListener('resize', resize)
    viewport?.addEventListener('scroll', resize)
    return () => { window.clearTimeout(timer); viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize) }
  }, [])

  function open(next: Exclude<Overlay, null>) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setQuery('')
    if (!locationOverlay()) window.history.pushState({ ...window.history.state, [HISTORY_KEY]: true }, '', `#${next}`)
    else window.history.replaceState(window.history.state, '', `#${next}`)
    setOverlay(next)
  }

  function close(href?: string) {
    if (closing.current) return
    if (window.history.state?.[HISTORY_KEY]) {
      closing.current = true
      pendingHref.current = href ?? null
      window.history.back()
    } else {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
      setOverlay(null)
      if (href) router.push(href)
    }
  }

  useEffect(() => {
    function onNativeBack(event: Event) {
      if (!locationOverlay()) return
      event.preventDefault()
      if (window.history.state?.[HISTORY_KEY]) window.history.back()
      else {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
        setOverlay(null)
      }
    }
    window.addEventListener('mansatas:close-overlay', onNativeBack)
    return () => window.removeEventListener('mansatas:close-overlay', onNativeBack)
  }, [])

  const availableIds = new Set(menus.map(item => item.id))
  const visibleShortcuts = shortcutIds.filter(id => availableIds.has(id))
  const results = new Set(searchDashboardMenus(menus, query).map(item => item.id))
  return <NavigationContext.Provider value={{ menus, shortcutIds: visibleShortcuts, openMenu: () => open('menu'), editShortcuts: () => open('shortcuts') }}>
    {children}
    <Sheet open={overlay !== null} onOpenChange={value => { if (!value) close() }}>
      <SheetContent side="bottom" className="dashboard-menu-sheet inset-x-0 mx-auto flex max-w-2xl flex-col gap-0 overflow-hidden rounded-t-[28px] border-0 bg-white p-0 text-slate-900 data-[state=open]:duration-200 data-[state=closed]:duration-200 dark:bg-slate-950 dark:text-slate-100"
        data-compact={viewportHeight !== undefined && viewportHeight < 480}
        style={viewportHeight ? { maxHeight: Math.max(0, viewportHeight - 12), bottom: viewportBottom } : undefined}
        onOpenAutoFocus={event => { event.preventDefault(); document.getElementById('dashboard-menu-title')?.focus() }}
        onCloseAutoFocus={event => { event.preventDefault(); if (!pendingHref.current) opener.current?.focus() }}>
        <div className="dashboard-sheet-heading shrink-0 px-5 pb-4 pt-3 sm:px-6">
          <div aria-hidden="true" className="dashboard-sheet-handle mx-auto mb-5 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
          <SheetTitle id="dashboard-menu-title" tabIndex={-1} className="pr-10 text-2xl font-bold tracking-tight outline-none">{overlay === 'shortcuts' ? 'Atur menu favorit' : 'Semua menu'}</SheetTitle>
          <SheetDescription className="dashboard-sheet-description mt-1 text-xs">{overlay === 'shortcuts' ? 'Pilih hingga 8 menu. Tersimpan di akun Anda.' : 'Akses semua kebutuhan Anda dalam satu tempat.'}</SheetDescription>
        </div>
        {overlay === 'shortcuts' ? <ShortcutEditor menus={menus} initialIds={visibleShortcuts} readOnly={readOnly}
          onCancel={() => close()} onSaved={ids => { setShortcutIds(ids); close() }} /> : <>
          <div className="relative mx-5 mb-3 shrink-0 sm:mx-6">
            <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-slate-400" />
            <Input aria-label="Cari semua menu" placeholder="Cari menu..." value={query} onChange={event => setQuery(event.target.value)} className="h-12 rounded-2xl border-0 bg-slate-100 pl-11 dark:bg-slate-800" />
          </div>
          <div className="dashboard-sheet-footer min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6">
            {!query.trim() && <button onClick={() => close('/dashboard')} className="mb-5 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-slate-100 p-4 text-left text-sm font-semibold dark:border-slate-800"><House className="h-5 w-5 text-emerald-600" />Beranda<ChevronRight className="ml-auto h-4 w-4 text-slate-400" /></button>}
            {query.trim() && results.size === 0 && <p role="status" className="py-10 text-center text-sm text-slate-500">Menu tidak ditemukan. Coba kata lain.</p>}
            {groups.map(group => {
              const items = group.items.filter(item => results.has(item.id))
              if (!items.length) return null
              return <section key={group.id} className="mb-6"><h3 className="mb-2 text-sm font-semibold">{group.label}</h3><div className="grid grid-cols-4 gap-x-2 gap-y-1">
                {items.map(item => <Link key={item.id} href={item.href} className={menuTileClass} onClick={event => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault(); close(item.href)
                }}><MenuTile item={item} /></Link>)}
              </div></section>
            })}
            <button onClick={() => close('/dashboard/settings/profile')} className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold dark:bg-slate-900"><Settings className="h-5 w-5 text-slate-500" />Profil & pengaturan<ChevronRight className="ml-auto h-4 w-4 text-slate-400" /></button>
          </div>
        </>}
      </SheetContent>
    </Sheet>
  </NavigationContext.Provider>
}
