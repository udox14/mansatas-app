// Lokasi: app/dashboard/program-unggulan/kelola/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { Star } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'
import { AdminClient } from './components/admin-client'
import { getKelasUnggulanAdmin, getAllKelasForDropdown } from './actions'

export const metadata = { title: 'Kelola Program Unggulan - MANSATAS App' }
export const dynamic = 'force-dynamic'

async function DataFetcher({ currentUserId }: { currentUserId: string }) {
  const [kelasRes, allKelas] = await Promise.all([
    getKelasUnggulanAdmin(),
    getAllKelasForDropdown(),
  ])

  return (
    <AdminClient
      initialKelas={kelasRes.data || []}
      allKelas={allKelas}
      currentUserId={currentUserId}
    />
  )
}

export default async function KelolaPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'program-unggulan-kelola')
  if (!allowed) {
    redirect('/dashboard/program-unggulan')
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Kelola Program Unggulan"
        description="Atur kelas unggulan, kelola materi mingguan, dan pantau pengetesan"
      />
      <Suspense fallback={<PageLoading text="Memuat panel kelola..." />}>
        <DataFetcher currentUserId={user.id} />
      </Suspense>
    </div>
  )
}
