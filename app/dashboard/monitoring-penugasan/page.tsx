import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { Eye } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { MonitoringClient } from '@/app/dashboard/monitoring-penugasan/components/monitoring-client'
import { getMonitoringData } from './actions'
import { todayWIB } from '@/lib/time'

export const metadata = { title: 'Monitoring Penugasan - MANSATAS App' }

export const dynamic = 'force-dynamic'

async function Fetcher({ tanggal }: { tanggal: string }) {
  const { error, data } = await getMonitoringData(tanggal)
  if (error) return <div className="p-4 text-red-500 bg-red-50 rounded-lg">{error}</div>
  return <MonitoringClient initialData={data} initialTanggal={tanggal} />
}

export default async function MonitoringPenugasanPage({
  searchParams
}: {
  searchParams: { tanggal?: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'monitoring-penugasan')
  if (!allowed) redirect('/dashboard')

  const tanggal = searchParams.tanggal || todayWIB()

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Monitoring Penugasan"
        description="Pantau seluruh pendelegasian tugas antar guru sekolah."
      />

      <Suspense fallback={<PageLoading text="Memuat data monitoring..." />} key={tanggal}>
        <Fetcher tanggal={tanggal} />
      </Suspense>
    </div>
  )
}
