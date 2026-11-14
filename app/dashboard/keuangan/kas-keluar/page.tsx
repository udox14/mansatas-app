import { isKomiteFundScope } from '@/lib/komite-funds'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { checkFeatureAccess, checkFeatureCrudAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { getCashflowPage } from './actions'
import { KasKeluarClient } from './kas-keluar-client'
import { getKomiteReportSettings } from '@/lib/komite-report-settings'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Arus Kas | Keuangan MANSATAS' }

async function KasKeluarDataFetcher({ permissions, fund, entry }: { fund?:string; entry?:string; permissions: { create: boolean; update: boolean; delete: boolean } }) {
  const [data, reportSettings] = await Promise.all([getCashflowPage({ page: 1, pageSize: 20, angkatan:fund, entryId:entry }),getKomiteReportSettings()])
  return <KasKeluarClient initialData={data} initialFund={fund} initialEntry={entry} permissions={permissions} proofNumberMode={reportSettings.proofNumberMode} />
}

export default async function KasKeluarPage({searchParams}:{searchParams?:Promise<{fund?:string;entry?:string}>}) {
  const params = await searchParams
  const fund = isKomiteFundScope(params?.fund) ? params.fund : undefined
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-kas-keluar')
  if (!allowed) redirect('/dashboard')
  const [canCreate, canUpdate, canDelete] = await Promise.all([
    checkFeatureCrudAccess(db, session.user.id, 'keuangan-kas-keluar', 'create'),
    checkFeatureCrudAccess(db, session.user.id, 'keuangan-kas-keluar', 'update'),
    checkFeatureCrudAccess(db, session.user.id, 'keuangan-kas-keluar', 'delete'),
  ])

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Arus Kas"
        description="Pemasukan DSPT, SPP, pemasukan lain, dan pengeluaran dalam satu tempat"
      />
      <Suspense fallback={<PageLoading text="Memuat arus kas..." />}>
        <KasKeluarDataFetcher fund={fund} entry={params?.entry} permissions={{ create: canCreate, update: canUpdate, delete: canDelete }} />
      </Suspense>
    </div>
  )
}
