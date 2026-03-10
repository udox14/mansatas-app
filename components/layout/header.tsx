'use client'

import { Menu, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MENU_ITEMS } from '@/config/menu'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface HeaderProps {
  userRole: string
  userName: string
  userEmail: string
  avatarUrl: string | null
}

export function Header({ userRole, userName, userEmail, avatarUrl }: HeaderProps) {
  const pathname = usePathname()
  const filteredMenu = MENU_ITEMS.filter((item) => item.roles.includes(userRole))

  const pathSegments = pathname.split('/').filter(Boolean)
  let pageTitle = 'Dashboard Overview'
  
  if (pathname !== '/dashboard' && pathSegments.length > 0) {
    const lastSegment = pathSegments[pathSegments.length - 1]
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastSegment)
    if (isUUID) {
      const parentSegment = pathSegments[pathSegments.length - 2]
      pageTitle = `Detail ${parentSegment}`
    } else {
      pageTitle = lastSegment.replace(/-/g, ' ')
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/60 bg-white/80 backdrop-blur-xl px-4 shadow-sm md:px-6">
      <div className="flex items-center gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden text-slate-600 hover:text-emerald-700 hover:bg-emerald-50">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-slate-950 border-r-slate-800 text-slate-300">
            <SheetTitle className="sr-only">Menu Navigasi Mobile</SheetTitle>
            <div className="flex h-16 items-center border-b border-slate-800/80 px-6">
              <span className="font-bold text-xl text-white flex items-center gap-3 tracking-tight">
                <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center font-black shadow-[0_0_15px_rgba(52,211,153,0.4)]">M</div>
                MANSATAS
              </span>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 px-3 mt-2">Menu Utama</div>
              {filteredMenu.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href} className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 group relative",
                    isActive ? "bg-emerald-500/10 text-emerald-400" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
                  )}>
                    <Icon className={cn("h-5 w-5 shrink-0 transition-colors", isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-emerald-300")} />
                    {item.title}
                    {isActive && <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
                  </Link>
                )
              })}
            </nav>
            <div className="absolute bottom-0 w-full p-4 border-t border-slate-800/80 text-xs text-slate-500 font-medium text-center">
              &copy; 2026 MAN 1 Tasikmalaya
            </div>
          </SheetContent>
        </Sheet>
        
        <h1 className="text-lg font-bold text-slate-800 capitalize hidden sm:block tracking-tight">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
              <Avatar className="h-10 w-10 ring-2 ring-emerald-100 transition-all hover:ring-emerald-300 shadow-sm">
                <AvatarImage src={avatarUrl || ''} alt={userName} />
                <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-teal-200 text-emerald-800 font-bold">
                  {userName?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 rounded-xl border-slate-100 shadow-lg" align="end" forceMount>
            <DropdownMenuLabel className="font-normal p-3 bg-slate-50/50 rounded-t-lg">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold leading-none text-slate-900">{userName}</p>
                <p className="text-xs leading-none text-slate-500 font-medium truncate">{userEmail}</p>
                <p className="text-[10px] mt-2 inline-flex w-fit px-2 py-0.5 rounded-full uppercase tracking-wider font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {userRole.replace('_', ' ')}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem asChild className="p-2.5 cursor-pointer focus:bg-emerald-50 focus:text-emerald-700 rounded-lg m-1">
              <Link href="/dashboard/settings/profile">
                <User className="mr-2 h-4 w-4" />
                <span className="font-medium">Profil Saya</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem asChild className="p-2.5 cursor-pointer focus:bg-rose-50 focus:text-rose-700 rounded-lg m-1 text-rose-600 font-medium">
              <a href="/api/logout">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Keluar Sistem</span>
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}