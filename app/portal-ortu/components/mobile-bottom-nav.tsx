'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpenCheck, CalendarDays, GraduationCap, House, Wallet } from 'lucide-react'

const ITEMS = [
  { id: 'beranda', label: 'Beranda', Icon: House },
  { id: 'jadwal', label: 'Jadwal', Icon: CalendarDays },
  { id: 'kehadiran', label: 'Hadir', Icon: BookOpenCheck },
  { id: 'nilai', label: 'Nilai', Icon: GraduationCap },
  { id: 'keuangan', label: 'Keuangan', Icon: Wallet },
]

export function MobileBottomNav() {
  const [active, setActive] = useState('beranda')
  const ids = useMemo(() => ITEMS.map(i => i.id), [])

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) setActive(id)
          })
        },
        { rootMargin: '-35% 0px -55% 0px', threshold: 0.01 }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach((o) => o.disconnect())
  }, [ids])

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur shadow-[0_-4px_20px_-4px_rgba(15,23,42,0.08)]">
      <div className="mx-auto max-w-6xl grid grid-cols-5 px-2 py-2">
        {ITEMS.map(({ id, label, Icon }) => {
          const isActive = active === id
          return (
            <a key={id} href={`#${id}`} className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${isActive ? 'text-emerald-700' : 'text-slate-600'}`}>
              <Icon className="h-4 w-4" />
              {label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}

