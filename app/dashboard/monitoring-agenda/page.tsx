// Lokasi: app/dashboard/monitoring-agenda/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { BarChart3 } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'
import { MonitoringClient } from './components/monitoring-client'
import { getFilterOptions } from './actions'

export const metadata = { title: 'Monitoring Agenda - MANSATAS App' }

async function MonitoringDataFetcher({ userId, role }: { userId: string; role: string }) {
  const filterOptions = await getFilterOptions()
  return <MonitoringClient filterOptions={filterOptions} userRole={role} />
}

export const dynamic = 'force-dynamic'
export default async function MonitoringAgendaPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'monitoring-agenda')
  if (!allowed) redirect('/dashboard')

  const role = (user as any).role ?? 'guru'

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Monitoring Agenda Guru"
        description="Pantau kepatuhan guru mengisi agenda, rekap kehadiran, dan cetak laporan."
      />
      <Suspense fallback={<PageLoading text="Menyiapkan monitoring..." />}>
        <MonitoringDataFetcher userId={user.id} role={role} />
      </Suspense>
    </div>
  )
}
