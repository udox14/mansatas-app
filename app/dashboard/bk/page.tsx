// Lokasi: app/dashboard/bk/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { getInitialDataBK } from './actions'
import { BKClient } from './components/bk-client'
import { HeartHandshake } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Bimbingan Konseling - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function BKPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'bk')
  if (!allowed) redirect('/dashboard')

  const userRoles = await getUserRoles(db, user.id)
  const role = (user as any).role ?? ''
  const isAdmin = userRoles.some(r => ['super_admin', 'kepsek', 'wakamad'].includes(r))

  // 1 fungsi = 1 batch query
  const { taAktif, topikAll, kelasBinaan } = await getInitialDataBK(user.id, isAdmin)

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Bimbingan Konseling"
        description="Rekam dan pantau layanan bimbingan konseling siswa."
      />
      <BKClient
        currentUserId={user.id}
        userRole={role}
        taAktif={taAktif}
        topikAll={topikAll}
        kelasBinaan={kelasBinaan}
        isAdmin={isAdmin}
      />
    </div>
  )
}
