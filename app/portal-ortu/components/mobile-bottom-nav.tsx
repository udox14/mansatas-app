'use client'

import { useState } from 'react'
import {
  BookOpenText,
  CalendarBlank,
  ChatText,
  Gear,
  House,
  List,
  Question,
  SignOut,
  Student,
  Wallet,
  CheckSquareOffset,
} from '@phosphor-icons/react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

const PRIMARY_ITEMS = [
  { id: 'beranda', label: 'Beranda', Icon: House },
  { id: 'jadwal', label: 'Jadwal', Icon: CalendarBlank },
  { id: 'kehadiran', label: 'Kehadiran', Icon: CheckSquareOffset },
  { id: 'nilai', label: 'Akademik', Icon: Student },
]

const SECONDARY_ITEMS = [
  { id: 'keuangan', label: 'Keuangan', description: 'Tagihan, pembayaran, dan kuitansi', Icon: Wallet },
  { id: 'saran', label: 'Kotak Saran', description: 'Sampaikan masukan kepada madrasah', Icon: ChatText },
  { id: 'dokumentasi', label: 'Dokumentasi', description: 'Panduan penggunaan portal', Icon: BookOpenText },
]

export function MobileBottomNav({
  activeTab,
  onChange,
  onOpenAccount,
  onStartTour,
}: {
  activeTab: string
  onChange: (id: string) => void
  onOpenAccount: () => void
  onStartTour: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuIsActive = SECONDARY_ITEMS.some((item) => item.id === activeTab)

  const chooseSecondary = (id: string) => {
    onChange(id)
    setMenuOpen(false)
  }

  return (
    <>
      <nav
        aria-label="Navigasi utama orang tua"
        className="portal-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-[#D8D4CC] bg-[#FAF9F7]/95 pb-safe backdrop-blur-md"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 px-1.5 pb-1 pt-1.5">
          {PRIMARY_ITEMS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onChange(id)}
                className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#C2522D] focus-visible:ring-offset-2 ${
                  isActive ? 'bg-[#F2F0EC] text-[#C2522D]' : 'text-[#6B6B63]'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" weight={isActive ? 'fill' : 'regular'} />
                <span className="max-w-full truncate text-[10px] font-semibold leading-none">{label}</span>
              </button>
            )
          })}

          <button
            type="button"
            aria-current={menuIsActive ? 'page' : undefined}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#C2522D] focus-visible:ring-offset-2 ${
              menuIsActive ? 'bg-[#F2F0EC] text-[#C2522D]' : 'text-[#6B6B63]'
            }`}
          >
            <List className="h-5 w-5 shrink-0" weight={menuIsActive ? 'bold' : 'regular'} />
            <span className="whitespace-nowrap text-[10px] font-semibold leading-none">Menu</span>
          </button>
        </div>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="bottom"
          className="portal-dialog max-h-[88dvh] overflow-y-auto rounded-t-2xl border-[#D8D4CC] bg-[#FAF9F7] px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-5 text-[#1A1A18]"
        >
          <SheetHeader className="pr-10 text-left">
            <SheetTitle className="text-xl font-medium tracking-[-0.02em] text-[#1A1A18]">Menu orang tua</SheetTitle>
            <SheetDescription className="text-sm leading-6 text-[#6B6B63]">
              Layanan tambahan dan pengaturan portal.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 grid gap-2">
            {SECONDARY_ITEMS.map(({ id, label, description, Icon }) => {
              const isActive = activeTab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => chooseSecondary(id)}
                  className={`flex min-h-16 w-full items-center gap-3 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#C2522D] focus-visible:ring-offset-2 ${
                    isActive
                      ? 'border-[#C2522D] bg-[#F2F0EC]'
                      : 'border-[#D8D4CC] bg-white hover:bg-[#F2F0EC]'
                  }`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${isActive ? 'bg-[#C2522D] text-white' : 'bg-[#F2F0EC] text-[#6B6B63]'}`}>
                    <Icon className="h-5 w-5" weight={isActive ? 'fill' : 'regular'} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#1A1A18]">{label}</span>
                    <span className="mt-0.5 block truncate text-xs text-[#6B6B63]">{description}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="my-4 h-px bg-[#D8D4CC]" />

          <div className="grid gap-1">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onOpenAccount() }}
              className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-[#1A1A18] outline-none hover:bg-[#F2F0EC] focus-visible:ring-2 focus-visible:ring-[#C2522D]"
            >
              <Gear className="h-5 w-5 shrink-0 text-[#6B6B63]" />
              <span className="whitespace-nowrap">Pengaturan akun</span>
            </button>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onStartTour() }}
              className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-[#1A1A18] outline-none hover:bg-[#F2F0EC] focus-visible:ring-2 focus-visible:ring-[#C2522D]"
            >
              <Question className="h-5 w-5 shrink-0 text-[#6B6B63]" />
              <span className="whitespace-nowrap">Panduan halaman</span>
            </button>
            <form action="/api/auth/sign-out" method="post">
              <button className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-[#A63D32] outline-none hover:bg-[#FFF1EF] focus-visible:ring-2 focus-visible:ring-[#C2522D]">
                <SignOut className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap">Keluar</span>
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
