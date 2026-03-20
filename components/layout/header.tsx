// Lokasi: components/layout/header.tsx
'use client'

import { Menu, LogOut, User, Settings } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MENU_ITEMS } from '@/config/menu'

interface HeaderProps {
  userRole: string
  userName: string
  userEmail: string
  avatarUrl: string | null
}

function getPageTitle(pathname: string) {
  if (pathname === '/dashboard') return 'Dashboard'
  
  // Cek di menu items
  const found = MENU_ITEMS.find(item => {
    if (item.href === '/dashboard') return false
    return pathname === item.href || pathname.startsWith(item.href + '/')
  })
  if (found) {
    // Kalau ada sub-path setelah, tambahkan "Detail"
    if (pathname !== found.href && pathname.startsWith(found.href + '/')) {
      return `Detail · ${found.title}`
    }
    return found.title
  }
  
  // Fallback: ambil segment terakhir
  const segments = pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  const isUUID = /^[0-9a-f-]{36}$/i.test(last)
  if (isUUID) {
    const parent = segments[segments.length - 2]
    return `Detail ${parent.charAt(0).toUpperCase() + parent.slice(1)}`
  }
  return last.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export function Header({ userRole, userName, userEmail, avatarUrl }: HeaderProps) {
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)

  const handleLogout = async () => {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include',
    })
    window.location.href = '/login'
  }

  const triggerMobileSidebar = () => {
    document.getElementById('mobile-sidebar-trigger')?.click()
  }

  return (
    <header className="sticky top-0 z-30 flex h-12 w-full items-center gap-3 border-b border-slate-200 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 sm:px-4">
      {/* Mobile menu trigger */}
      <button
        onClick={triggerMobileSidebar}
        className="lg:hidden flex items-center justify-center h-8 w-8 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        aria-label="Menu"
      >
        <Menu className="h-4.5 w-4.5" style={{ width: '18px', height: '18px' }} />
      </button>

      {/* Page title */}
      <h1 className="text-[13px] sm:text-sm font-semibold text-slate-800 dark:text-slate-200 tracking-tight truncate flex-1 capitalize">
        {pageTitle}
      </h1>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none">
            <Avatar className="h-6 w-6">
              <AvatarImage src={avatarUrl || ''} alt={userName} />
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                {userName?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:block text-[12px] font-medium text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
              {userName}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 text-[13px]">
          <div className="px-3 py-2">
            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate text-[13px]">{userName}</p>
            <p className="text-slate-400 dark:text-slate-500 text-[11px] truncate">{userEmail}</p>
            <span className="mt-1.5 inline-block text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
              {userRole.replace(/_/g, ' ')}
            </span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="cursor-pointer text-[13px]">
            <Link href="/dashboard/settings/profile" className="flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Profil Saya
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer text-[13px]">
            <Link href="/dashboard/settings" className="flex items-center gap-2">
              <Settings className="h-3.5 w-3.5" /> Pengaturan
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 text-[13px]"
          >
            <LogOut className="h-3.5 w-3.5 mr-2" /> Keluar Sistem
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}