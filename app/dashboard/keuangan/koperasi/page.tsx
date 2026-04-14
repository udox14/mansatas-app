import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess, getUserRoles } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { getKoperasiTagihanList, getMasterItemKoperasi } from '../actions'
import { KoperasiClient } from './koperasi-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Koperasi | Keuangan MANSATAS' }

export default async function KoperasiPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-koperasi')
  if (!allowed) redirect('/dashboard')

  const userRoles = await getUserRoles(db, session.user.id)
  const isBendahara = userRoles.includes('bendahara_komite') || userRoles.includes('super_admin')

  const [{ data: tagihan }, { data: masterItem }] = await Promise.all([
    getKoperasiTagihanList(),
    getMasterItemKoperasi(),
  ])

  // Ambil tahun ajaran aktif untuk generate tagihan bulk
  const tahunAjaran = await db.prepare(
    "SELECT id FROM tahun_ajaran WHERE is_aktif = 1 LIMIT 1"
  ).first<{ id: string }>()

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Koperasi"
        description="Tagihan seragam, buku, dan perlengkapan siswa baru"
      />
      <KoperasiClient
        initialTagihan={tagihan}
        masterItem={masterItem}
        isBendahara={isBendahara}
        tahunAjaranId={tahunAjaran?.id}
      />
    </div>
  )
}
