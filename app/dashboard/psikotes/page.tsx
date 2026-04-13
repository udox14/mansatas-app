// Lokasi: app/dashboard/psikotes/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { getInitialDataPsikotes } from './actions'
import { PsikotesClient } from './components/psikotes-client'
import { Brain } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Psikotes & Minat - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function PsikotesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'psikotes')
  if (!allowed) redirect('/dashboard')

  const userRoles = await getUserRoles(db, user.id)
  const role = (user as any).role ?? ''
  const isAdmin = userRoles.some(r => ['super_admin', 'kepsek'].includes(r))
  const { mappingList, kelasList, stats } = await getInitialDataPsikotes(role, user.id)

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Psikotes & Minat"
        description="Data hasil tes psikologis, bakat, minat, dan rekomendasi jurusan siswa."
      />
      <PsikotesClient
        mappingList={mappingList}
        kelasList={kelasList}
        stats={stats}
        userRole={role}
        isAdmin={isAdmin}
      />
    </div>
  )
}
