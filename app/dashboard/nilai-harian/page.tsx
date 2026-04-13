import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { getPenugasanGuru } from './actions'
import { NilaiHarianClient } from './components/NilaiHarianClient'
import { getEffectiveUser, getActAsUserList } from '@/lib/act-as'
import { ActAsBanner } from '@/components/layout/act-as-banner'

import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { getDB } from '@/utils/db'

export const dynamic = 'force-dynamic'

export default async function NilaiHarianPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const userRoles = await getUserRoles(db, user.id)
  const isSuperAdmin = userRoles.includes('super_admin')

  const effective = await getEffectiveUser()
  const effectiveUserId = effective?.effectiveUserId || user.id
  const isActingAs = effective?.isActingAs || false

  const [penugasanList, actAsUsers] = await Promise.all([
    getPenugasanGuru(effectiveUserId),
    isSuperAdmin ? getActAsUserList() : Promise.resolve([])
  ])

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Input Nilai Harian"
        description="Kelola nilai harian siswa per mata pelajaran dan kelas yang Anda ampu."
      />

      {/* Act As Banner for Admin */}
      {isSuperAdmin && (
        <ActAsBanner 
          userList={actAsUsers} 
          isActingAs={isActingAs} 
          actAsName={effective?.actAsName || null}
          adminName={effective?.realUserName || 'Admin'}
        />
      )}

      <NilaiHarianClient penugasanList={penugasanList} />
    </div>
  )
}
