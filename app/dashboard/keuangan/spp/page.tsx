import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { getSppSettings, getSppTagihanList, getSppMulaiList } from '../actions'
import { SppClient } from './spp-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'SPP | Keuangan MANSATAS' }

async function SppDataFetcher() {
  const tahun = new Date().getFullYear()
  const bulan = new Date().getMonth() + 1

  const db = await (await import('@/utils/db')).getDB()

  const [{ data: settings }, { data: tagihan }, angkatanRes, { data: mulai }, saldoAwalStats, saldoAwalRes] = await Promise.all([
    getSppSettings(),
    getSppTagihanList({ tahun, bulan }),
    db.prepare('SELECT DISTINCT tahun_masuk FROM siswa WHERE tahun_masuk IS NOT NULL ORDER BY tahun_masuk DESC').all<{ tahun_masuk: number }>(),
    getSppMulaiList(),
    db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(jumlah) as total_jumlah,
        SUM(total_dibayar) as total_dibayar,
        SUM(CASE WHEN status = 'belum_bayar' THEN 1 ELSE 0 END) as belum_lunas
      FROM fin_spp_saldo_awal
    `).first<{ total: number; total_jumlah: number; total_dibayar: number; belum_lunas: number }>(),
    db.prepare(`SELECT siswa_id, status, jumlah, total_dibayar FROM fin_spp_saldo_awal`).all<{ siswa_id: string; status: string; jumlah: number; total_dibayar: number }>(),
  ])

  return (
    <SppClient
      initialSettings={settings}
      initialTagihan={tagihan}
      defaultTahun={tahun}
      defaultBulan={bulan}
      angkatanList={(angkatanRes.results ?? []).map(r => r.tahun_masuk)}
      initialMulai={mulai}
      saldoAwalStats={saldoAwalStats ?? null}
      saldoAwalList={saldoAwalRes.results ?? []}
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
        description="Sumbangan Pembinaan Pendidikan — tagihan bulanan per siswa"
      />
      <Suspense fallback={<PageLoading text="Memuat data SPP..." />}>
        <SppDataFetcher />
      </Suspense>
    </div>
  )
}
