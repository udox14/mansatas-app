import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { getDashboardStats } from './actions'
import { KeuanganDashboardClient } from './components/dashboard-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard Keuangan | MANSATAS' }

async function KeuanganStatsDataFetcher() {
  const stats = await getDashboardStats()
  return <KeuanganDashboardClient stats={stats} />
}

export default async function KeuanganDashboardPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-dashboard')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Dashboard Keuangan"
        description="Ringkasan arus kas dan tingkat kepatuhan pembayaran"
      />
      <Suspense fallback={<PageLoading text="Memuat statistik keuangan..." />}>
        <KeuanganStatsDataFetcher />
      </Suspense>
    </div>
  )
}
