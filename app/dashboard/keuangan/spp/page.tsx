import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { getSppSettings, getSppTagihanList } from '../actions'
import { SppClient } from './spp-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'SPP | Keuangan MANSATAS' }

async function SppDataFetcher() {
  const tahun = new Date().getFullYear()
  const bulan = new Date().getMonth() + 1

  const [{ data: settings }, { data: tagihan }] = await Promise.all([
    getSppSettings(),
    getSppTagihanList({ tahun, bulan }),
  ])

  return (
    <SppClient
      initialSettings={settings}
      initialTagihan={tagihan}
      defaultTahun={tahun}
      defaultBulan={bulan}
    />
  )
}

export default async function SppPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-spp')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="SPP"
        description="Sumbangan Pembinaan Pendidikan — tagihan bulanan per siswa"
      />
      <Suspense fallback={<PageLoading text="Memuat data SPP..." />}>
        <SppDataFetcher />
      </Suspense>
    </div>
  )
}
