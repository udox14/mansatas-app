import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { getDsptList } from '../actions'
import { DsptClient } from './dspt-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'DSPT | Keuangan MANSATAS' }

export default async function DsptPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-dspt')
  if (!allowed) redirect('/dashboard')

  const { data } = await getDsptList()

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="DSPT"
        description="Dana Sumbangan Pembangunan Tahunan — kelola tagihan dan cicilan siswa"
      />
      <DsptClient initialData={data} />
    </div>
  )
}
