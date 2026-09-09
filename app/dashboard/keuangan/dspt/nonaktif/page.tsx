import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { DsptClient } from '../dspt-client'
import { loadBillingPageData } from '../billing-page-data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'DSPT & SPP Nonaktif | Keuangan MANSATAS' }

async function NonaktifDataFetcher() {
  const result = await loadBillingPageData('inactive')
  return <DsptClient initialData={result.data} initialSppData={result.sppData} angkatanList={result.angkatanList} studentScope="inactive" />
}

export default async function DsptNonaktifPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  if (!(await checkFeatureAccess(db, session.user.id, 'keuangan-dspt'))) redirect('/dashboard')
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader title="DSPT & SPP Nonaktif" description="Keuangan siswa lulus, pindah, keluar, dan status nonaktif lainnya" />
      <Suspense fallback={<PageLoading text="Memuat data siswa nonaktif..." />}><NonaktifDataFetcher /></Suspense>
    </div>
  )
}
