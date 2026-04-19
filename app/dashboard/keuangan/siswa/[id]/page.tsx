import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { getBukuBesarSiswa, getMasterItemKoperasi } from '../../actions'
import { BukuBesarClient } from './buku-besar-client'
import { BackButton } from './back-button'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Buku Besar Siswa | Keuangan MANSATAS' }

async function BukuBesarDataFetcher({ id }: { id: string }) {
  const db = await getDB()

  const [data, { data: masterItem }, tahunAjaran] = await Promise.all([
    getBukuBesarSiswa(id),
    getMasterItemKoperasi(),
    db.prepare("SELECT id FROM tahun_ajaran WHERE is_active = 1 LIMIT 1").first<{ id: string }>(),
  ])

  if (!data.siswa) notFound()

  return (
    <>
      <PageHeader
        title={data.siswa.nama_lengkap}
        description={`NISN: ${data.siswa.nisn ?? '-'} · ${data.siswa.tingkat ? `Kelas ${data.siswa.tingkat}-${data.siswa.nomor_kelas}${data.siswa.kelompok ? ' ' + data.siswa.kelompok : ''}` : '-'} · Angkatan ${data.siswa.tahun_masuk ?? '-'}`}
      />
      <BukuBesarClient data={data} masterItem={masterItem} tahunAjaranId={tahunAjaran?.id} />
    </>
  )
}

export default async function BukuBesarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-dspt')
    || await checkFeatureAccess(db, session.user.id, 'keuangan-spp')
    || await checkFeatureAccess(db, session.user.id, 'keuangan-koperasi')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <BackButton />
      </div>
      <Suspense fallback={<PageLoading text="Memuat data siswa..." />}>
        <BukuBesarDataFetcher id={id} />
      </Suspense>
    </div>
  )
}
