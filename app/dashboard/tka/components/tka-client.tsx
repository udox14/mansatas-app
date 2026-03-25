// Lokasi: app/dashboard/tka/components/tka-client.tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClipboardList, BarChart2, Upload, BookMarked } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KelasItem } from '../actions'
import { TabMapelPilihan } from './tab-mapel-pilihan'
import { TabRekap } from './tab-rekap'
import { TabHasil } from './tab-hasil'
import { TabAnalitik } from './tab-analitik'

interface Props {
  tahunAjaranAktif: { id: string; nama: string; semester: string } | null
  kelasList: KelasItem[]
  hasHasil: boolean
  userRole: string
}

const TAB_STYLES = {
  mapel:   { active: 'data-[state=active]:bg-sky-500 data-[state=active]:text-white data-[state=active]:shadow-sm',   icon: 'text-sky-500' },
  rekap:   { active: 'data-[state=active]:bg-violet-500 data-[state=active]:text-white data-[state=active]:shadow-sm', icon: 'text-violet-500' },
  hasil:   { active: 'data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-sm',  icon: 'text-amber-500' },
  analitik:{ active: 'data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-sm',icon: 'text-emerald-500' },
}

export function TkaClient({ tahunAjaranAktif, kelasList, hasHasil, userRole }: Props) {
  const [activeTab, setActiveTab] = useState('mapel')

  if (!tahunAjaranAktif) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ClipboardList className="h-10 w-10 text-slate-300 mb-3" />
        <p className="text-slate-500 font-medium">Belum ada tahun ajaran aktif</p>
        <p className="text-slate-400 text-sm mt-1">Aktifkan tahun ajaran terlebih dahulu di menu Pengaturan.</p>
      </div>
    )
  }

  const isAdmin = ['super_admin', 'kepsek', 'wakamad', 'guru_bk'].includes(userRole)

  return (
    <div className="space-y-4">
      {/* Info Tahun Ajaran */}
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 rounded-lg px-3 py-2">
        <ClipboardList className="h-3.5 w-3.5 text-sky-500 shrink-0" />
        <span>
          Tahun Ajaran Aktif:{' '}
          <strong className="text-slate-700 dark:text-slate-300">
            {tahunAjaranAktif.nama} — Semester {tahunAjaranAktif.semester}
          </strong>
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 h-10 bg-slate-100 dark:bg-slate-800/60 p-1">
          <TabsTrigger
            value="mapel"
            className={cn('flex items-center gap-1.5 text-xs sm:text-sm transition-all', TAB_STYLES.mapel.active)}
          >
            <BookMarked className={cn('h-3.5 w-3.5 shrink-0', activeTab === 'mapel' ? 'text-white' : TAB_STYLES.mapel.icon)} />
            <span className="hidden sm:inline">Mapel Pilihan</span>
            <span className="sm:hidden">Pilihan</span>
          </TabsTrigger>

          <TabsTrigger
            value="rekap"
            className={cn('flex items-center gap-1.5 text-xs sm:text-sm transition-all', TAB_STYLES.rekap.active)}
          >
            <ClipboardList className={cn('h-3.5 w-3.5 shrink-0', activeTab === 'rekap' ? 'text-white' : TAB_STYLES.rekap.icon)} />
            <span className="hidden sm:inline">Rekapitulasi</span>
            <span className="sm:hidden">Rekap</span>
          </TabsTrigger>

          <TabsTrigger
            value="hasil"
            className={cn('flex items-center gap-1.5 text-xs sm:text-sm transition-all', TAB_STYLES.hasil.active)}
          >
            <Upload className={cn('h-3.5 w-3.5 shrink-0', activeTab === 'hasil' ? 'text-white' : TAB_STYLES.hasil.icon)} />
            <span className="hidden sm:inline">Hasil TKA</span>
            <span className="sm:hidden">Hasil</span>
          </TabsTrigger>

          <TabsTrigger
            value="analitik"
            className={cn('flex items-center gap-1.5 text-xs sm:text-sm transition-all', TAB_STYLES.analitik.active)}
          >
            <BarChart2 className={cn('h-3.5 w-3.5 shrink-0', activeTab === 'analitik' ? 'text-white' : TAB_STYLES.analitik.icon)} />
            <span>Analitik</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mapel" className="mt-4">
          <TabMapelPilihan
            tahunAjaranId={tahunAjaranAktif.id}
            kelasList={kelasList}
            userRole={userRole}
          />
        </TabsContent>

        <TabsContent value="rekap" className="mt-4">
          <TabRekap
            tahunAjaranId={tahunAjaranAktif.id}
            kelasList={kelasList}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="hasil" className="mt-4">
          <TabHasil
            tahunAjaranId={tahunAjaranAktif.id}
            kelasList={kelasList}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="analitik" className="mt-4">
          <TabAnalitik
            tahunAjaranId={tahunAjaranAktif.id}
            hasHasil={hasHasil}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
