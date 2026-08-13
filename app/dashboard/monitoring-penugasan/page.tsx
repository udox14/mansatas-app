import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db-server'
import { checkFeatureAccess } from '@/lib/features'
import { Eye } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { MonitoringClient } from '@/app/dashboard/monitoring-penugasan/components/monitoring-client'
import { getMonitoringData, getPetugasPiketMonitoring } from './actions'
import { todayWIB } from '@/lib/time'

export const metadata = { title: 'Monitoring Penugasan - MANSATAS App' }

export const dynamic = 'force-dynamic'

async function Fetcher({ tanggal }: { tanggal: string }) {
  const [{ error, data }, petugasPiket] = await Promise.all([
    getMonitoringData(tanggal),
    getPetugasPiketMonitoring(tanggal),
  ])
  if (error) return <div className="p-4 text-red-500 bg-red-50 rounded-lg">{error}</div>
  return <MonitoringClient initialData={data} initialTanggal={tanggal} petugasPiket={petugasPiket} />
}

export default async function MonitoringPenugasanPage({
  searchParams
}: {
  searchParams: Promise<{ tanggal?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'monitoring-penugasan')
  if (!allowed) redirect('/dashboard')

  const { tanggal: requestedTanggal } = await searchParams
  const tanggal = requestedTanggal || todayWIB()

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
