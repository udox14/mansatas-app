import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { getKoperasiTagihanList, getMasterItemKoperasi } from '../actions'
import { KoperasiClient } from './koperasi-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Koperasi | Keuangan MANSATAS' }

async function KoperasiDataFetcher({ userId }: { userId: string }) {
  const db = await getDB()

  const [userRoles, { data: tagihan }, { data: masterItem }, tahunAjaran] = await Promise.all([
    getUserRoles(db, userId),
    getKoperasiTagihanList(),
    getMasterItemKoperasi(),
    db.prepare("SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1").first<{ id: string }>(),
  ])

  const isBendahara = userRoles.includes('bendahara_komite') || userRoles.includes('super_admin')

  return (
    <KoperasiClient
      initialTagihan={tagihan}
      masterItem={masterItem}
      isBendahara={isBendahara}
      tahunAjaranId={tahunAjaran?.id}
    />
  )
}

export default async function KoperasiPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-koperasi')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Koperasi"
        description="Tagihan seragam, buku, dan perlengkapan siswa baru"
      />
      <Suspense fallback={<PageLoading text="Memuat data koperasi..." />}>
        <KoperasiDataFetcher userId={session.user.id} />
      </Suspense>
    </div>
  )
}
