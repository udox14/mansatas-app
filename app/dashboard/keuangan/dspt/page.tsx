import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { getDsptList } from '../actions'
import { DsptClient } from './dspt-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'DSPT | Keuangan MANSATAS' }

async function DsptDataFetcher() {
  const { data } = await getDsptList()
  return <DsptClient initialData={data} />
}

export default async function DsptPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-dspt')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="DSPT"
        description="Dana Sumbangan Pembangunan Tahunan — kelola tagihan dan cicilan siswa"
      />
      <Suspense fallback={<PageLoading text="Memuat data DSPT..." />}>
        <DsptDataFetcher />
      </Suspense>
    </div>
  )
}
