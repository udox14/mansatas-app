import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { getBukuBesarSiswa } from '../../actions'
import { BukuBesarClient } from './buku-besar-client'
import { BackButton } from './back-button'
import type { StudentFinanceScope } from '../../actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Buku Besar Siswa | Keuangan MANSATAS' }

async function BukuBesarDataFetcher({ id, scope }: { id: string; scope: StudentFinanceScope }) {
  const db = await getDB()

  const [data, tahunAjaran] = await Promise.all([
    getBukuBesarSiswa(id),
    db.prepare("SELECT id, nama FROM tahun_ajaran WHERE is_active = 1 LIMIT 1").first<{ id: string; nama: string | null }>(),
  ])

  if (!data.siswa) notFound()
  if (data.siswa.status === 'dihapus') notFound()
  const actualScope: StudentFinanceScope = data.siswa.status === 'aktif' ? 'active' : 'inactive'
  if (actualScope !== scope) redirect(`/dashboard/keuangan/siswa/${id}?scope=${actualScope}`)

  return (
    <>
      <PageHeader
        title={data.siswa.nama_lengkap}
        description={`NISN: ${data.siswa.nisn ?? '-'} · ${data.siswa.tingkat ? `Kelas ${data.siswa.tingkat}-${data.siswa.nomor_kelas}${data.siswa.kelompok ? ' ' + data.siswa.kelompok : ''}` : '-'} · Angkatan ${data.siswa.tahun_masuk ?? '-'}`}
      />
      <BukuBesarClient
        data={data}
        masterItem={[]}
        tahunAjaranId={tahunAjaran?.id}
        tahunAjaranNama={tahunAjaran?.nama ?? '-'}
        studentScope={scope}
      />
    </>
  )
}

export default async function BukuBesarPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ scope?: string }> }) {
  const { id } = await params
  const query = await searchParams
  const scope: StudentFinanceScope = query.scope === 'inactive' ? 'inactive' : 'active'
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-dspt')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <BackButton />
      </div>
      <Suspense fallback={<PageLoading text="Memuat data siswa..." />}>
        <BukuBesarDataFetcher id={id} scope={scope} />
      </Suspense>
    </div>
  )
}
