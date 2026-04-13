'use client'

import { useState } from 'react'
import type { EntriTamu } from '../actions'
import { BukuTamuClient } from './buku-tamu-client'
import { BukuTamuAdminClient } from './buku-tamu-admin-client'
import { cn } from '@/lib/utils'
import { BookUser, BarChart3 } from 'lucide-react'

interface Props {
  tamuHariIni: EntriTamu[]
  userRoles: string[]
  isAdmin: boolean
  adminData: EntriTamu[]
  adminTotal: number
}

export function BukuTamuPageTabs({ tamuHariIni, userRoles, isAdmin, adminData, adminTotal }: Props) {
  const [tab, setTab] = useState<'tamu' | 'monitoring'>('tamu')

  // Jika bukan admin, langsung render form tamu (tanpa tab atas)
  if (!isAdmin) {
    return <BukuTamuClient tamuHariIni={tamuHariIni} userRoles={userRoles} />
  }

  return (
    <div className="space-y-5">
      {/* Top-level Tab Switcher (hanya untuk admin) */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
        {[
          { id: 'tamu', label: 'Form Tamu', icon: BookUser },
          { id: 'monitoring', label: 'Monitoring', icon: BarChart3 },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-200',
              tab === t.id
                ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tamu' && (
        <div className="animate-in fade-in slide-in-from-left-2 duration-300">
          <BukuTamuClient tamuHariIni={tamuHariIni} userRoles={userRoles} />
        </div>
      )}

      {tab === 'monitoring' && (
        <div className="animate-in fade-in slide-in-from-right-2 duration-300">
          <BukuTamuAdminClient initialData={adminData} initialTotal={adminTotal} />
        </div>
      )}
    </div>
  )
}
