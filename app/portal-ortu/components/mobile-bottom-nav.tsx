'use client'

import { BookOpenCheck, CalendarDays, GraduationCap, House, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'

const ITEMS = [
  { id: 'beranda', label: 'Beranda', Icon: House, color: '#10b981' },
  { id: 'jadwal', label: 'Jadwal', Icon: CalendarDays, color: '#0ea5e9' },
  { id: 'kehadiran', label: 'Hadir', Icon: BookOpenCheck, color: '#f59e0b' },
  { id: 'nilai', label: 'Nilai', Icon: GraduationCap, color: '#6366f1' },
  { id: 'keuangan', label: 'Uang', Icon: Wallet, color: '#f43f5e' },
]

export function MobileBottomNav({
  activeTab,
  onChange
}: {
  activeTab: string
  onChange: (id: string) => void
}) {
  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t-2 border-slate-200 pb-safe shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.05)]">
      <div className="mx-auto max-w-md grid grid-cols-5 px-3 py-3 relative gap-1">
        {ITEMS.map(({ id, label, Icon, color }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="relative flex flex-col items-center justify-center gap-1 w-full h-[60px] rounded-[20px] outline-none tap-highlight-transparent"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute inset-0 border-2 rounded-[20px] border-b-[4px]"
                  style={{ backgroundColor: `${color}15`, borderColor: `${color}40`, borderBottomColor: `${color}60` }}
                  transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
                />
              )}
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.2 : 1,
                  y: isActive ? -3 : 0,
                  color: isActive ? color : '#94a3b8'
                }}
                transition={{ type: 'spring', bounce: 0.6, duration: 0.4 }}
                className="relative z-10"
              >
                <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <motion.span
                initial={false}
                animate={{
                  opacity: isActive ? 1 : 0,
                  scale: isActive ? 1 : 0,
                  y: isActive ? 0 : 5,
                  color: isActive ? color : '#94a3b8'
                }}
                transition={{ duration: 0.2 }}
                className="relative z-10 text-[10px] font-black tracking-wide"
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
