// Lokasi: app/dashboard/bk/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { getInitialDataBK } from './actions'
import { BKClient } from './components/bk-client'
import { HeartHandshake } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'

export const metadata = { title: 'Bimbingan Konseling - MANSATAS App' }
export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['guru_bk', 'super_admin', 'kepsek', 'wakamad']

export default async function BKPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const role = (user as any).role ?? ''
  if (!ALLOWED_ROLES.includes(role)) redirect('/dashboard')

  const isAdmin = ['super_admin', 'kepsek', 'wakamad'].includes(role)

  // 1 fungsi = 1 batch query
  const { taAktif, topikAll, kelasBinaan } = await getInitialDataBK(user.id, isAdmin)

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Bimbingan Konseling"
        description="Rekam dan pantau layanan bimbingan konseling siswa."
        icon={HeartHandshake}
        iconColor="text-rose-500"
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
