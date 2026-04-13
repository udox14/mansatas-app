// Lokasi: app/dashboard/buku-tamu/page.tsx
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { PageLoading } from '@/components/layout/page-loading'
import { BukuTamuPageWrapper } from './components/buku-tamu-page-wrapper'

export const metadata = { title: 'Buku Tamu - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function BukuTamuPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'buku-tamu')
  if (!allowed) redirect('/dashboard')

  const userRoles = await getUserRoles(db, user.id)
  const isAdmin = userRoles.some(r => ['super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(r))

  return (
    <div className="animate-in fade-in duration-500 pb-12">
      <Suspense fallback={<PageLoading text="Memuat Buku Tamu..." />}>
        <BukuTamuPageWrapper userId={user.id} userRoles={userRoles} isAdmin={isAdmin} />
      </Suspense>
    </div>
  )
}
