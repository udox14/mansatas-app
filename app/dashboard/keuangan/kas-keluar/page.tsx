import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { getKasKeluarList } from '../actions'
import { KasKeluarClient } from './kas-keluar-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Kas Keluar | Keuangan MANSATAS' }

async function KasKeluarDataFetcher() {
  const tahun = new Date().getFullYear()
  const bulan = new Date().getMonth() + 1
  const { data } = await getKasKeluarList({ tahun, bulan })

  return <KasKeluarClient initialData={data} defaultTahun={tahun} defaultBulan={bulan} />
}

export default async function KasKeluarPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-kas-keluar')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Kas Keluar"
        description="Pencatatan pengeluaran dan penggunaan dana komite"
      />
      <Suspense fallback={<PageLoading text="Memuat data kas keluar..." />}>
        <KasKeluarDataFetcher />
      </Suspense>
    </div>
  )
}
