'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CalendarCheck, LogOut, Megaphone, Menu, MoreHorizontal, RotateCw, Settings, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { unregisterNativePushToken } from '@/components/native/mobile-runtime'
import { DashboardGuideButton } from '@/components/layout/dashboard-guide'
import { FittedUserName } from './FittedUserName'
import { RunningText } from './RunningText'

type Props = {
  nama: string; namaDepan: string; avatarUrl: string | null; roleLabel: string; roleColor?: string
  taAktif?: { nama: string; semester: number } | null; sapaan: string; bgImageUrl?: string
  runningText?: string; textColor?: string; runningTextBg?: string; runningTextColor?: string
  primaryRole?: string
}

export function WelcomeStrip({ nama, namaDepan, avatarUrl, roleLabel, taAktif, sapaan, bgImageUrl, runningText,
  textColor = 'white', runningTextBg = '#1e1e1e', runningTextColor = '#ffffff', primaryRole,
}: Props) {
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  async function logout() {
    setLoggingOut(true)
    setLogoutError('')
    try {
      await unregisterNativePushToken()
      const response = await fetch('/api/auth/sign-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}), credentials: 'include' })
      if (!response.ok) throw new Error('sign-out failed')
      // A full navigation clears account-scoped client state after sign-out.
      window.location.assign(new URL('/', window.location.origin).href)
    } catch { setLogoutError('Belum berhasil keluar. Silakan coba lagi.'); setLoggingOut(false) }
  }
  const lightText = textColor === 'white'
  return <section aria-label="Selamat datang" data-dashboard-guide-target="page-title" data-dashboard-guide-title="Dashboard" className="overflow-hidden">
    <div className={`dashboard-hero relative flex flex-col justify-between ${lightText ? 'bg-emerald-900 text-white' : 'bg-emerald-50 text-slate-900'}`}
      style={bgImageUrl ? { backgroundImage: `url(${JSON.stringify(bgImageUrl)})`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined}>
      <div aria-hidden="true" className={`absolute inset-0 ${lightText ? 'bg-gradient-to-t from-emerald-950/85 via-emerald-950/25 to-transparent' : 'bg-gradient-to-t from-white/90 via-white/35 to-transparent'}`} />
      {!bgImageUrl && <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-28 h-96 w-96 rounded-full border-[48px] border-emerald-400/10" />}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-3 py-2 text-white">
        <button type="button" aria-label="Buka sidebar" onClick={() => document.getElementById('mobile-sidebar-trigger')?.click()} className="dashboard-icon-button drop-shadow-md"><Menu className="h-6 w-6" /></button>
        <div className="flex items-center gap-1">
          <DashboardGuideButton variant="hero" />
          <button type="button" aria-label="Refresh halaman" onClick={() => window.location.reload()} className="dashboard-icon-button drop-shadow-md"><RotateCw className="h-5 w-5" /></button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Buka menu akun" className="dashboard-icon-button drop-shadow-md"><MoreHorizontal className="h-6 w-6" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-2xl p-2">
            <p className="px-2 py-2 text-sm font-semibold">{nama}</p>
            <DropdownMenuItem asChild className="min-h-11 rounded-xl"><Link href="/dashboard/settings/profile" prefetch={false}><User className="mr-2 h-4 w-4" />Profil saya</Link></DropdownMenuItem>
            <DropdownMenuItem asChild className="min-h-11 rounded-xl"><Link href={primaryRole === 'super_admin' ? '/dashboard/settings' : '/dashboard/settings/profile'} prefetch={false}><Settings className="mr-2 h-4 w-4" />Pengaturan</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={loggingOut} onClick={logout} className="min-h-11 rounded-xl text-rose-600"><LogOut className="mr-2 h-4 w-4" />{loggingOut ? 'Keluar...' : 'Keluar sistem'}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
      <div className="relative mx-auto w-full max-w-7xl px-5 pb-6 pt-3 sm:px-6 lg:px-8">
        <Avatar className="mb-3 h-14 w-14 rounded-[18px] shadow-lg ring-2 ring-white/60 sm:h-16 sm:w-16" aria-label="Foto profil">
          <AvatarImage src={avatarUrl || ''} alt={nama} className="object-cover" />
          <AvatarFallback className="rounded-[18px] bg-emerald-100 text-2xl font-bold text-emerald-800">{namaDepan.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
        </Avatar>
        <p className="mb-1 text-xs font-medium opacity-80">{sapaan},</p>
        <FittedUserName name={nama} />
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium opacity-90 sm:text-xs">
              <span>{roleLabel}</span>
              {taAktif && <span className="inline-flex items-center gap-1"><CalendarCheck className="h-3.5 w-3.5" />TA {taAktif.nama} · Smt {taAktif.semester}</span>}
        </div>
        {logoutError && <p role="alert" className="mt-3 rounded-xl bg-white p-3 text-xs text-rose-700">{logoutError}</p>}
      </div>
    </div>
    {runningText && <div className="flex items-center gap-3 px-5 py-3 text-xs sm:px-6 lg:px-8" style={{ backgroundColor: runningTextBg, color: runningTextColor }}>
      <Megaphone className="h-4 w-4 shrink-0" aria-hidden="true" />
      <RunningText text={runningText} />
    </div>}
  </section>
}
