'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Users, CalendarPlus, GraduationCap } from 'lucide-react'
import { AnggotaManager } from './anggota-manager'
import { PertemuanWizard } from './pertemuan-wizard'
import { NilaiGrid } from './nilai-grid'
import type { EkskulSaya, KelasOption } from '../actions'

export function EkstrakurikulerClient({ initialEkskul, kelasList }: {
  initialEkskul: EkskulSaya[]
  kelasList: KelasOption[]
}) {
  const [selectedId, setSelectedId] = useState<string>(initialEkskul[0]?.id ?? '')
  const selected = initialEkskul.find(e => e.id === selectedId) || null

  if (initialEkskul.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-10 text-center">
        <Trophy className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Anda belum ditunjuk sebagai pembina ekstrakurikuler manapun.
        </p>
        <p className="text-xs text-slate-400 mt-1">Hubungi admin untuk penugasan pembina.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white dark:bg-slate-900 px-4 py-3 flex items-center gap-3">
        <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <label className="text-xs text-slate-500 dark:text-slate-400">Pilih Ekstrakurikuler</label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="h-9 text-sm mt-0.5"><SelectValue placeholder="Pilih..." /></SelectTrigger>
            <SelectContent>
              {initialEkskul.map(e => (
                <SelectItem key={e.id} value={e.id} className="text-sm">
                  {e.nama} <span className="text-slate-400">· {e.jml_anggota} anggota</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected && (
        <Tabs defaultValue="anggota" className="space-y-3" key={selected.id}>
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="anggota" className="text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" /> Anggota
            </TabsTrigger>
            <TabsTrigger value="pertemuan" className="text-xs sm:text-sm">
              <CalendarPlus className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" /> Pertemuan
            </TabsTrigger>
            <TabsTrigger value="nilai" className="text-xs sm:text-sm">
              <GraduationCap className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" /> Nilai
            </TabsTrigger>
          </TabsList>

          <TabsContent value="anggota">
            <AnggotaManager ekskulId={selected.id} kelasList={kelasList} />
          </TabsContent>
          <TabsContent value="pertemuan">
            <PertemuanWizard ekskulId={selected.id} />
          </TabsContent>
          <TabsContent value="nilai">
            <NilaiGrid ekskulId={selected.id} modeNilai={selected.mode_nilai} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
