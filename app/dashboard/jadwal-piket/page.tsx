import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { Calendar } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { JadwalPiketClient } from '@/app/dashboard/jadwal-piket/components/jadwal-piket-client'
import { getJadwalPiketData, getDaftarGuruDropdown } from './actions'

export const metadata = { title: 'Jadwal Guru Piket - MANSATAS App' }

export const dynamic = 'force-dynamic'

async function Fetcher() {
  const [data, guruList] = await Promise.all([
    getJadwalPiketData(),
    getDaftarGuruDropdown()
  ])
  
  return <JadwalPiketClient data={data} guruList={guruList} />
}

export default async function JadwalPiketPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'jadwal-piket')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Jadwal Guru Piket"
        description="Kelola jadwal tugas guru piket dan pengaturan shift hariannya."
      />

      <Suspense fallback={<PageLoading text="Memuat jadwal piket..." />}>
        <Fetcher />
      </Suspense>
    </div>
  )
}
