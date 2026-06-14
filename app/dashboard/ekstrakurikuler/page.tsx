// Lokasi: app/dashboard/ekstrakurikuler/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { getEffectiveUser, getActAsUserList } from '@/lib/act-as'
import { ActAsBanner } from '@/components/layout/act-as-banner'
import { EkstrakurikulerClient } from './components/ekstrakurikuler-client'
import { getEkskulSaya, getKelasList } from './actions'

export const metadata = { title: 'Ekstrakurikuler - MANSATAS App' }
export const dynamic = 'force-dynamic'

async function DataFetcher() {
  const [ekskulList, kelasList] = await Promise.all([getEkskulSaya(), getKelasList()])
  return <EkstrakurikulerClient initialEkskul={ekskulList} kelasList={kelasList} />
}

export default async function EkstrakurikulerPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'ekstrakurikuler')
  if (!allowed) redirect('/dashboard')

  const userRoles = await getUserRoles(db, user.id)
  const isSuperAdmin = userRoles.includes('super_admin')

  const effective = await getEffectiveUser()
  const isActingAs = effective?.isActingAs || false
  const actAsUsers = isSuperAdmin ? await getActAsUserList() : []

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Ekstrakurikuler"
        description="Kelola anggota, presensi pembina & absensi latihan, serta penilaian ekstrakurikuler Anda."
      />

      {isSuperAdmin && (
        <Suspense fallback={null}>
          <ActAsBanner
            isActingAs={isActingAs}
            actAsName={effective?.actAsName || null}
            userList={actAsUsers}
            adminName={effective?.realUserName || 'Admin'}
            showDatePicker={false}
          />
        </Suspense>
      )}

      <Suspense fallback={<PageLoading text="Memuat ekstrakurikuler..." />}>
        <DataFetcher />
      </Suspense>
    </div>
  )
}
