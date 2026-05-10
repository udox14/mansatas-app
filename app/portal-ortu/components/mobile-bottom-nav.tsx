'use client'

import { BookOpenCheck, CalendarDays, GraduationCap, House, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'

const ITEMS = [
  { id: 'beranda', label: 'Beranda', Icon: House },
  { id: 'jadwal', label: 'Jadwal', Icon: CalendarDays },
  { id: 'kehadiran', label: 'Hadir', Icon: BookOpenCheck },
  { id: 'nilai', label: 'Nilai', Icon: GraduationCap },
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
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 border-t border-slate-200 bg-white shadow-[0_-4px_20px_-4px_rgba(15,23,42,0.08)] pb-safe">
      <div className="mx-auto max-w-md grid grid-cols-5 px-2 py-2 relative">
        {ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="relative flex flex-col items-center justify-center gap-1 w-full h-14 rounded-2xl outline-none tap-highlight-transparent"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute inset-0 bg-emerald-50 rounded-2xl"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.15 : 1,
                  y: isActive ? -2 : 0,
                  color: isActive ? '#047857' : '#64748b'
                }}
                transition={{ type: 'spring', bounce: 0.5, duration: 0.5 }}
                className="relative z-10"
              >
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <motion.span
                initial={false}
                animate={{
                  opacity: isActive ? 1 : 0.7,
                  scale: isActive ? 1 : 0.9,
                  color: isActive ? '#047857' : '#64748b'
                }}
                className="relative z-10 text-[10px] font-bold"
              >
                {label}
              </motion.span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
