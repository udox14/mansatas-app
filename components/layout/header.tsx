// Lokasi: components/layout/header.tsx
'use client'

import { Menu, LogOut, User, Settings, RotateCw } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getRoleLabel } from '@/config/menu'

interface HeaderProps {
  userRoles: string[]
  primaryRole: string
  userName: string
  userEmail: string
  avatarUrl: string | null
}

function LiveDate() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  if (!now) return <span className="text-[13px] text-slate-400">—</span>

  const hari = now.toLocaleDateString('id-ID', { weekday: 'long' })
  const tanggal = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <span className="text-[13px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 tracking-tight">
      <span className="font-semibold text-slate-700 dark:text-slate-200">{hari}</span>
      <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
      <span>{tanggal}</span>
    </span>
  )
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-rose-100 text-rose-700 border-rose-200',
  admin_tu: 'bg-violet-100 text-violet-700 border-violet-200',
  kepsek: 'bg-amber-100 text-amber-700 border-amber-200',
  wakamad: 'bg-blue-100 text-blue-700 border-blue-200',
  guru: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  guru_bk: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  guru_piket: 'bg-teal-100 text-teal-700 border-teal-200',
  wali_kelas: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  resepsionis: 'bg-pink-100 text-pink-700 border-pink-200',
  guru_ppl: 'bg-lime-100 text-lime-700 border-lime-200',
}

export function Header({ userRoles, primaryRole, userName, userEmail, avatarUrl }: HeaderProps) {
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

      {/* Live date */}
      <div className="flex-1 min-w-0">
        <LiveDate />
      </div>

      {/* Refresh button */}
      <button
        onClick={() => window.location.reload()}
        className="flex items-center justify-center h-8 w-8 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        aria-label="Refresh halaman"
      >
        <RotateCw style={{ width: '16px', height: '16px' }} />
      </button>

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
        <DropdownMenuContent align="end" className="w-56 text-[13px]">
          <div className="px-3 py-2">
            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate text-[13px]">{userName}</p>
            <p className="text-slate-400 dark:text-slate-500 text-[11px] truncate">{userEmail}</p>
            {/* Multi-role badges */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {userRoles.map(role => (
                <span
                  key={role}
                  className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                    ROLE_COLORS[role] || 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200'
                  } ${role === primaryRole ? 'ring-1 ring-offset-1 ring-slate-400' : ''}`}
                >
                  {getRoleLabel(role)}
                </span>
              ))}
            </div>
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