import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { SppClient } from './spp-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'SPP | Keuangan MANSATAS' }

interface SppTunggakanRow {
  id: string
  siswa_id: string
  nama_lengkap: string
  nisn: string | null
  tahun_masuk: number | null
  tingkat: number | null
  nomor_kelas: number | null
  kelompok: string | null
  jumlah: number
  total_dibayar: number
  status: string
  keterangan: string | null
}

async function SppDataFetcher() {
  const db = await (await import('@/utils/db')).getDB()

  const [angkatanRes, tunggakanStats, tunggakanRes] = await Promise.all([
    db.prepare('SELECT DISTINCT tahun_masuk FROM siswa WHERE tahun_masuk IS NOT NULL ORDER BY tahun_masuk DESC').all<{ tahun_masuk: number }>(),
    db.prepare(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(jumlah), 0) AS total_jumlah,
        COALESCE(SUM(total_dibayar), 0) AS total_dibayar,
        COALESCE(SUM(jumlah - total_dibayar), 0) AS total_sisa
      FROM fin_spp_saldo_awal
      WHERE status != 'lunas' AND jumlah > total_dibayar
    `).first<{ total: number; total_jumlah: number; total_dibayar: number; total_sisa: number }>(),
    db.prepare(`
      SELECT
        sa.id, sa.siswa_id, sa.jumlah, sa.total_dibayar, sa.status, sa.keterangan,
        s.nama_lengkap, s.nisn, s.tahun_masuk,
        k.tingkat, k.nomor_kelas, k.kelompok
      FROM fin_spp_saldo_awal sa
      INNER JOIN siswa s ON s.id = sa.siswa_id
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE sa.status != 'lunas' AND sa.jumlah > sa.total_dibayar
      ORDER BY s.nama_lengkap ASC
    `).all<SppTunggakanRow>(),
  ])

  return (
    <SppClient
      tunggakanList={tunggakanRes.results ?? []}
      tunggakanStats={tunggakanStats ?? null}
      angkatanList={(angkatanRes.results ?? []).map(r => r.tahun_masuk)}
    />
  )
}

export default async function SppPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-spp')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="SPP"
        description="Hanya menagih siswa dengan tunggakan terdahulu"
      />
      <Suspense fallback={<PageLoading text="Memuat data tunggakan SPP..." />}>
        <SppDataFetcher />
      </Suspense>
    </div>
  )
}
