'use client'

import { BookOpenCheck, CalendarDays, GraduationCap, House, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'

const ITEMS = [
  { id: 'beranda', label: 'Beranda', Icon: House },
  { id: 'jadwal', label: 'Jadwal', Icon: CalendarDays },
  { id: 'kehadiran', label: 'Hadir', Icon: BookOpenCheck },
  { id: 'nilai', label: 'Akademik', Icon: GraduationCap },
  { id: 'keuangan', label: 'Keuangan', Icon: Wallet },
]

export function MobileBottomNav({
  activeTab,
  onChange
}: {
  activeTab: string
  onChange: (id: string) => void
}) {
  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl border-t border-slate-200 pb-safe">
      <div className="mx-auto max-w-md flex justify-between px-2 pt-2 pb-1 relative">
        {ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="relative flex flex-col items-center justify-center gap-1 w-full h-[54px] rounded-lg outline-none tap-highlight-transparent"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <motion.div
                initial={false}
                animate={{
                  y: isActive ? -2 : 0,
                  color: isActive ? '#0f172a' : '#64748b' // slate-900 / slate-500
                }}
                transition={{ duration: 0.2 }}
                className="relative z-10"
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <motion.span
                initial={false}
                animate={{
                  color: isActive ? '#0f172a' : '#64748b',
                  fontWeight: isActive ? 600 : 500
                }}
                transition={{ duration: 0.2 }}
                className="text-[10px]"
              >
                {label}
              </motion.span>
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active-dot"
                  className="absolute -top-2 w-1 h-1 rounded-full bg-slate-900"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
