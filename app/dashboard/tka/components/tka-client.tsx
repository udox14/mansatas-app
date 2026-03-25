// Lokasi: app/dashboard/tka/components/tka-client.tsx
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClipboardList, BarChart2, Upload, BookMarked } from 'lucide-react'
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
        <span>Tahun Ajaran Aktif: <strong className="text-slate-700 dark:text-slate-300">{tahunAjaranAktif.nama} — Semester {tahunAjaranAktif.semester}</strong></span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mapel" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <BookMarked className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mapel Pilihan</span>
            <span className="sm:hidden">Pilihan</span>
          </TabsTrigger>
          <TabsTrigger value="rekap" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <ClipboardList className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Rekapitulasi</span>
            <span className="sm:hidden">Rekap</span>
          </TabsTrigger>
          <TabsTrigger value="hasil" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Hasil TKA</span>
            <span className="sm:hidden">Hasil</span>
          </TabsTrigger>
          <TabsTrigger value="analitik" className="flex items-center gap-1.5 text-xs sm:text-sm">
            <BarChart2 className="h-3.5 w-3.5" />
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
