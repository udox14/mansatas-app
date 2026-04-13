import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { checkFeatureAccess } from '@/lib/features'
import { getDB } from '@/utils/db'
import { PageHeader } from '@/components/layout/page-header'
import { ALL_ROLES } from '@/config/menu'
import { getAllUsersForCheckbox } from '@/app/dashboard/rapat/actions'
import { getJadwalNotifikasi } from './actions'
import { JadwalNotifClient } from './components/JadwalNotifClient'

export const dynamic = 'force-dynamic'

export default async function JadwalNotifPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'settings-notifications')
  if (!allowed) redirect('/dashboard')

  const [jadwals, allUsers] = await Promise.all([
    getJadwalNotifikasi(),
    getAllUsersForCheckbox(),
  ])

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Jadwal Notifikasi Otomatis"
        description="Kelola notifikasi push yang dikirim secara otomatis sesuai waktu dan target yang ditentukan."
      />
      <JadwalNotifClient
        jadwals={jadwals}
        roles={[...ALL_ROLES]}
        allUsers={allUsers}
      />
    </div>
  )
}
