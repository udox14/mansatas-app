import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { getRekapAngkatan } from '../actions'
import { LaporanClient } from './laporan-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Laporan Keuangan | MANSATAS' }

async function LaporanDataFetcher() {
  const { data: rekapAngkatan } = await getRekapAngkatan()
  return <LaporanClient rekapAngkatan={rekapAngkatan} />
}

export default async function LaporanPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-laporan')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Laporan Keuangan"
        description="Rekap pembayaran per angkatan dan ringkasan arus kas"
      />
      <Suspense fallback={<PageLoading text="Memuat laporan keuangan..." />}>
        <LaporanDataFetcher />
      </Suspense>
    </div>
  )
}
