'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TableProperties, Upload } from 'lucide-react'
import { NilaiClient } from './nilai-client'
import { RekapTabel } from './rekap-tabel'

export function NilaiPageTabs() {
  return (
    <Tabs defaultValue="rekap" className="space-y-4">
      <TabsList>
        <TabsTrigger value="rekap" className="gap-1.5">
          <TableProperties className="h-3.5 w-3.5" /> Lihat Rekap
        </TabsTrigger>
        <TabsTrigger value="import" className="gap-1.5">
          <Upload className="h-3.5 w-3.5" /> Import &amp; Kelola
        </TabsTrigger>
      </TabsList>
      <TabsContent value="rekap">
        <RekapTabel />
      </TabsContent>
      <TabsContent value="import" className="space-y-4">
        <NilaiClient />
      </TabsContent>
    </Tabs>
  )
}
