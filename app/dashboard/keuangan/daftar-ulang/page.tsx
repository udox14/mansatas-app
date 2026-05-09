import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getCurrentUser } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageLoading } from '@/components/layout/page-loading'
import { PageHeader } from '@/components/layout/page-header'
import { DaftarUlangClient } from './daftar-ulang-client'

export const metadata = { title: 'Kasir Daftar Ulang — Keuangan' }
export const dynamic = 'force-dynamic'

async function DaftarUlangDataFetcher() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const allowed = await checkFeatureAccess(db, user.id, 'keuangan-dspt')
  if (!allowed) redirect('/dashboard')

  const taAktif = await db.prepare('SELECT id, nama FROM tahun_ajaran WHERE is_active = 1 LIMIT 1').first<{ id: string; nama: string }>()

  return (
    <>
      <PageHeader
        title="Kasir Daftar Ulang PMB"
        description="Input pembayaran DSPT dan cetak kuitansi daftar ulang"
      />
      <DaftarUlangClient
        tahunAjaranId={taAktif?.id ?? ''}
        tahunAjaranNama={taAktif?.nama ?? '-'}
      />
    </>
  )
}

export default function DaftarUlangPage() {
  return (
    <Suspense fallback={<PageLoading text="Memuat kasir daftar ulang..." />}>
      <DaftarUlangDataFetcher />
    </Suspense>
  )
}
