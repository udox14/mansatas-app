// Lokasi: app/dashboard/surat/page.tsx
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { redirect } from 'next/navigation'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { FileText } from 'lucide-react'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'
import { getDataForSurat, getSuratKeluar } from './actions'
import { SuratClient } from './components/surat-client'

export const metadata = { title: 'Surat Keluar - MANSATAS App' }
export const dynamic = 'force-dynamic'

async function SuratDataFetcher({ userId, userName }: { userId: string; userName: string }) {
  const [masterData, logSurat] = await Promise.all([
    getDataForSurat(),
    getSuratKeluar(),
  ])

  return (
    <SuratClient
      masterData={masterData}
      logSurat={logSurat}
      currentUser={{ id: userId, nama: userName }}
    />
  )
}

export default async function SuratPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'surat')
  if (!allowed) redirect('/dashboard')

  const userName = (user as any).nama_lengkap || user.name || 'User'

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Surat Keluar"
        description="Generate dan cetak surat resmi madrasah."
      />
      <Suspense fallback={<PageLoading text="Menyiapkan data surat..." />}>
        <SuratDataFetcher userId={user.id} userName={userName} />
      </Suspense>
    </div>
  )
}
