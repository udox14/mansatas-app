import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { TransaksiClient } from './transaksi-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Riwayat Transaksi | Keuangan MANSATAS' }

interface TransaksiRow {
  id: string
  nomor_kuitansi: string
  siswa_id: string
  nama_lengkap: string
  nisn: string | null
  tahun_masuk: number | null
  kelas: string | null
  kategori: string
  metode_bayar: string
  jumlah_total: number
  is_void: number
  void_alasan: string | null
  created_at: string
  nama_input: string | null
  rincian: string | null
}

async function TransaksiDataFetcher() {
  const db = await getDB()
  const transaksi = await db.prepare(`
    SELECT
      t.id, t.nomor_kuitansi, t.siswa_id, t.kategori, t.metode_bayar,
      t.jumlah_total, t.is_void, t.void_alasan, t.created_at,
      s.nama_lengkap, s.nisn, s.tahun_masuk,
      CASE
        WHEN k.tingkat IS NULL THEN NULL
        ELSE k.tingkat || '-' || k.nomor_kelas || COALESCE(' ' || k.kelompok, '')
      END AS kelas,
      u.nama_lengkap AS nama_input,
      GROUP_CONCAT(d.ref_type || ':' || d.jumlah, ', ') AS rincian
    FROM fin_transaksi t
    INNER JOIN siswa s ON s.id = t.siswa_id
    LEFT JOIN kelas k ON k.id = s.kelas_id
    LEFT JOIN "user" u ON u.id = t.input_oleh
    LEFT JOIN fin_transaksi_detail d ON d.transaksi_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all<TransaksiRow>()

  return <TransaksiClient initialData={transaksi.results ?? []} />
}

export default async function TransaksiPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-laporan')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Riwayat Transaksi"
        description="Semua transaksi keuangan lintas siswa, terbaru ditampilkan paling atas"
      />
      <Suspense fallback={<PageLoading text="Memuat riwayat transaksi..." />}>
        <TransaksiDataFetcher />
      </Suspense>
    </div>
  )
}
