// app/dashboard/akademik/nilai/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/utils/auth/server'
import { NilaiPageTabs } from './components/nilai-page-tabs'
import { PageHeader } from '@/components/layout/page-header'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'

export const metadata = { title: 'Rekap Nilai Akademik - MANSATAS App' }
export const dynamic = 'force-dynamic'

export default async function RekapNilaiPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const [allowed, roles] = await Promise.all([
    checkFeatureAccess(db, user.id, 'akademik-nilai'),
    getUserRoles(db, user.id),
  ])
  if (!allowed) redirect('/dashboard')

  const canManage = roles.some((role) => ['super_admin', 'admin_tu', 'kepsek', 'wakamad'].includes(role))

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Rekap Nilai Akademik"
        description={canManage
          ? 'Lihat rekap nilai semua siswa per kelas, atau import nilai rapor dari file Excel/RDM per semester.'
          : 'Lihat nilai siswa dari semester 1 sampai semester terakhir untuk mata pelajaran dan kelas yang Anda ajar.'}
      />
      <NilaiPageTabs canManage={canManage} />
    </div>
  )
}
