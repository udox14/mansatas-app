import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { KeuanganExportClient } from './export-client'
import type { ExportSource, FinanceExportRow } from '../components/export-excel-dialog'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Export Keuangan | MANSATAS' }

function getKelas(row: { tingkat?: number | null; nomor_kelas?: number | string | null; kelompok?: string | null }) {
  return row.tingkat && row.nomor_kelas
    ? `${row.tingkat}-${row.nomor_kelas}${row.kelompok ? ' ' + row.kelompok : ''}`
    : '-'
}

export default async function KeuanganExportPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const db = await getDB()
  const [canDspt, canSpp] = await Promise.all([
    checkFeatureAccess(db, session.user.id, 'keuangan-dspt'),
    checkFeatureAccess(db, session.user.id, 'keuangan-spp'),
  ])
  if (!canDspt && !canSpp) redirect('/dashboard')

  const rows: FinanceExportRow[] = []
  const sources: ExportSource[] = []

  if (canDspt) {
    sources.push('DSPT')
    const dsptRes = await db.prepare(`
      SELECT
        d.id, d.nominal_target, d.total_dibayar, d.total_diskon,
        COALESCE(d.status, 'tidak_ada') AS status, d.catatan,
        s.id AS siswa_id, s.nama_lengkap, s.nisn, s.tahun_masuk,
        k.tingkat, k.nomor_kelas, k.kelompok
      FROM siswa s
      LEFT JOIN fin_dspt d ON d.siswa_id = s.id
      LEFT JOIN kelas k ON k.id = s.kelas_id
      ORDER BY s.nama_lengkap ASC
    `).all<any>()

    for (const row of dsptRes.results ?? []) {
      const target = row.nominal_target ?? 0
      const dibayar = row.total_dibayar ?? 0
      const diskon = row.total_diskon ?? 0
      rows.push({
        source: 'DSPT',
        siswa_id: row.siswa_id,
        nama_lengkap: row.nama_lengkap,
        nisn: row.nisn,
        tahun_masuk: row.tahun_masuk,
        kelas: getKelas(row),
        dspt_target: target,
        dspt_dibayar: dibayar,
        dspt_diskon: diskon,
        dspt_sisa: Math.max(0, target - dibayar - diskon),
        dspt_status: row.status,
        dspt_catatan: row.catatan,
      })
    }
  }

  if (canSpp) {
    sources.push('SPP')
    const sppRes = await db.prepare(`
      SELECT
        sa.id, sa.siswa_id, sa.jumlah, sa.total_dibayar, sa.status, sa.keterangan,
        s.nama_lengkap, s.nisn, s.tahun_masuk,
        k.tingkat, k.nomor_kelas, k.kelompok
      FROM fin_spp_saldo_awal sa
      INNER JOIN siswa s ON s.id = sa.siswa_id
      LEFT JOIN kelas k ON k.id = s.kelas_id
      WHERE sa.status != 'lunas' AND sa.jumlah > sa.total_dibayar
      ORDER BY s.nama_lengkap ASC
    `).all<any>()

    for (const row of sppRes.results ?? []) {
      rows.push({
        source: 'SPP',
        siswa_id: row.siswa_id,
        nama_lengkap: row.nama_lengkap,
        nisn: row.nisn,
        tahun_masuk: row.tahun_masuk,
        kelas: getKelas(row),
        spp_tunggakan: row.jumlah,
        spp_dibayar: row.total_dibayar ?? 0,
        spp_sisa: Math.max(0, row.jumlah - (row.total_dibayar ?? 0)),
        spp_status: row.status,
        spp_keterangan: row.keterangan,
      })
    }
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Export Keuangan"
        description="Export data DSPT, SPP, atau keduanya ke Excel"
      />
      <KeuanganExportClient rows={rows} sources={sources} />
    </div>
  )
}
