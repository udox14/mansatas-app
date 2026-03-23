// Lokasi: app/dashboard/psikotes/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getInitialDataPsikotes } from './actions'
import { PsikotesClient } from './components/psikotes-client'
import { Brain } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Psikotes & Minat - MANSATAS App' }
export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'kepsek', 'wakamad', 'guru_bk', 'guru']

export default async function PsikotesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const role = (user as any).role ?? ''
  if (!ALLOWED_ROLES.includes(role)) redirect('/dashboard')

  const isAdmin = ['super_admin', 'kepsek'].includes(role)
  const { mappingList, kelasList, stats } = await getInitialDataPsikotes(role, user.id)

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Psikotes & Minat"
        description="Data hasil tes psikologis, bakat, minat, dan rekomendasi jurusan siswa."
        icon={Brain}
        iconColor="text-violet-500"
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
