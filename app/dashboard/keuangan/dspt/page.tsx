import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { isPlayReviewerRole } from '@/lib/play-reviewer'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { DsptClient } from './dspt-client'
import { loadBillingPageData } from './billing-page-data'
import { DsptReminderDialog } from './reminder-dialog'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'DSPT & SPP | Keuangan MANSATAS' }

async function DsptDataFetcher() {
  const result = await loadBillingPageData('active')
  return (
    <DsptClient
      initialData={result.data}
      initialSppData={result.sppData}
      angkatanList={result.angkatanList}
      studentScope="active"
    />
  )
}

export default async function DsptPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-dspt')
  if (!allowed) redirect('/dashboard')
  const roles = await getUserRoles(db, session.user.id)
  const canSendReminder = !isPlayReviewerRole(roles) && roles.some(role => role === 'bendahara_komite' || role === 'super_admin')

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="DSPT & SPP"
        description="Keuangan khusus siswa aktif: DSPT dan tunggakan SPP terdahulu"
      >
        {canSendReminder && <DsptReminderDialog />}
      </PageHeader>
      <Suspense fallback={<PageLoading text="Memuat data DSPT..." />}>
        <DsptDataFetcher />
      </Suspense>
    </div>
  )
}
