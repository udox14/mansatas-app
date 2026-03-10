// TIMPA SELURUH ISI FILE INI
// Lokasi: components/layout/sidebar.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { MENU_ITEMS } from '@/config/menu'
import { 
  LogOut, Menu, X, 
  ChevronLeft, ChevronRight, ChevronDown, Palette
} from 'lucide-react'

// --- KONFIGURASI TEMA WARNA (THEMED DARK GLOW) ---
const THEMES = {
  emerald: {
    id: 'emerald', dot: 'bg-emerald-400',
    sidebarBg: 'bg-gradient-to-b from-emerald-950 via-emerald-900 to-teal-950',
    activeBg: 'bg-emerald-600/50 border border-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]',
    inactiveText: 'text-emerald-100/60 hover:bg-emerald-800/40 hover:text-white',
    activeBar: 'bg-emerald-400',
    glow: 'shadow-[0_0_15px_rgba(52,211,153,0.8)]',
    logoIconBg: 'bg-gradient-to-br from-emerald-400 to-teal-400',
    scrollbarThumb: '[&::-webkit-scrollbar-thumb]:bg-emerald-500/40 hover:[&::-webkit-scrollbar-thumb]:bg-emerald-400/70',
    footerBg: 'bg-emerald-950/40 border-t border-white/5',
    footerCard: 'bg-emerald-900/40 border border-emerald-700/50',
    logoutBg: 'bg-emerald-900/40 border border-emerald-800/50 text-emerald-200 hover:bg-rose-600 hover:text-white hover:border-rose-500',
    collapseBtn: 'bg-emerald-900 border-emerald-700 text-emerald-300 hover:text-white hover:bg-emerald-800 hover:border-emerald-500'
  },
  indigo: {
    id: 'indigo', dot: 'bg-indigo-400',
    sidebarBg: 'bg-gradient-to-b from-indigo-950 via-indigo-900 to-purple-950',
    activeBg: 'bg-indigo-600/50 border border-indigo-400/30 shadow-[0_0_20px_rgba(99,102,241,0.25)]',
    inactiveText: 'text-indigo-100/60 hover:bg-indigo-800/40 hover:text-white',
    activeBar: 'bg-indigo-400',
    glow: 'shadow-[0_0_15px_rgba(129,140,248,0.8)]',
    logoIconBg: 'bg-gradient-to-br from-indigo-400 to-purple-400',
    scrollbarThumb: '[&::-webkit-scrollbar-thumb]:bg-indigo-500/40 hover:[&::-webkit-scrollbar-thumb]:bg-indigo-400/70',
    footerBg: 'bg-indigo-950/40 border-t border-white/5',
    footerCard: 'bg-indigo-900/40 border border-indigo-700/50',
    logoutBg: 'bg-indigo-900/40 border border-indigo-800/50 text-indigo-200 hover:bg-rose-600 hover:text-white hover:border-rose-500',
    collapseBtn: 'bg-indigo-900 border-indigo-700 text-indigo-300 hover:text-white hover:bg-indigo-800 hover:border-indigo-500'
  },
  blue: {
    id: 'blue', dot: 'bg-blue-400',
    sidebarBg: 'bg-gradient-to-b from-slate-950 via-blue-950 to-cyan-950',
    activeBg: 'bg-blue-600/50 border border-blue-400/30 shadow-[0_0_20px_rgba(59,130,246,0.25)]',
    inactiveText: 'text-blue-100/60 hover:bg-blue-800/40 hover:text-white',
    activeBar: 'bg-blue-400',
    glow: 'shadow-[0_0_15px_rgba(96,165,250,0.8)]',
    logoIconBg: 'bg-gradient-to-br from-blue-400 to-cyan-400',
    scrollbarThumb: '[&::-webkit-scrollbar-thumb]:bg-blue-500/40 hover:[&::-webkit-scrollbar-thumb]:bg-blue-400/70',
    footerBg: 'bg-blue-950/40 border-t border-white/5',
    footerCard: 'bg-blue-900/40 border border-blue-700/50',
    logoutBg: 'bg-blue-900/40 border border-blue-800/50 text-blue-200 hover:bg-rose-600 hover:text-white hover:border-rose-500',
    collapseBtn: 'bg-blue-900 border-blue-700 text-blue-300 hover:text-white hover:bg-blue-800 hover:border-blue-500'
  },
  rose: {
    id: 'rose', dot: 'bg-rose-400',
    sidebarBg: 'bg-gradient-to-b from-rose-950 via-rose-900 to-pink-950',
    activeBg: 'bg-rose-600/50 border border-rose-400/30 shadow-[0_0_20px_rgba(244,63,94,0.25)]',
    inactiveText: 'text-rose-100/60 hover:bg-rose-800/40 hover:text-white',
    activeBar: 'bg-rose-400',
    glow: 'shadow-[0_0_15px_rgba(251,113,133,0.8)]',
    logoIconBg: 'bg-gradient-to-br from-rose-400 to-pink-400',
    scrollbarThumb: '[&::-webkit-scrollbar-thumb]:bg-rose-500/40 hover:[&::-webkit-scrollbar-thumb]:bg-rose-400/70',
    footerBg: 'bg-rose-950/40 border-t border-white/5',
    footerCard: 'bg-rose-900/40 border border-rose-700/50',
    logoutBg: 'bg-rose-900/40 border border-rose-800/50 text-rose-200 hover:bg-rose-600 hover:text-white hover:border-rose-500',
    collapseBtn: 'bg-rose-900 border-rose-700 text-rose-300 hover:text-white hover:bg-rose-800 hover:border-rose-500'
  },
  violet: {
    id: 'violet', dot: 'bg-violet-400',
    sidebarBg: 'bg-gradient-to-b from-violet-950 via-violet-900 to-fuchsia-950',
    activeBg: 'bg-violet-600/50 border border-violet-400/30 shadow-[0_0_20px_rgba(139,92,246,0.25)]',
    inactiveText: 'text-violet-100/60 hover:bg-violet-800/40 hover:text-white',
    activeBar: 'bg-violet-400',
    glow: 'shadow-[0_0_15px_rgba(167,139,250,0.8)]',
    logoIconBg: 'bg-gradient-to-br from-violet-400 to-fuchsia-400',
    scrollbarThumb: '[&::-webkit-scrollbar-thumb]:bg-violet-500/40 hover:[&::-webkit-scrollbar-thumb]:bg-violet-400/70',
    footerBg: 'bg-violet-950/40 border-t border-white/5',
    footerCard: 'bg-violet-900/40 border border-violet-700/50',
    logoutBg: 'bg-violet-900/40 border border-violet-800/50 text-violet-200 hover:bg-rose-600 hover:text-white hover:border-rose-500',
    collapseBtn: 'bg-violet-900 border-violet-700 text-violet-300 hover:text-white hover:bg-violet-800 hover:border-violet-500'
  },
  cyan: {
    id: 'cyan', dot: 'bg-cyan-400',
    sidebarBg: 'bg-gradient-to-b from-cyan-950 via-cyan-900 to-sky-950',
    activeBg: 'bg-cyan-600/50 border border-cyan-400/30 shadow-[0_0_20px_rgba(6,182,212,0.25)]',
    inactiveText: 'text-cyan-100/60 hover:bg-cyan-800/40 hover:text-white',
    activeBar: 'bg-cyan-400',
    glow: 'shadow-[0_0_15px_rgba(34,211,238,0.8)]',
    logoIconBg: 'bg-gradient-to-br from-cyan-400 to-sky-400',
    scrollbarThumb: '[&::-webkit-scrollbar-thumb]:bg-cyan-500/40 hover:[&::-webkit-scrollbar-thumb]:bg-cyan-400/70',
    footerBg: 'bg-cyan-950/40 border-t border-white/5',
    footerCard: 'bg-cyan-900/40 border border-cyan-700/50',
    logoutBg: 'bg-cyan-900/40 border border-cyan-800/50 text-cyan-200 hover:bg-rose-600 hover:text-white hover:border-rose-500',
    collapseBtn: 'bg-cyan-900 border-cyan-700 text-cyan-300 hover:text-white hover:bg-cyan-800 hover:border-cyan-500'
  },
  amber: {
    id: 'amber', dot: 'bg-amber-400',
    sidebarBg: 'bg-gradient-to-b from-amber-950 via-amber-900 to-orange-950',
    activeBg: 'bg-amber-600/50 border border-amber-400/30 shadow-[0_0_20px_rgba(245,158,11,0.25)]',
    inactiveText: 'text-amber-100/60 hover:bg-amber-800/40 hover:text-white',
    activeBar: 'bg-amber-400',
    glow: 'shadow-[0_0_15px_rgba(251,191,36,0.8)]',
    logoIconBg: 'bg-gradient-to-br from-amber-400 to-orange-400',
    scrollbarThumb: '[&::-webkit-scrollbar-thumb]:bg-amber-500/40 hover:[&::-webkit-scrollbar-thumb]:bg-amber-400/70',
    footerBg: 'bg-amber-950/40 border-t border-white/5',
    footerCard: 'bg-amber-900/40 border border-amber-700/50',
    logoutBg: 'bg-amber-900/40 border border-amber-800/50 text-amber-200 hover:bg-rose-600 hover:text-white hover:border-rose-500',
    collapseBtn: 'bg-amber-900 border-amber-700 text-amber-300 hover:text-white hover:bg-amber-800 hover:border-amber-500'
  },
  slate: {
    id: 'slate', dot: 'bg-slate-400',
    sidebarBg: 'bg-gradient-to-b from-slate-950 via-slate-900 to-zinc-950',
    activeBg: 'bg-slate-700/50 border border-slate-500/30 shadow-[0_0_20px_rgba(100,116,139,0.25)]',
    inactiveText: 'text-slate-300/60 hover:bg-slate-800/40 hover:text-white',
    activeBar: 'bg-slate-400',
    glow: 'shadow-[0_0_15px_rgba(148,163,184,0.8)]',
    logoIconBg: 'bg-gradient-to-br from-slate-300 to-slate-500',
    scrollbarThumb: '[&::-webkit-scrollbar-thumb]:bg-slate-600/40 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500/70',
    footerBg: 'bg-slate-950/40 border-t border-white/5',
    footerCard: 'bg-slate-900/40 border border-slate-700/50',
    logoutBg: 'bg-slate-900/40 border border-slate-800/50 text-slate-300 hover:bg-rose-600 hover:text-white hover:border-rose-500',
    collapseBtn: 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-500'
  }
}

type ThemeKey = keyof typeof THEMES

export function Sidebar({ userRole = 'guru', userName = 'Pengguna' }: { userRole?: string, userName?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>('emerald')
  const [mounted, setMounted] = useState(false)
  const [isThemeOpen, setIsThemeOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('mansatas_theme') as ThemeKey
    if (savedTheme && THEMES[savedTheme]) setCurrentTheme(savedTheme)
  }, [])

  const changeTheme = (theme: ThemeKey) => {
    setCurrentTheme(theme)
    localStorage.setItem('mansatas_theme', theme)
  }

  useEffect(() => setIsOpen(false), [pathname])

  const allowedMenus = MENU_ITEMS.filter(item => item.roles.includes(userRole))
  const t = THEMES[currentTheme]

  // PERBAIKAN: Logout sekarang via API route Better Auth, bukan Supabase client
  const handleLogout = async () => {
    if (!confirm('Yakin ingin keluar dari aplikasi?')) return
    setIsLoggingOut(true)
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' })
    } catch (_) {
      // ignore
    }
    router.push('/login')
    router.refresh()
  }

  if (!mounted) return null

  return (
    <>
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="lg:hidden fixed top-3 left-4 z-40 h-10 w-10 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur-md border border-slate-200/60 shadow-sm text-slate-800 hover:bg-slate-100 transition-all"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)} 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity animate-in fade-in"
        />
      )}

      <aside className={`
        fixed lg:relative top-0 left-0 z-50 h-[100dvh] 
        ${t.sidebarBg} border-r border-white/5 
        flex flex-col transition-all duration-300 ease-in-out shrink-0 text-white
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isCollapsed ? 'lg:w-20 w-72' : 'w-72'}
      `}>
        
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`hidden lg:flex absolute -right-3.5 top-20 z-50 h-7 w-7 rounded-full items-center justify-center shadow-lg transition-all border ${t.collapseBtn}`}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4 ml-0.5" /> : <ChevronLeft className="h-4 w-4 mr-0.5" />}
        </button>

        <div className={`h-20 flex items-center border-b border-white/10 px-4 ${isCollapsed ? 'justify-center py-2' : 'justify-between py-3'}`}>
          <Link href="/dashboard" className="flex items-center gap-3 group h-full">
            <div className={`relative flex items-center justify-center transition-transform duration-500 group-hover:scale-105 ${isCollapsed ? 'w-10 h-10' : 'w-12 h-12'}`}>
              <Image 
                src="/logokemenag.png" 
                alt="Logo Kemenag" 
                fill
                className="object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
              />
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in slide-in-from-left-2 flex flex-col justify-center">
                <h1 className="text-[17px] font-black tracking-tight text-white drop-shadow-md leading-tight">
                  MANSATAS App
                </h1>
                <p className="text-[11px] font-medium text-white/70 uppercase tracking-wide leading-tight mt-0.5">MAN 1 Tasikmalaya</p>
              </div>
            )}
          </Link>
          <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto py-6 px-3 space-y-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full ${t.scrollbarThumb}`}>
          {!isCollapsed && <p className="px-3 text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3 animate-in fade-in">Menu Utama</p>}
          
          {allowedMenus.map((item) => {
            const isActive = item.href === '/dashboard' 
              ? pathname === '/dashboard' 
              : pathname === item.href || pathname.startsWith(item.href + '/')
              
            const Icon = item.icon

            return (
              <Link 
                key={item.title} 
                href={item.href}
                title={isCollapsed ? item.title : undefined}
                className={`
                  flex items-center rounded-xl transition-all duration-300 relative overflow-hidden group
                  ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-3.5 py-3'}
                  ${isActive ? t.activeBg : t.inactiveText}
                `}
              >
                {isActive && !isCollapsed && (
                  <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 rounded-r-full ${t.activeBar} ${t.glow} animate-in slide-in-from-left-2`} />
                )}
                
                <Icon className={`h-5 w-5 shrink-0 transition-all duration-300 
                  ${isActive ? `text-white drop-shadow-[0_0_8px_currentColor] scale-110` : 'group-hover:scale-110'}`} 
                />
                
                {!isCollapsed && (
                  <span className={`truncate text-sm ${isActive ? 'text-white font-bold' : 'font-medium'}`}>{item.title}</span>
                )}
              </Link>
            )
          })}
        </div>

        <div className={`p-4 ${t.footerBg}`}>
          
          {!isCollapsed && (
            <div className={`flex flex-col rounded-xl mb-4 transition-colors ${t.footerCard}`}>
              <button 
                onClick={() => setIsThemeOpen(!isThemeOpen)}
                className="flex items-center justify-between w-full px-3 py-2.5 text-xs font-semibold text-white/60 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5" /> Pilih Tema
                </div>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isThemeOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <div className={`grid grid-cols-4 gap-2 px-3 overflow-hidden transition-all duration-300 ease-in-out ${isThemeOpen ? 'max-h-20 pb-3 opacity-100' : 'max-h-0 opacity-0'}`}>
                {Object.values(THEMES).map(theme => (
                  <button 
                    key={theme.id} 
                    onClick={() => {
                      changeTheme(theme.id as ThemeKey)
                      setIsThemeOpen(false)
                    }}
                    className={`h-5 w-5 rounded-full ${theme.dot} transition-all duration-300 hover:scale-125 mx-auto
                      ${currentTheme === theme.id ? `ring-2 ring-offset-2 ring-offset-slate-900 ring-white scale-110 ${theme.glow}` : 'opacity-40 hover:opacity-100'}`}
                    title={`Tema ${theme.id}`}
                  />
                ))}
              </div>
            </div>
          )}

          <div className={`flex items-center ${isCollapsed ? 'justify-center' : `gap-3 p-3 rounded-xl ${t.footerCard}`} mb-3 transition-colors`}>
            <div className={`h-10 w-10 shrink-0 rounded-full ${t.logoIconBg} text-slate-900 flex items-center justify-center font-black text-sm ring-2 ring-white/20 shadow-md`}>
              {userName.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{userName}</p>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider truncate">{userRole.replace('_', ' ')}</p>
              </div>
            )}
          </div>

          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            title={isCollapsed ? "Keluar Aplikasi" : undefined}
            className={`flex items-center justify-center transition-all duration-300
              ${isCollapsed 
                ? 'w-full py-3 rounded-xl text-white/50 hover:text-white hover:bg-rose-600' 
                : `w-full py-2.5 gap-2 rounded-xl text-sm font-bold ${t.logoutBg}`}
            `}
          >
            {isLoggingOut ? (
              <span className="animate-pulse">{isCollapsed ? <LogOut className="h-5 w-5" /> : 'Keluar...'}</span>
            ) : (
              <>
                <LogOut className={isCollapsed ? "h-5 w-5" : "h-4 w-4"} /> 
                {!isCollapsed && 'Keluar Aplikasi'}
              </>
            )}
          </button>

        </div>

      </aside>
    </>
  )
}
