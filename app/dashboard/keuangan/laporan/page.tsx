import { cashLedgerSql, isKomiteFundScope } from '@/lib/komite-funds'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db-server'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { LaporanClient } from './laporan-client'
import { getKomiteReportSettings } from '@/lib/komite-report-settings'
import { getOrSetFinanceCache } from '@/lib/finance-cache'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Laporan Keuangan | MANSATAS' }

type DsptRow = {
  siswa_id: string
  nama_lengkap: string
  nisn: string | null
  siswa_status: string
  tahun_masuk: number
  nominal_target: number | null
  total_dibayar: number | null
  total_diskon: number | null
  status: string | null
}

type TransaksiRow = {
  id: string
  nomor_kuitansi: string | null
  siswa_id: string
  nama_lengkap: string
  nisn: string | null
  siswa_status: string
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

type KasKeluarRow = {
  id: string
  tanggal: string
  created_at: string
  jumlah: number
  keterangan: string
  kategori: string | null
  metode: string
  nama_input: string | null
}

type TunggakanRow = {
  jenis: string
  id: string
  siswa_id: string
  nama_lengkap: string
  nisn: string | null
  siswa_status: string
  tahun_masuk: number | null
  kelas: string | null
  nominal: number
  dibayar: number
  diskon: number
  sisa: number
  status: string
  updated_at: string
}

async function LaporanDataFetcher({ cacheScope,fund }: { cacheScope: string; fund?:string }) {
  const db = await getDB()
  const [dsptRows, transaksi, kasKeluar, tunggakan, reportSettings] = await getOrSetFinanceCache(`report-page:${cacheScope}:${fund??'all'}`, () => Promise.all([
    db.prepare(`
      SELECT
        s.id as siswa_id, s.nama_lengkap, s.nisn, s.status AS siswa_status, s.tahun_masuk,
        d.nominal_target, d.total_dibayar, d.total_diskon, d.status
      FROM siswa s
      LEFT JOIN fin_dspt d ON d.siswa_id = s.id
      ORDER BY s.nama_lengkap ASC
    `).all<DsptRow>(),
    db.prepare(`${cashLedgerSql(fund)}
      SELECT id,proof_number AS nomor_kuitansi,student_id AS siswa_id,COALESCE(student_name,counterparty) AS nama_lengkap,
        student_nisn AS nisn,student_status AS siswa_status,angkatan AS tahun_masuk,student_class AS kelas,source AS kategori,
        method AS metode_bayar,amount AS jumlah_total,status='void' AS is_void,void_reason AS void_alasan,
        CASE WHEN origin='manual' THEN transaction_date || substr(created_at,11) ELSE created_at END AS created_at,recorder_name AS nama_input,description AS rincian
      FROM ledger WHERE direction='income' ORDER BY transaction_date DESC,created_at DESC`)
      .bind(...(fund?[fund]:[])).all<TransaksiRow>(),
    db.prepare(`${cashLedgerSql(fund)}
      SELECT id,transaction_date AS tanggal,created_at,amount AS jumlah,description AS keterangan,
        category_name AS kategori,method AS metode,recorder_name AS nama_input
      FROM ledger WHERE direction='expense' AND status='active' ORDER BY transaction_date DESC,created_at DESC`)
      .bind(...(fund?[fund]:[])).all<KasKeluarRow>(),
    db.prepare(`
      SELECT * FROM (
        SELECT
          'dspt' as jenis,
          d.id as id,
          s.id as siswa_id,
          s.nama_lengkap,
          s.nisn,
          s.status AS siswa_status,
          s.tahun_masuk,
          COALESCE(k.tingkat || '-' || k.nomor_kelas || ' ' || k.kelompok, (SELECT rk.kelas_nama FROM riwayat_kelas rk WHERE rk.siswa_id=s.id ORDER BY rk.created_at DESC LIMIT 1), '-') as kelas,
          d.nominal_target as nominal,
          d.total_dibayar as dibayar,
          d.total_diskon as diskon,
          max(d.nominal_target - d.total_dibayar - d.total_diskon, 0) as sisa,
          d.status,
          d.updated_at
        FROM fin_dspt d
        JOIN siswa s ON s.id = d.siswa_id
        LEFT JOIN kelas k ON k.id = COALESCE(s.kelas_id, s.kelas_id_sebelum_keluar)
        WHERE max(d.nominal_target - d.total_dibayar - d.total_diskon, 0) > 0

        UNION ALL

        SELECT
          'spp_tunggakan_awal' as jenis,
          sp.id as id,
          s.id as siswa_id,
          s.nama_lengkap,
          s.nisn,
          s.status AS siswa_status,
          s.tahun_masuk,
          COALESCE(k.tingkat || '-' || k.nomor_kelas || ' ' || k.kelompok, (SELECT rk.kelas_nama FROM riwayat_kelas rk WHERE rk.siswa_id=s.id ORDER BY rk.created_at DESC LIMIT 1), '-') as kelas,
          sp.jumlah as nominal,
          sp.total_dibayar as dibayar,
          0 as diskon,
          max(sp.jumlah - sp.total_dibayar, 0) as sisa,
          sp.status,
          sp.updated_at
        FROM fin_spp_saldo_awal sp
        JOIN siswa s ON s.id = sp.siswa_id
        LEFT JOIN kelas k ON k.id = COALESCE(s.kelas_id, s.kelas_id_sebelum_keluar)
        WHERE max(sp.jumlah - sp.total_dibayar, 0) > 0

      )
      ORDER BY sisa DESC, nama_lengkap ASC
    `).all<TunggakanRow>(),
    getKomiteReportSettings(),
  ]))

  return (
    <LaporanClient
      dsptRows={dsptRows.results ?? []}
      transaksi={transaksi.results ?? []}
      fund={fund}
      kasKeluar={kasKeluar.results ?? []}
      tunggakan={tunggakan.results ?? []}
      reportSettings={reportSettings}
    />
  )
}

export default async function LaporanPage({ searchParams }:{searchParams?:Promise<{fund?:string}>}) {
  const params=await searchParams
  const fund=isKomiteFundScope(params?.fund)&&params.fund!=='all'?params.fund:undefined
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-laporan')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Laporan Keuangan"
        description="Ringkasan dan rincian pemasukan, pengeluaran, serta tunggakan sesuai periode dan filter"
      />
      <Suspense fallback={<PageLoading text="Memuat laporan keuangan..." />}>
        <LaporanDataFetcher fund={fund} cacheScope={session.user.id} />
      </Suspense>
    </div>
  )
}
