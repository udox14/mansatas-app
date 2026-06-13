// Lokasi: app/dashboard/sp/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'
import { getDataForSP, getRiwayatSP } from './actions'
import { SpClient } from './components/sp-client'

export const metadata = { title: 'Surat Peringatan (SP) - MANSATAS App' }
export const dynamic = 'force-dynamic'

async function SpDataFetcher({ userId, userName }: { userId: string; userName: string }) {
  const [dataSP, riwayat] = await Promise.all([getDataForSP(), getRiwayatSP()])

  return (
    <SpClient
      masterData={{ siswa: dataSP.siswa, pejabat: dataSP.pejabat }}
      sanksiList={dataSP.sanksiList}
      rekomendasi={dataSP.rekomendasi}
      riwayat={riwayat}
      currentUser={{ id: userId, nama: userName }}
    />
  )
}

export default async function SpPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'sp')
  if (!allowed) redirect('/dashboard')

  const userName = (user as any).nama_lengkap || user.name || 'User'

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Surat Peringatan (SP)"
        description="Tetapkan, cetak, dan pantau tindak lanjut SP siswa hingga keputusan akhir."
      />
      <Suspense fallback={<PageLoading text="Menyiapkan data SP..." />}>
        <SpDataFetcher userId={user.id} userName={userName} />
      </Suspense>
    </div>
  )
}
