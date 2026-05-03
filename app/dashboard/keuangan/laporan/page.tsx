import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/utils/auth/server'
import { getDB } from '@/utils/db'
import { checkFeatureAccess } from '@/lib/features'
import { PageHeader } from '@/components/layout/page-header'
import { PageLoading } from '@/components/layout/page-loading'
import { LaporanClient } from './laporan-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Laporan Keuangan | MANSATAS' }

type RekapAngkatanRow = {
  tahun_masuk: number
  total_siswa: number
  dspt_lunas: number
  dspt_nyicil: number
  dspt_belum: number
  dspt_target: number
  dspt_dibayar: number
  dspt_diskon: number
}

type TransaksiRow = {
  id: string
  nomor_kuitansi: string | null
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
  tahun_masuk: number | null
  kelas: string | null
  nominal: number
  dibayar: number
  diskon: number
  sisa: number
  status: string
  updated_at: string
}

async function LaporanDataFetcher() {
  const db = await getDB()

  const [rekapAngkatan, transaksi, kasKeluar, tunggakan] = await Promise.all([
    db.prepare(`
      SELECT
        s.tahun_masuk,
        COUNT(DISTINCT s.id) as total_siswa,
        COUNT(DISTINCT CASE WHEN d.status='lunas' THEN d.id END) as dspt_lunas,
        COUNT(DISTINCT CASE WHEN d.status='nyicil' THEN d.id END) as dspt_nyicil,
        COUNT(DISTINCT CASE WHEN d.status='belum_bayar' OR d.id IS NULL THEN s.id END) as dspt_belum,
        COALESCE(SUM(d.nominal_target),0) as dspt_target,
        COALESCE(SUM(d.total_dibayar),0) as dspt_dibayar,
        COALESCE(SUM(d.total_diskon),0) as dspt_diskon
      FROM siswa s
      LEFT JOIN fin_dspt d ON d.siswa_id = s.id
      GROUP BY s.tahun_masuk
      ORDER BY s.tahun_masuk DESC
    `).all<RekapAngkatanRow>(),
    db.prepare(`
      SELECT
        t.id,
        t.nomor_kuitansi,
        t.siswa_id,
        s.nama_lengkap,
        s.nisn,
        s.tahun_masuk,
        COALESCE(k.tingkat || '-' || k.nomor_kelas || ' ' || k.kelompok, '-') as kelas,
        t.kategori,
        t.metode_bayar,
        t.jumlah_total,
        t.is_void,
        t.void_alasan,
        t.created_at,
        u.name as nama_input,
        GROUP_CONCAT(d.ref_type || ':' || d.jumlah, ', ') as rincian
      FROM fin_transaksi t
      JOIN siswa s ON s.id = t.siswa_id
      LEFT JOIN kelas k ON k.id = s.kelas_id
      LEFT JOIN user u ON u.id = t.input_oleh
      LEFT JOIN fin_transaksi_detail d ON d.transaksi_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `).all<TransaksiRow>(),
    db.prepare(`
      SELECT
        k.id,
        k.tanggal,
        k.created_at,
        k.jumlah,
        k.keterangan,
        k.kategori,
        k.metode,
        u.name as nama_input
      FROM fin_kas_keluar k
      LEFT JOIN user u ON u.id = k.dibuat_oleh
      ORDER BY k.tanggal DESC, k.created_at DESC
    `).all<KasKeluarRow>(),
    db.prepare(`
      SELECT * FROM (
        SELECT
          'dspt' as jenis,
          d.id as id,
          s.id as siswa_id,
          s.nama_lengkap,
          s.nisn,
          s.tahun_masuk,
          COALESCE(k.tingkat || '-' || k.nomor_kelas || ' ' || k.kelompok, '-') as kelas,
          d.nominal_target as nominal,
          d.total_dibayar as dibayar,
          d.total_diskon as diskon,
          max(d.nominal_target - d.total_dibayar - d.total_diskon, 0) as sisa,
          d.status,
          d.updated_at
        FROM fin_dspt d
        JOIN siswa s ON s.id = d.siswa_id
        LEFT JOIN kelas k ON k.id = s.kelas_id
        WHERE max(d.nominal_target - d.total_dibayar - d.total_diskon, 0) > 0

        UNION ALL

        SELECT
          'spp_tunggakan_awal' as jenis,
          sp.id as id,
          s.id as siswa_id,
          s.nama_lengkap,
          s.nisn,
          s.tahun_masuk,
          COALESCE(k.tingkat || '-' || k.nomor_kelas || ' ' || k.kelompok, '-') as kelas,
          sp.jumlah as nominal,
          sp.total_dibayar as dibayar,
          0 as diskon,
          max(sp.jumlah - sp.total_dibayar, 0) as sisa,
          sp.status,
          sp.updated_at
        FROM fin_spp_saldo_awal sp
        JOIN siswa s ON s.id = sp.siswa_id
        LEFT JOIN kelas k ON k.id = s.kelas_id
        WHERE max(sp.jumlah - sp.total_dibayar, 0) > 0

        UNION ALL

        SELECT
          'koperasi' as jenis,
          kt.id as id,
          s.id as siswa_id,
          s.nama_lengkap,
          s.nisn,
          s.tahun_masuk,
          COALESCE(k.tingkat || '-' || k.nomor_kelas || ' ' || k.kelompok, '-') as kelas,
          kt.total_nominal as nominal,
          kt.total_dibayar as dibayar,
          kt.total_diskon as diskon,
          max(kt.total_nominal - kt.total_dibayar - kt.total_diskon, 0) as sisa,
          kt.status,
          kt.updated_at
        FROM fin_koperasi_tagihan kt
        JOIN siswa s ON s.id = kt.siswa_id
        LEFT JOIN kelas k ON k.id = s.kelas_id
        WHERE max(kt.total_nominal - kt.total_dibayar - kt.total_diskon, 0) > 0
      )
      ORDER BY sisa DESC, nama_lengkap ASC
    `).all<TunggakanRow>(),
  ])

  return (
    <LaporanClient
      rekapAngkatan={rekapAngkatan.results ?? []}
      transaksi={transaksi.results ?? []}
      kasKeluar={kasKeluar.results ?? []}
      tunggakan={tunggakan.results ?? []}
    />
  )
}

export default async function LaporanPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  const db = await getDB()
  const allowed = await checkFeatureAccess(db, session.user.id, 'keuangan-laporan')
  if (!allowed) redirect('/dashboard')

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <PageHeader
        title="Laporan Keuangan"
        description="Ringkasan kas, transaksi, tunggakan, dan cetak laporan sesuai kebutuhan"
      />
      <Suspense fallback={<PageLoading text="Memuat laporan keuangan..." />}>
        <LaporanDataFetcher />
      </Suspense>
    </div>
  )
}
