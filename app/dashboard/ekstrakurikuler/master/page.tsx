// Lokasi: app/dashboard/ekstrakurikuler/master/page.tsx
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Activity } from 'lucide-react'
import { getEkskulList, getGuruList, getMonitoringEkskul } from './actions'
import { MasterTable } from './components/master-table'
import { MonitoringTab } from './components/monitoring-tab'

export const metadata = { title: 'Master Ekstrakurikuler - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function MasterEkskulPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'ekstrakurikuler-master')
  if (!allowed) redirect('/dashboard')

  const [ekskulList, guruList, monitoring] = await Promise.all([
    getEkskulList(),
    getGuruList(),
    getMonitoringEkskul(),
  ])

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Master Ekstrakurikuler"
        description="Kelola daftar ekstrakurikuler, tunjuk pembina, dan pantau kegiatan."
      />

      <Tabs defaultValue="daftar" className="space-y-3">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="daftar" className="text-xs sm:text-sm">
            <Trophy className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Daftar Ekskul
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="text-xs sm:text-sm">
            <Activity className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
            Monitoring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daftar">
          <MasterTable initialList={ekskulList} guruList={guruList} />
        </TabsContent>

        <TabsContent value="monitoring">
          <MonitoringTab rows={monitoring} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
