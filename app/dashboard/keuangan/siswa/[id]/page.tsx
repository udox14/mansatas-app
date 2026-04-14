import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { getBukuBesarSiswa, getMasterItemKoperasi } from '../../actions'
import { BukuBesarClient } from './buku-besar-client'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Buku Besar Siswa | Keuangan MANSATAS' }

export default async function BukuBesarPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-dspt')
    || await checkFeatureAccess(db, session.user.id, 'keuangan-koperasi')
  if (!allowed) redirect('/dashboard')

  const [data, { data: masterItem }, tahunAjaran] = await Promise.all([
    getBukuBesarSiswa(params.id),
    getMasterItemKoperasi(),
    db.prepare("SELECT id FROM tahun_ajaran WHERE is_aktif = 1 LIMIT 1").first<{ id: string }>(),
  ])

  if (!data.siswa) notFound()

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <Link href="/dashboard/keuangan/dspt" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" /> Kembali
        </Link>
      </div>
      <PageHeader
        title={data.siswa.nama_lengkap}
        description={`NISN: ${data.siswa.nisn ?? '-'} · ${data.siswa.tingkat ? `Kelas ${data.siswa.tingkat}-${data.siswa.nomor_kelas}${data.siswa.kelompok ?? ''}` : '-'} · Angkatan ${data.siswa.tahun_masuk ?? '-'}`}
      />
      <BukuBesarClient data={data} masterItem={masterItem} tahunAjaranId={tahunAjaran?.id} />
    </div>
  )
}
